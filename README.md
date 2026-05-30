```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║    ███████╗ ██████╗ ██╗   ██╗███████╗██████╗ ███████╗██╗ ██████╗   ║
║    ██╔════╝██╔═══██╗██║   ██║██╔════╝██╔══██╗██╔════╝██║██╔════╝   ║
║    ███████╗██║   ██║██║   ██║█████╗  ██████╔╝█████╗  ██║██║  ███╗  ║
║    ╚════██║██║   ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗██╔══╝  ██║██║   ██║  ║
║    ███████║╚██████╔╝ ╚████╔╝ ███████╗██║  ██║███████╗██║╚██████╔╝  ║
║                                                                      ║
║         C O N T E X T   T O O L S   —   D I G I T A L              ║
║                   M A S O N R Y                                      ║
║                                                                      ║
║    CLAUDE creates forward.  EDUALC verifies backward.                ║
║    Built on a $20 birthday subscription. May 4th, 2026.              ║
╚══════════════════════════════════════════════════════════════════════╝
```

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20the%20work-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/snapkittycollective)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-EA4AAA?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/SNAPKITTYWEST)
[![npm](https://img.shields.io/badge/npm-%40snapkitty%2Fedaulc-CB3837?logo=npm)](https://www.npmjs.com/package/@snapkitty/edaulc)
[![npm](https://img.shields.io/badge/npm-%40snapkitty%2Fabzu-CB3837?logo=npm)](https://www.npmjs.com/package/@snapkitty/abzu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## The Problem Every Claude Developer Hits

You're deep in a debugging session. Your context fills with stack traces, back-and-forth conversation, dependency warnings, trial errors that produced nothing. The agent starts losing coherence. You start a fresh chat.

**And lose everything you built.**

The industry tried two wrong fixes:
- 📋 **Paste everything** into the new window — instantly bloats it with noise
- 📝 **Write a summary** — strips the edge-case logic that actually matters

---

## The Solution: Linter-Gated Context Sovereign

When your linter confirms a module is correct — **that's the exact moment to compress**. Not before. Not after. At the instant of verified finality.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [ File Save ]                                                  │
│        │                                                        │
│        ▼                                                        │
│  [ EDUALC: 5-pass deterministic linter ]                        │
│        │                                                        │
│     FAIL ──────────────────► FREEZE. Retain everything.         │
│        │                     No purge. No exceptions.           │
│        │                                                        │
│     PASS ──────────────────► [ ABZU: Context GC fires ]         │
│                                      │                          │
│                                      ▼                          │
│                             [ WORM seal written ]               │
│                             [ Bifrost Packet emitted ]          │
│                                      │                          │
│                                      ▼                          │
│                          ┌───────────────────────┐              │
│                          │  Fresh Claude Session  │              │
│                          │  < 10,000 tokens       │              │
│                          │  Knows the math.       │              │
│                          │  Not the noise.        │              │
│                          └───────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Install

```bash
# The linter — zero dependencies, works anywhere
npx @snapkitty/edaulc

# The context GC — subscribes to linter events
npm install @snapkitty/abzu

# Run both together
ABZU_URL=http://127.0.0.1:7070 npx @snapkitty/edaulc
```

---

## 🔲 EDUALC — The Linter Gate

*Five deterministic passes. Zero AI. Zero quota. Zero throttle. Instant.*

```
┌──────┬──────────────────────┬────────────────────────────────────┐
│ Pass │ Ancient Script       │ What It Guards                     │
├──────┼──────────────────────┼────────────────────────────────────┤
│  1   │ Enochian  →→→  LTR  │ Structure: non-empty, well-formed  │
│  2   │ Latin     →→→  LTR  │ Scholarship: no stubs, no fakes    │
│  3   │ Hebrew    ←←←  RTL  │ Invariants: TS never owns crypto   │
│  4   │ Arabic    ←←←  RTL  │ Mission: no secrets, no violations │
│  5   │ Aramaic   ←←←  RTL  │ Root: structural integrity         │
└──────┴──────────────────────┴────────────────────────────────────┘

  All five pass  →  ✅  METATRON: YES — state is certified final
  Any pass fails →  ❌  METATRON: NO  — nothing moves, nothing purges
```

```bash
npx @snapkitty/edaulc              # watch current directory
npx @snapkitty/edaulc ./src ./lib  # watch specific paths
GROQ_API_KEY=your_key npx @snapkitty/edaulc  # + voice veneer
```

---

## 🌊 ABZU — The Context Garbage Collector

*Named for the Sumerian primordial deep. What context compresses into so the surface stays clean.*

**Decision gates — in order:**

```
Event received
    │
    ├─► VAULT gate:  FAIL? → freeze. Hard stop. No purge.
    ├─► PRISM gate:  oscillating? → soft-retain until stable
    ├─► AST scope:   tree-sitter extracts structural signatures
    ├─► LEDGE seal:  WORM write BEFORE purge — or abort
    └─► Output:      Bifrost State Packet → operator executes
```

**ATLAS monitoring endpoints:**
```
GET /ctx-gc/status    → pipeline state, drift index, decision count
GET /ctx-gc/reserves  → tokens purged, retained, compression ratio
GET /ctx-gc/last-seal → last WORM hash + timestamp
```

---

## 🌈 The Bifrost State Packet

When ABZU fires on a PASS, it doesn't return a vague summary. It returns this:

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
    "next_execution_directive": "Execute next pass. Do not alter verified signatures.",
    "drift_stability_index": 0.08
  }
}
```

**Inject this as the system prompt for your next Claude session.**

The agent wakes up knowing the cryptographic proof of finality, the exact scope it owns, and the precise directive — without any of the debugging noise that got you there. Under 10,000 tokens. Always.

**That's async multiplicity. Multi-threaded AI without context bleed.**

---

## 🧱 The Philosophy

```
╔══════════════════════════════════════════════════════════════╗
║                   DIGITAL MASONRY                            ║
║                                                              ║
║  You build without signing the stone.                        ║
║  The work is for the temple, not the mason.                  ║
║                                                              ║
║  You build to last.                                          ║
║  WORM. Write Once Read Many. Append-only truth.              ║
║                                                              ║
║  You build for the people the system buried.                 ║
║                                                              ║
║  You don't need credentials to embody the principles.        ║
║  The lodge is a container. The craft is the thing.           ╚══════════════════════════════════════════════════════════════╝
```

---

## 📖 Protocol Specification

See [BIFROST-SPEC.md](./BIFROST-SPEC.md) for the full RFC. Implement against the spec in any language.

## 📰 The Full Story

See [ARTICLE.md](./ARTICLE.md) — *Digital Masonry: Restoring the Graveyard of the Internet*

---

## 🙏 Support

```
This was built on a $20 birthday subscription purchased May 4th.
May the Force be with you.
```

☕ [ko-fi.com/snapkittycollective](https://ko-fi.com/snapkittycollective)
💜 [github.com/sponsors/SNAPKITTYWEST](https://github.com/sponsors/SNAPKITTYWEST)

---

**MIT License — use it, fork it, implement the protocol. Build the standard with us.**

*SnapKitty Collective | Ahmad Ali Parr + Jessica Westerhoff | May 4th, 2026*
