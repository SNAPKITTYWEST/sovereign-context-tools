#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// EDUALC — Shadow Terminal Agent v2.0
// @snapkitty/edaulc
//
// CLAUDE creates forward. EDUALC verifies backward.
//
// Architecture:
//   [ File Save ]
//         ↓
//   [ fs.watch debounced watcher ]
//         ↓
//   [ Local ERE five-pass — deterministic JavaScript, zero cost ]
//   [ No AI. No throttle. No quota. Instant. ]
//         ↓
//   [ METATRON: YES → Groq veneer (optional voice layer) ]
//   [ METATRON: NO  → log freeze ]
//         ↓
//   [ Signal ABZU context GC (if ABZU_URL configured) ]
//
// Usage:
//   npx @snapkitty/edaulc              # watch current directory
//   npx @snapkitty/edaulc ./src ./lib  # watch specific directories
//
// Env vars:
//   GROQ_API_KEY      — optional Groq key for urban voice veneer
//   GROQ_MODEL        — default: llama3-8b-8192
//   ABZU_URL          — optional: http://127.0.0.1:7070 to enable context GC
//   RUST_HANDLER_URL  — optional: your Rust WORM handler URL
//   EDUALC_DEBOUNCE   — ms between save and evaluation (default: 3000)
//   EDUALC_DRY_RUN=1  — print paths only, skip ERE
// ═══════════════════════════════════════════════════════════════════════════

import { watch, existsSync } from 'fs'
import { readFile }          from 'fs/promises'
import { join, relative, extname, resolve } from 'path'
import { fileURLToPath }     from 'url'

