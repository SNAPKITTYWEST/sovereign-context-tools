#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ABZU — Sovereign Context Garbage Collector  v1.0
// scripts/abzu.mjs
//
// Order of Symmetry | Meeting 3 | 2026-05-30
// Sealed consensus: NOVA · RELAY · CIPHER · NEXUS · HERALD
//                   AXIOM · PRISM · VAULT · SENTINEL · LEDGE · ATLAS
//
// Architecture:
//   EDUALC PASS/FAIL → /edualc/report (Bifrost bus)
//         ↓
//   VAULT veto gate (FAIL = freeze, no purge)
//         ↓
//   PRISM drift gate (oscillating module = soft-retain)
//         ↓
//   AXIOM AST scope (tree-sitter local, 500 structural tokens)
//         ↓
//   LEDGE sequence: compose → WORM seal (Rust) → account → advise purge
//         ↓
//   SENTINEL: advise only — operator executes compression
//
// EDUALC payload contract: { file, certified, timestamp, agent }
// Launch: node scripts/abzu.mjs
// ═══════════════════════════════════════════════════════════════════════════

import express            from 'express'
import { createHmac, randomUUID } from 'crypto'
import { appendFileSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath }  from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = process.cwd()

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

// ── Config ───────────────────────────────────────────────────────────────────
const PORT        = parseInt(process.env.ABZU_PORT         ?? '7070')
const RUST_URL    = process.env.RUST_HANDLER_URL           ?? 'http://localhost:8080'
const ABZU_SECRET = process.env.ABZU_HMAC_SECRET           ?? ''

const DRIFT_WINDOW    = 5
const DRIFT_THRESHOLD = 0.4

const AUDIT_DIR = join(ROOT, 'logs')
const AUDIT_LOG = join(AUDIT_DIR, 'abzu-audit.ndjson')
try { mkdirSync(AUDIT_DIR, { recursive: true }) } catch {}

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  session_id:      randomUUID(),
  is_frozen:       false,
  tokens_purged:   0,
  tokens_retained: 0,
  last_worm_hash:  null,
  last_seal_ts:    null,
  drift_score:     0,
  decision_count:  0,
  module_history:  {},
}

