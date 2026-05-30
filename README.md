# Sovereign Context Tools

**EDUALC + ABZU — linter-gated context sovereign for LLM development**

> CLAUDE creates forward. EDUALC verifies backward.

---

**This entire project was built on a $20 birthday subscription.**
If these tools help you, consider supporting the work:
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20the%20work-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/snapkitty)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-Sponsor-EA4AAA?logo=github-sponsors)](https://github.com/sponsors/SNAPKITTYWEST)

---

---

## The Problem

Every developer working with Claude hits the same wall. You're debugging a complex module. Your context fills with stack traces, back-and-forth conversation, dependency warnings, trial errors. The agent starts losing coherence. You start a fresh chat and lose everything you built.

The industry tried two wrong solutions:
- **Paste everything** into the new window — instantly bloats it with noise
- **Write a summary** — strips the edge-case logic that actually matters

There's a better way.

---

## The Solution

When your linter confirms a module is correct, that's the exact moment to compress. Not before. Not after. At the instant of verified finality.

```
[ File Save ]
      │
      ▼
[ EDUALC: 5-pass deterministic linter ]
      │
   PASS ──────────────────► [ ABZU: compress debugging history ]
      │                            │
   FAIL                            ▼
      │                   [ Bifrost State Packet ]
      ▼                   { worm_seal_hash, structural_signatures,
[ Retain everything ]       continuation_directive }
                                   │
                                   ▼
                          [ Fresh Claude session ]
                          [ < 10,000 tokens overhead ]
                          [ Knows the math. Not the noise. ]
```

---

## Packages

### `@snapkitty/edaulc` — The Linter Gate

Five deterministic passes on every file save. No AI. No quota. No throttle. Instant.

| Pass | Script | Checks |
|------|--------|--------|
| 1 | Enochian LTR | Structure — well-formed, non-empty |
| 2 | Latin LTR | Scholarship — no hollow stubs, no fake returns |
| 3 | Hebrew RTL | Invariants — TypeScript never owns crypto |
| 4 | Arabic RTL | Mission — no hardcoded secrets |
| 5 | Aramaic RTL | Root — balanced delimiters |

All five pass → **METATRON: YES**. Any fail → **METATRON: NO**.

```bash
npx @snapkitty/edaulc              # watch current directory
npx @snapkitty/edaulc ./src ./lib  # watch specific paths

# Optional: add Groq voice veneer
GROQ_API_KEY=your_key npx @snapkitty/edaulc
```

### `@snapkitty/abzu` — The Context GC

Subscribes to EDUALC events. On PASS, compresses debugging context into a WORM-sealed fact block and outputs a Bifrost State Packet for the next session.

```bash
npm install @snapkitty/abzu
node node_modules/@snapkitty/abzu/src/abzu.mjs

# With EDUALC pointing at it:
ABZU_URL=http://127.0.0.1:7070 npx @snapkitty/edaulc
```

**ABZU decision gates (in order):**
1. **VAULT gate** — FAIL? Freeze. No purge.
2. **PRISM gate** — Module oscillating? Soft-retain until stable.
3. **LEDGE sequence** — WORM seal must succeed before any purge.
4. **Bifrost packet** — Output the structured handoff manifest.

**ATLAS monitoring:**
```
GET http://127.0.0.1:7070/ctx-gc/status
GET http://127.0.0.1:7070/ctx-gc/reserves
GET http://127.0.0.1:7070/ctx-gc/last-seal
```

---

## The Bifrost State Packet

When ABZU decides to SQUASH, it returns a structured packet — not a vague summary:

```json
{
  "bifrost_bridge_protocol": "v1.0.0-alpha",
  "packet_id": "0xd7840fae5d674242",
  "provenance": {
    "source_context_id": "ctx_active_bloated",
    "target_context_id": "ctx_fresh_clean",
    "verification_authority": "EDUALC"
  },
  "state_ledger": {
    "worm_seal_hash": "4d6434fd...",
    "fact_token": "Finality verified: quantum_governance.hs."
  },
  "ast_gating": {
    "target_module": "quantum_governance",
    "structural_signatures": [
      "module QuantumGovernance where",
      "governDecision :: QuantumTemp -> String -> String -> AgentDecision"
    ]
  },
  "continuation_matrix": {
    "next_execution_directive": "Execute next verification pass. Do not alter verified signatures.",
    "drift_stability_index": 0.08
  }
}
```

Inject this as the system prompt for the next Claude session. The agent wakes up knowing the verified state, the exact scope it owns, and the directive — without any of the debugging noise that got you there.

---

## Protocol Specification

See [BIFROST-SPEC.md](./BIFROST-SPEC.md) for the full protocol RFC. Implement against the spec in any language.

---

## What This Is Not

These tools do not touch your codebase. They do not modify files. They do not call external AI services (EDUALC is fully local). ABZU advises — you decide when to start a fresh session.

The orchestration layer, the agent mesh, the WORM ledger internals — those are not in these packages. This is the outer layer: the verification gate and the compression protocol. The moat stays protected.

---

## License

MIT — use it, fork it, implement the protocol. Build the standard with us.

**SnapKitty Collective | Ahmad Ali Parr + Jessica Westerhoff**