// ── Terminal colors ──────────────────────────────────────────────────────────
const C = {
  gold:   s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  purple: s => `\x1b[35m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  gray:   s => `\x1b[90m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
}

const out = (s = '') => process.stdout.write(s + '\n')
const ts  = ()       => C.gray(new Date().toISOString().slice(11, 19))
const sep = ()       => C.gray('─'.repeat(60))

// ── Config ───────────────────────────────────────────────────────────────────
const GROQ_KEY    = process.env.GROQ_API_KEY    ?? ''
const GROQ_MODEL  = process.env.GROQ_MODEL      ?? 'llama3-8b-8192'
const RUST_URL    = process.env.RUST_HANDLER_URL ?? ''
const ABZU_URL    = process.env.ABZU_URL         ?? ''
const DEBOUNCE_MS = parseInt(process.env.EDUALC_DEBOUNCE ?? '3000')
const MAX_LINES   = 120
const DRY_RUN     = process.env.EDUALC_DRY_RUN === '1'

// ── Watch targets — from CLI args or current directory ───────────────────────
const CWD = process.cwd()
const WATCH_TARGETS = process.argv.slice(2).length > 0
  ? process.argv.slice(2).map(p => resolve(CWD, p))
  : [CWD]

const WATCH_EXTS    = new Set(['.ts', '.js', '.mjs', '.rs', '.hs', '.pl', '.go', '.py'])
const SKIP_PATTERNS = [/node_modules/, /\.next/, /target[\\/]/, /\.git/, /\.d\.ts$/, /dist[\\/]/]

// ── ERE Five-Pass (deterministic — no AI, no quota) ──────────────────────────

function erePass1_structural(content, ext) {
  if (!content || content.trim().length < 10)
    return { pass: false, reason: 'file empty or too short' }
  if (ext === '.ts' && content.includes('export default') && !content.match(/export default \w/))
    return { pass: false, reason: 'malformed default export' }
  return { pass: true }
}

function erePass2_scholarly(content) {
  const checks = [
    [/throw new Error\(['"]not implemented/i,    'not-implemented stub'],
    [/todo:\s*implement/i,                        'TODO implement placeholder'],
    [/return\s+(?:null|undefined)\s*\/\/.*fake/i, 'fake null return'],
    [/console\.log\(['"]fake/i,                   'fake console.log marker'],
  ]
  for (const [re, reason] of checks) {
    if (re.test(content)) return { pass: false, reason }
  }
  return { pass: true }
}

function erePass3_invariants(content, ext) {
  if (ext === '.ts') {
    if (/import\s+crypto\b/.test(content))
      return { pass: false, reason: 'TypeScript importing crypto — SHA-256 belongs in a systems layer' }
    if (/createHash|crypto\.subtle/.test(content))
      return { pass: false, reason: 'TypeScript hashing — cryptographic operations belong in systems layer' }
  }
  return { pass: true }
}

function erePass4_mission(content) {
  if (/(?:api_key|secret|password)\s*=\s*['"][a-zA-Z0-9_\-]{20,}['"]/i.test(content))
    return { pass: false, reason: 'hardcoded secret detected — use environment variables' }
  return { pass: true }
}

function erePass5_root(content, ext) {
  const threshold = ext === '.rs' ? 25 : ext === '.hs' ? 15 : ext === '.ts' ? 20 : 8
  const open  = (content.match(/[{[(]/g) ?? []).length
  const close = (content.match(/[}\])]/g) ?? []).length
  if (Math.abs(open - close) > threshold)
    return { pass: false, reason: `unbalanced delimiters (${open} open, ${close} close)` }
  return { pass: true }
}

function runLocalERE(content, filepath) {
  const ext     = extname(filepath)
  const passes  = [
    erePass1_structural(content, ext),
    erePass2_scholarly(content),
    erePass3_invariants(content, ext),
    erePass4_mission(content),
    erePass5_root(content, ext),
  ]
  return {
    passes,
    certified: passes.every(p => p.pass),
    failures:  passes.map((p, i) => p.pass ? null : `Pass ${i+1}: ${p.reason}`).filter(Boolean),
  }
}

// ── Groq veneer ───────────────────────────────────────────────────────────────
const VENEER_SYSTEM = `You are EDUALC's voice in the terminal — the shadow agent.
Translate raw ERE certification output into sharp, modern, urban tech language.
Keep all data: filenames, pass/fail details. 1-2 sentences max. Direct. No fluff.`

async function callGroqVeneer(rawSummary) {
  if (!GROQ_KEY) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: GROQ_MODEL, max_tokens: 100, messages: [
        { role: 'system', content: VENEER_SYSTEM },
        { role: 'user',   content: rawSummary },
      ]}),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return (await res.json())?.choices?.[0]?.message?.content?.trim() ?? null
  } catch { return null }
}

// ── Signal Rust + ABZU ────────────────────────────────────────────────────────
async function signalDownstream(filepath, certified) {
  if (!RUST_URL && !ABZU_URL) return
  const payload = JSON.stringify({
    file: relative(CWD, filepath), certified,
    timestamp: new Date().toISOString(), agent: 'EDUALC',
  })
  const calls = []
  if (RUST_URL) calls.push(
    fetch(`${RUST_URL}/edualc/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: payload, signal: AbortSignal.timeout(2000),
    }).catch(() => {})
  )
  if (ABZU_URL) calls.push(
    fetch(`${ABZU_URL}/edaulc/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: payload, signal: AbortSignal.timeout(2000),
    }).catch(() => {})
  )
  await Promise.allSettled(calls)
}

// ── Evaluate ──────────────────────────────────────────────────────────────────
async function evaluate(filepath) {
  const rel = relative(CWD, filepath)
  let content
  try { content = await readFile(filepath, 'utf8') } catch { return }
  const tail = content.split('\n').slice(-MAX_LINES).join('\n')

  out(`${ts()} ${C.cyan('◈')} ${C.bold(rel)}`)
  if (DRY_RUN) { out(`${ts()} ${C.gray('  dry run — ERE skipped')}`); out(); return }

  const ere    = runLocalERE(tail, filepath)
  const labels = ['Enochian LTR', 'Latin LTR', 'Hebrew RTL', 'Arabic RTL', 'Aramaic RTL']
  ere.passes.forEach((p, i) => {
    out(`${ts()}   ${p.pass ? C.green('✓') : C.red('✗')} Pass ${i+1} (${labels[i]}): ${
      p.pass ? C.green('PASS') : C.red('FAIL — ' + p.reason)}`)
  })

  let rawSummary
  if (ere.certified) {
    out(`${ts()} ${C.green(C.bold('  METATRON: YES — certified'))}`)
    rawSummary = `METATRON certified. All five ERE passes green. ${rel} is clean.`
  } else {
    out(`${ts()} ${C.red(C.bold('  METATRON: NO — FROZEN'))}`)
    ere.failures.forEach(f => out(`${ts()} ${C.red(`  ✗ ${f}`)}`))
    rawSummary = `METATRON NO. ${rel} frozen. Issues: ${ere.failures.join('. ')}`
  }

  await signalDownstream(filepath, ere.certified)
  const voice = await callGroqVeneer(rawSummary)
  if (voice) out(`${ts()} ${C.gold('  ▸')} ${C.gold(voice)}`)
  out()
}

// ── Debounce + watcher ────────────────────────────────────────────────────────
const pending = new Map()

function onChange(filepath) {
  if (!WATCH_EXTS.has(extname(filepath))) return
  if (SKIP_PATTERNS.some(p => p.test(filepath)))  return
  if (!existsSync(filepath)) return
  if (pending.has(filepath)) clearTimeout(pending.get(filepath))
  pending.set(filepath, setTimeout(() => {
    pending.delete(filepath)
    evaluate(filepath).catch(() => {})
  }, DEBOUNCE_MS))
}

// ── Banner ────────────────────────────────────────────────────────────────────
out()
out(C.purple(C.bold('  ╔══════════════════════════════════════════════════════════╗')))
out(C.purple(C.bold('  ║         E D U A L C — SHADOW TERMINAL AGENT  v2.0       ║')))
out(C.purple(C.bold('  ║       local ERE · Groq voice · zero throttle            ║')))
out(C.purple(C.bold('  ╚══════════════════════════════════════════════════════════╝')))
out()
out(C.gray(`  voice   : Groq ${GROQ_MODEL} ${GROQ_KEY ? '✓' : '✗ no key — voice disabled'}`))
out(C.gray(`  abzu    : ${ABZU_URL || 'not configured'}`))
out(C.gray(`  debounce: ${DEBOUNCE_MS}ms | dry run: ${DRY_RUN ? 'YES' : 'NO'}`))
out()
out(C.cyan('  Watching:'))
WATCH_TARGETS.forEach(t => out(C.gray(`    ◈ ${t}`)))
out()
out(C.green('  EDUALC is active. Save any file to run ERE.'))
out(sep())
out()

WATCH_TARGETS.forEach(target => {
  if (!existsSync(target)) { out(C.red(`  ✗ path not found: ${target}`)); return }
  watch(target, { recursive: true }, (_, filename) => {
    if (filename) onChange(join(target, filename))
  })
})

process.on('SIGINT', () => {
  out()
  out(C.purple('  EDUALC signing off. The mirror closes.'))
  process.exit(0)
})