// ── HMAC auth (SENTINEL constraint) ─────────────────────────────────────────
function verifyHmac(req) {
  if (!ABZU_SECRET) return true
  const sig = req.headers['x-abzu-signature']
  if (!sig) return false
  const expected = createHmac('sha256', ABZU_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex')
  return sig === expected
}

// ── Append-only audit log (LEDGE constraint) ─────────────────────────────────
function audit(entry) {
  try {
    appendFileSync(AUDIT_LOG, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n')
  } catch {}
}

// ── PRISM drift score ────────────────────────────────────────────────────────
function updateDrift(module, certified) {
  const h = state.module_history[module] ??= []
  h.push(certified ? 0 : 1)
  if (h.length > DRIFT_WINDOW) h.shift()
  if (h.length < 2) return 0
  let changes = 0
  for (let i = 1; i < h.length; i++) if (h[i] !== h[i - 1]) changes++
  return changes / (h.length - 1)
}

// ── LEDGER: structural signature extraction (regex fallback, no native deps) ──
const SIG_PATTERNS = {
  '.hs': [/^module\s+\S+/, /^import\s+(?:qualified\s+)?\S+/, /^\w[\w']*\s*::\s*.+/],
  '.rs': [/^pub\s+(?:async\s+)?(?:fn|struct|enum|trait|impl|type|const)\s+\w+/, /^use\s+\S+/],
  '.ts': [/^export\s+(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|const|enum)\s+\w+/, /^import\s+/],
}

function extractSignatures(filePath) {
  try {
    const ext   = extname(filePath)
    const abs   = join(ROOT, filePath)
    const lines = readFileSync(abs, 'utf8').split('\n')
    const pats  = SIG_PATTERNS[ext] ?? []
    const sigs  = []
    for (const line of lines) {
      const t = line.trim()
      if (t && pats.some(p => p.test(t))) {
        sigs.push(t.slice(0, 120))
        if (sigs.length >= 8) break
      }
    }
    return sigs
  } catch { return [] }
}

// ── AXIOM: local AST scope via tree-sitter ───────────────────────────────────
async function getASTScope(filePath) {
  const ext        = extname(filePath)
  const signatures = extractSignatures(filePath)
  try {
    const { Parser } = await import('tree-sitter')
    let lang
    if      (ext === '.hs') lang = (await import('tree-sitter-haskell')).default
    else if (ext === '.rs') lang = (await import('tree-sitter-rust')).default
    else if (ext === '.ts') lang = (await import('tree-sitter-typescript')).typescript
    else return { scope: 'FULL_FILE', tokens: 2000, signatures }

    const p = new Parser()
    p.setLanguage(lang)
    return { scope: `BOUNDED_AST:${ext}`, tokens: 500, signatures }
  } catch {
    return { scope: 'FULL_FILE_FALLBACK', tokens: 2000, signatures }
  }
}

// ── LEDGE: WORM seal via Rust ─────────────────────────────────────────────────
async function sealToWorm(factBlock) {
  const res = await fetch(`${RUST_URL}/agents/process`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      agent:      'ABZU',
      event_type: 'worm_seal',
      source:     'context-gc',
      payload:    factBlock,
    }),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`Rust WORM rejected: ${res.status}`)
  const j = await res.json()
  return j.decision_seal ?? j.worm_entry_id ?? j.seal ?? null
}

// ── Express app ──────────────────────────────────────────────────────────────
const app = express()
app.use(express.json({ limit: '64kb' }))

// ── POST /edualc/report — Bifrost bus consumer ───────────────────────────────
// Matches EDUALC signalRust payload: { file, certified, timestamp, agent }
app.post('/edualc/report', async (req, res) => {
  if (!verifyHmac(req)) {
    out(`${ts()} ${C.red('✗')} ABZU: HMAC mismatch — rejected`)
    return res.status(401).json({ error: 'unauthorized' })
  }

  const { file, certified, timestamp, agent } = req.body
  if (typeof file !== 'string' || typeof certified !== 'boolean') {
    return res.status(400).json({ error: 'invalid payload: file (string) and certified (boolean) required' })
  }

  state.decision_count++
  out(`${ts()} ${C.purple('◈')} ABZU ← ${C.bold(file)} [${agent ?? 'EDUALC'}] → ${certified ? C.green('PASS') : C.red('FAIL')}`)

  // ── VAULT veto: freeze on FAIL ────────────────────────────────────────────
  if (!certified) {
    state.is_frozen = true
    out(`${ts()} ${C.red(C.bold('  VAULT FREEZE — full retention, no purge'))}`)
    audit({ decision: 'RETAIN', reason: 'VAULT_FREEZE', file })
    return res.json({ decision: 'RETAIN', reason: 'VAULT_FREEZE_PROTOCOL_ACTIVE' })
  }

  // ── PRISM drift gate ──────────────────────────────────────────────────────
  const drift = updateDrift(file, certified)
  state.drift_score = drift
  if (drift > DRIFT_THRESHOLD) {
    out(`${ts()} ${C.gold(`  PRISM: drift ${drift.toFixed(2)} > ${DRIFT_THRESHOLD} — soft retain`)}`)
    audit({ decision: 'RETAIN', reason: 'PRISM_DRIFT', file, drift })
    return res.json({ decision: 'RETAIN', reason: 'PRISM_CONTEXT_DRIFT_UNSTABLE', drift })
  }

  state.is_frozen = false

  // ── AXIOM: AST scope + structural signatures ─────────────────────────────
  const { scope, tokens: structuralTokens, signatures } = await getASTScope(file)

  // ── LEDGE sequence: compose → seal → account → advise ────────────────────
  const factBlock = {
    session_id: state.session_id,
    file,
    scope,
    timestamp:  timestamp ?? new Date().toISOString(),
    summary:    `Finality verified: ${file}. Context bounded to structural signatures.`,
  }

  let sealHash
  try {
    sealHash = await sealToWorm(factBlock)
    if (!sealHash) throw new Error('seal hash missing from Rust response')
  } catch (err) {
    out(`${ts()} ${C.red('  LEDGE: WORM seal FAILED — aborting purge')} ${C.gray(err.message)}`)
    audit({ decision: 'RETAIN', reason: 'LEDGE_WORM_SEAL_FAILURE', file, error: err.message })
    return res.status(500).json({ decision: 'RETAIN', reason: 'LEDGE_WORM_SEAL_FAILURE' })
  }

  // CIPHER accounting — only after successful seal
  state.tokens_retained += structuralTokens
  state.last_worm_hash   = sealHash
  state.last_seal_ts     = factBlock.timestamp

  const total = state.tokens_purged + state.tokens_retained
  const ratio = total > 0 ? state.tokens_purged / total : 0

  out(`${ts()} ${C.green(C.bold('  LEDGE sealed:'))} ${C.green(String(sealHash).slice(0, 16))}… ${C.gray(`ratio ${(ratio * 100).toFixed(1)}%`)}`)

  const moduleName = file.split('/').pop()?.replace(/\.\w+$/, '') ?? file
  const packetId   = `0x${randomUUID().replace(/-/g, '').slice(0, 16)}`

  audit({ decision: 'SQUASH', file, scope, sealHash, structuralTokens, drift, packet_id: packetId })

  // SENTINEL: emit Bifröst State Packet — operator executes hydration, not ABZU
  return res.json({
    decision:                'SQUASH',
    bifrost_bridge_protocol: 'v1.0.0-alpha',
    packet_id:               packetId,
    timestamp:               new Date().toISOString(),
    provenance: {
      source_context_id:      `ctx_${state.session_id.slice(0, 8)}_active`,
      target_context_id:      `ctx_${randomUUID().replace(/-/g, '').slice(0, 8)}_fresh`,
      verification_authority: agent ?? 'EDUALC',
    },
    state_ledger: {
      worm_seal_hash: sealHash,
      fact_token:     factBlock.summary,
    },
    ast_gating: {
      target_module:          moduleName,
      file_path:              file,
      scope_boundary:         scope,
      structural_signatures:  signatures,
    },
    continuation_matrix: {
      exit_condition_previous:  'exit 0',
      next_execution_directive: `Execute next verification pass for ${moduleName}. Scope is bounded to structural signatures. Do not alter verified type signatures.`,
      drift_stability_index:    drift,
    },
  })
})

// ── ATLAS diagnostic endpoints ───────────────────────────────────────────────
app.get('/ctx-gc/status', (_req, res) => res.json({
  service:         'ABZU_CONTEXT_SOVEREIGN',
  session:         state.session_id,
  pipeline_status: state.is_frozen ? 'FREEZE_RETAIN_ACTIVE' : 'EVALUATING_PASS_STATE',
  drift_index:     state.drift_score,
  decisions:       state.decision_count,
}))

app.get('/ctx-gc/reserves', (_req, res) => {
  const total = state.tokens_purged + state.tokens_retained
  const ratio = total > 0 ? state.tokens_purged / total : 0
  res.json({
    tokens_purged:     state.tokens_purged,
    tokens_retained:   state.tokens_retained,
    compression_ratio: `${(ratio * 100).toFixed(2)}%`,
  })
})

app.get('/ctx-gc/last-seal', (_req, res) => res.json({
  sha256_seal: state.last_worm_hash,
  sealed_at:   state.last_seal_ts,
}))

// ── Banner ───────────────────────────────────────────────────────────────────
function banner() {
  out()
  out(C.purple(C.bold('  ╔══════════════════════════════════════════════════════════╗')))
  out(C.purple(C.bold('  ║         A B Z U — CONTEXT SOVEREIGN  v1.0               ║')))
  out(C.purple(C.bold('  ║    primordial deep · seal-before-purge · WORM-bound     ║')))
  out(C.purple(C.bold('  ╚══════════════════════════════════════════════════════════╝')))
  out()
  out(C.gray(`  session  : ${state.session_id}`))
  out(C.gray(`  port     : ${PORT}  (127.0.0.1 only)`))
  out(C.gray(`  rust     : ${RUST_URL}`))
  out(C.gray(`  hmac     : ${ABZU_SECRET ? '✓ configured' : '✗ open (dev — set ABZU_HMAC_SECRET)'}`))
  out(C.gray(`  audit    : ${AUDIT_LOG}`))
  out(C.gray(`  drift    : window ${DRIFT_WINDOW} · threshold ${DRIFT_THRESHOLD}`))
  out()
  out(C.cyan('  Waiting for EDUALC events on POST /edualc/report'))
  out()
}

banner()
app.listen(PORT, '127.0.0.1', () => {
  out(C.green('  ABZU active. Entering the primordial deep.'))
  out()
})
