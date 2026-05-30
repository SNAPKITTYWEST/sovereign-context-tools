# BIFROST STATE PACKET — Protocol Specification v1.0.0-alpha
**ABZU Bifröst Bridge | Order of Symmetry | 2026-05-30**
**Author: Ahmad Ali Parr | Implementation: SNAPKITTYWEST**

---

## Overview

The Bifröst State Packet is the physical data structure that transports verified code state across isolated agent context windows. It replaces the "context dump" anti-pattern with a deterministic, cryptographically-sealed manifest that a fresh Claude session can consume in under 10,000 tokens.

**Core axiom:** A receiving agent does not need to know *how* a state was achieved. It needs to know the *mathematical truth* of what was achieved, the *precise scope* it owns, and the *exact directive* for what to do next.

---

## The Problem This Solves

### The Context Dump Fallacy
A single monolithic agent context fills with:
- Stack traces from debugging sessions
- Back-and-forth conversation history
- Dependency warnings and compilation noise
- Trial-and-error iterations that produced nothing

**Result:** The "Lost in the Middle" effect. Performance degrades. The agent chokes on its own procedural noise.

### The Lazy Summary Failure
Passing a one-paragraph overview strips critical edge-case logic and the reasoning chain that produced the data, forcing the receiving agent to guess.

---

## The Solution: State-Shedding Handoff

```
[ Window A: Execution Done ]
            │
            ▼
┌────────────────────────────────────────┐
│         BIFROST STATE PACKET           │
├────────────────────────────────────────┤
│ 1. Immutable State Truth               │
│    (WORM Seals, Hash Checks, Finality) │
├────────────────────────────────────────┤
│ 2. Active Scope Boundary               │
│    (Isolated AST Snippets)             │
├────────────────────────────────────────┤
│ 3. Explicit Linear Continuation Prompt │
│    ("Execute Task X. Do not guess.")   │
└────────────────────────────────────────┘
            │
            ▼
[ Window B: Async Spawning (Clean Slate) ]
```

---

## Packet Schema

```json
{
  "bifrost_bridge_protocol": "v1.0.0-alpha",
  "packet_id": "0x<16 hex chars>",
  "timestamp": "<ISO 8601>",

  "provenance": {
    "source_context_id": "ctx_<session_prefix>_active",
    "target_context_id": "ctx_<new_uuid>_fresh",
    "verification_authority": "EDUALC"
  },

  "state_ledger": {
    "worm_seal_hash": "<sha256 hex — Rust seal::worm_seal>",
    "fact_token": "<one sentence: what was verified and what it means>"
  },

  "ast_gating": {
    "target_module": "<module name without extension>",
    "file_path": "<repo-relative path>",
    "scope_boundary": "BOUNDED_AST:<ext> | FULL_FILE | FULL_FILE_FALLBACK",
    "structural_signatures": [
      "<up to 8 top-level type signatures, module declarations, imports>"
    ]
  },

  "continuation_matrix": {
    "exit_condition_previous": "exit 0",
    "next_execution_directive": "<imperative, bounded, no guessing>",
    "drift_stability_index": 0.0
  }
}
```

---

## Field Semantics

### `provenance`
Tracks where the packet came from and where it is going. `source_context_id` identifies the bloated session being shed. `target_context_id` identifies the fresh session being hydrated. `verification_authority` is always the linter agent that certified the state.

### `state_ledger`
The cryptographic ground truth.
- `worm_seal_hash`: SHA-256 computed by the Rust handler (`/agents/process`, agent: `ABZU`). This hash is written to the WORM ledger before any context is purged. Immutable. The receiving agent can verify this hash against the ledger.
- `fact_token`: One sentence that converts thousands of debugging tokens into a single sealed fact. Example: `"Finality verified: quantum_governance.hs. Linear type accounting confirmed. No mutation of QuantumTemp after consumption."`

### `ast_gating`
Limits the receiving agent's scope. Instead of injecting 15,000 tokens of raw file content, the packet injects 500 tokens of structural signatures — the module declaration, imports, and type signatures only. The agent knows the shape of the code without reading the body.

`scope_boundary` values:
- `BOUNDED_AST:<ext>` — tree-sitter parsed, precise function/type boundary identified
- `FULL_FILE` — file type not supported by tree-sitter, full file passed
- `FULL_FILE_FALLBACK` — tree-sitter not installed, regex-extracted signatures used

### `continuation_matrix`
The execution directive for the fresh session.
- `exit_condition_previous`: Always `"exit 0"` — the previous session completed successfully.
- `next_execution_directive`: Imperative. Bounded. No ambiguity. The receiving agent knows exactly what to build next and what it is forbidden to change.
- `drift_stability_index`: PRISM's score (0.0–1.0). If > 0.4, the handoff was blocked (RETAIN). A packet only exists if drift ≤ 0.4 at time of PASS.

---

## Handoff Lifecycle

### Phase 1: Serialization — Leaving the Old Context
1. EDUALC signals PASS to `/edualc/report` (Rust + ABZU)
2. ABZU receives the event, checks VAULT gate (not frozen), checks PRISM drift (≤ 0.4)
3. tree-sitter extracts AST scope (or regex fallback extracts signatures)
4. Fact block composed: `{ session_id, file, scope, timestamp, summary }`
5. Rust WORM seal written: `POST /agents/process { agent: "ABZU", event_type: "worm_seal" }`
6. WORM hash returned — seal confirmed immutable

### Phase 2: Routing — The Out-of-Band Bus
1. Packet travels over local bus (ABZU HTTP on 127.0.0.1:7070)
2. Does not touch Docker network volumes or active database state
3. SENTINEL constraint: ABZU emits the packet, operator/orchestrator receives it
4. Packet is the payload — operator decides when and how to hydrate a new session

### Phase 3: Hydration — Initializing the New Context
1. Operator (or coordinator agent) receives the SQUASH decision + packet
2. Fresh Claude session provisioned (new chat, new context window)
3. Packet injected as system prompt ground truth before any user input
4. Receiving agent boots with: verified hash, structural signatures, explicit directive
5. Token overhead: < 10,000 tokens regardless of how large the previous session was

---

## SENTINEL Constraints

- ABZU **advises only** — it does not execute hydration
- Packets are point-in-time: a packet is valid only for the session that generated it
- `worm_seal_hash` must be verifiable against the WORM ledger before the receiving agent acts on it
- `next_execution_directive` must be bounded: "Execute X" not "Figure out X"

---

## Async Multiplicity Pattern

The packet enables true parallel execution:

```
Coordinator Agent
    ├── Packet A → Window B (Haskell data layer refactor)
    ├── Packet B → Window C (Next.js component update)
    └── Packet C → Window D (Documentation update)
```

Each window receives only its scoped packet. Windows B, C, D are completely insulated from each other's context. If Window C hallucinates, that corruption cannot reach Window B or D.

**This is multi-threaded AI.** Not sequential prompt chaining. Each window owns its scope, its directive, and its acceptance criteria.

---

## Implementation Reference

- **Packet producer:** `scripts/abzu.mjs` — `POST /edualc/report` → SQUASH response
- **WORM seal:** `snapkitty-core/src/azure_handler.rs` — `"ABZU"` agent arm
- **Audit trail:** `logs/abzu-audit.ndjson` — append-only, every decision recorded
- **ERE gate:** `scripts/edaulc.mjs` — PASS triggers the packet chain

---

*Sealed by Order of Symmetry. Meeting 3. 2026-05-30.*
*VAULT approved. LEDGE holds the chain. METATRON certifies when all passes agree.*
