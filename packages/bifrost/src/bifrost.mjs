#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// BIFROST — Context Handoff Orchestrator  v1.0
// @snapkitty/bifrost
//
// The third layer of the Digital Masonry stack:
//
//   EDUALC  →  verifies code (linter gate)
//   ABZU    →  compresses context on PASS (Bifrost packet output)
//   BIFROST →  executes handoff (spawns fresh Claude, injects packet)
//
// When ABZU emits a SQUASH decision with a Bifrost State Packet,
// BIFROST receives it, builds a clean system prompt from verified state,
// and provisions a fresh Claude session under 10,000 tokens.
//
// True async multiplicity: multiple isolated Claude windows, each
// carrying only verified state, each working in parallel.
//
// Architecture:
//   ABZU POST /bifrost/handoff  →  spawn session  →  return session_id
//   GET /bifrost/sessions       →  list all active sessions
//   POST /bifrost/continue      →  continue a session with next message
//   GET /bifrost/session/:id    →  get session state
//
// Launch: node src/bifrost.mjs
// Env vars:
//   ANTHROPIC_API_KEY  — required (your Claude API key)
//   BIFROST_PORT       — default 7071
//   BIFROST_MODEL      — default claude-sonnet-4-6
//   ABZU_URL           — default http://127.0.0.1:7070 (for health checks)
// ═══════════════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk'
import express   from 'express'
import { randomUUID } from 'crypto'

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
const PORT   = parseInt(process.env.BIFROST_PORT  ?? '7071')
const MODEL  = process.env.BIFROST_MODEL           ?? 'claude-sonnet-4-6'
const API_KEY = process.env.ANTHROPIC_API_KEY      ?? ''

if (!API_KEY) {
  out(C.red('  ✗ ANTHROPIC_API_KEY not set — BIFROST cannot spawn sessions'))
  out(C.gray('    Set ANTHROPIC_API_KEY=your_key and restart'))
  process.exit(1)
}

const client = new Anthropic({ apiKey: API_KEY })

// ── Session store ─────────────────────────────────────────────────────────────
// Each session: { id, packet, systemPrompt, messages[], status, created, tokens }
const sessions = new Map()

// ── Build system prompt from Bifrost State Packet ─────────────────────────────
function buildSystemPrompt(packet) {
  const sigs = (packet.ast_gating?.structural_signatures ?? [])
    .map(s => `  ${s}`).join('\n')

  const drift = packet.continuation_matrix?.drift_stability_index ?? 0
  const driftStatus = drift < 0.2 ? 'STABLE' : drift < 0.4 ? 'NOMINAL' : 'CAUTION'

  return `# BIFROST HANDOFF — FRESH SESSION

You are a fresh Claude instance provisioned via the Bifrost Context Handoff Protocol.
You do NOT have the previous session's conversation history.
You have only the verified facts sealed below. Work from these facts only.

## Verified State
Seal: ${packet.state_ledger?.worm_seal_hash ?? 'none'}
Fact: ${packet.state_ledger?.fact_token ?? 'none'}

## Your Scope
Module:   ${packet.ast_gating?.target_module ?? 'unknown'}
File:     ${packet.ast_gating?.file_path ?? 'unknown'}
Boundary: ${packet.ast_gating?.scope_boundary ?? 'FULL_FILE'}

## Structural Signatures (verified — do not alter)
${sigs || '  (none provided)'}

## Your Directive
${packet.continuation_matrix?.next_execution_directive ?? 'Await instruction.'}

## Constraints
- Work only within the scoped module boundary above
- Do not alter the verified structural signatures
- Do not ask about the previous session's history — it has been sealed
- Drift index: ${drift} (${driftStatus}) — code stability confirmed at handoff
- Packet: ${packet.packet_id ?? 'unknown'} | Authority: ${packet.provenance?.verification_authority ?? 'EDUALC'}`
}

// ── Estimate token count (rough: 4 chars ≈ 1 token) ──────────────────────────
function estimateTokens(text) {
  return Math.ceil((text ?? '').length / 4)
}

// ── Express app ───────────────────────────────────────────────────────────────
const app = express()
app.use(express.json({ limit: '128kb' }))

// ── POST /bifrost/handoff — receive packet from ABZU, spawn session ───────────
app.post('/bifrost/handoff', async (req, res) => {
  const packet = req.body

  // Validate
  if (!packet?.bifrost_bridge_protocol) {
    return res.status(400).json({ error: 'invalid packet: missing bifrost_bridge_protocol' })
  }
  if (!packet?.state_ledger?.worm_seal_hash) {
    return res.status(400).json({ error: 'invalid packet: missing worm_seal_hash — LEDGE requires seal before handoff' })
  }

  const sessionId  = packet.provenance?.target_context_id ?? `ctx_${randomUUID().slice(0, 8)}_fresh`
  const systemPrompt = buildSystemPrompt(packet)
  const directive    = packet.continuation_matrix?.next_execution_directive ?? 'Begin.'
  const systemTokens = estimateTokens(systemPrompt)

  out(`${ts()} ${C.purple('◈')} BIFROST ← packet ${C.bold(packet.packet_id ?? 'unknown')}`)
  out(`${ts()}   ${C.cyan('→')} spawning session ${C.bold(sessionId)}`)
  out(`${ts()}   ${C.gray(`system prompt: ~${systemTokens} tokens`)}`)

  try {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 8096,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: directive }],
    })

    const reply      = response.content[0]?.text ?? ''
    const totalTokens = systemTokens + estimateTokens(directive) + estimateTokens(reply)

    sessions.set(sessionId, {
      id:           sessionId,
      packet,
      systemPrompt,
      messages:     [
        { role: 'user',      content: directive },
        { role: 'assistant', content: reply },
      ],
      status:       'active',
      created:      new Date().toISOString(),
      tokens_used:  totalTokens,
    })

    out(`${ts()} ${C.green(C.bold('  BIFROST: session hydrated'))} ${C.gray(`~${totalTokens} tokens`)}`)

    return res.json({
      session_id:           sessionId,
      packet_id:            packet.packet_id,
      status:               'hydrated',
      fresh_context_tokens: totalTokens,
      model:                MODEL,
      first_response:       reply,
    })
  } catch (err) {
    out(`${ts()} ${C.red('  BIFROST: spawn failed')} ${C.gray(err.message)}`)
    return res.status(500).json({ error: 'spawn_failed', message: err.message })
  }
})

// ── POST /bifrost/continue — continue an existing session ─────────────────────
app.post('/bifrost/continue', async (req, res) => {
  const { session_id, message } = req.body
  if (!session_id || !message) {
    return res.status(400).json({ error: 'session_id and message required' })
  }

  const session = sessions.get(session_id)
  if (!session) {
    return res.status(404).json({ error: 'session not found' })
  }

  out(`${ts()} ${C.cyan('◈')} BIFROST continue → ${C.bold(session_id)}`)

  try {
    session.messages.push({ role: 'user', content: message })

    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 8096,
      system:     session.systemPrompt,
      messages:   session.messages,
    })

    const reply = response.content[0]?.text ?? ''
    session.messages.push({ role: 'assistant', content: reply })
    session.tokens_used += estimateTokens(message) + estimateTokens(reply)

    return res.json({ session_id, reply, tokens_used: session.tokens_used })
  } catch (err) {
    return res.status(500).json({ error: 'continue_failed', message: err.message })
  }
})

// ── GET /bifrost/sessions — list all active sessions ─────────────────────────
app.get('/bifrost/sessions', (_req, res) => {
  const list = [...sessions.values()].map(s => ({
    id:          s.id,
    status:      s.status,
    module:      s.packet?.ast_gating?.target_module ?? 'unknown',
    tokens_used: s.tokens_used,
    created:     s.created,
    turns:       Math.floor(s.messages.length / 2),
  }))
  res.json({ sessions: list, count: list.length, model: MODEL })
})

// ── GET /bifrost/session/:id — get full session state ────────────────────────
app.get('/bifrost/session/:id', (req, res) => {
  const session = sessions.get(req.params.id)
  if (!session) return res.status(404).json({ error: 'not found' })
  res.json({
    id:          session.id,
    status:      session.status,
    tokens_used: session.tokens_used,
    created:     session.created,
    turns:       Math.floor(session.messages.length / 2),
    packet_id:   session.packet?.packet_id,
    module:      session.packet?.ast_gating?.target_module,
    messages:    session.messages,
  })
})

// ── DELETE /bifrost/session/:id — close a session ────────────────────────────
app.delete('/bifrost/session/:id', (req, res) => {
  const existed = sessions.delete(req.params.id)
  if (!existed) return res.status(404).json({ error: 'not found' })
  out(`${ts()} ${C.gray(`  session ${req.params.id} closed`)}`)
  res.json({ closed: req.params.id })
})

// ── Banner ────────────────────────────────────────────────────────────────────
out()
out(C.purple(C.bold('  ╔══════════════════════════════════════════════════════════╗')))
out(C.purple(C.bold('  ║      B I F R O S T — HANDOFF ORCHESTRATOR  v1.0         ║')))
out(C.purple(C.bold('  ║   async multiplicity · clean slate · < 10k tokens       ║')))
out(C.purple(C.bold('  ╚══════════════════════════════════════════════════════════╝')))
out()
out(C.gray(`  model  : ${MODEL}`))
out(C.gray(`  port   : ${PORT}`))
out(C.gray(`  key    : ${API_KEY ? '✓ loaded' : '✗ missing'}`))
out()
out(C.cyan('  Endpoints:'))
out(C.gray('    POST /bifrost/handoff       ← receive packet from ABZU'))
out(C.gray('    POST /bifrost/continue      ← continue a session'))
out(C.gray('    GET  /bifrost/sessions      ← list active sessions'))
out(C.gray('    GET  /bifrost/session/:id   ← get session state'))
out(C.gray('    DEL  /bifrost/session/:id   ← close session'))
out()

app.listen(PORT, '127.0.0.1', () => {
  out(C.green(`  BIFROST active. The bridge is open.`))
  out()
})
