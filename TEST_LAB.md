# SNAPKITTY TEST LAB
## Everything that happens in the test lab is recorded.

---

## SESSION 001 — 2026-05-30
### Bifrost Handoff Test | CLAUDE 2 Manual Execution

**Test type:** Manual Bifrost State Packet handoff
**Operator:** Jessica Westerhoff
**Packet ID:** `0x2a97530b69f64620`
**Seal:** `57771fd6491ab1fa1207a8132ff6777344cff71441fea09421807bfb0da67429`

**Setup:**
- ABZU running on port 7070
- EDUALC watching bridges/haskell/
- PASS event fired on `bridges/haskell/quantum_governance.hs`
- ABZU emitted Bifrost State Packet (SQUASH decision)
- Packet manually delivered to a fresh Claude.ai window (CLAUDE 2)

**CLAUDE 2 first action:**
Refused to accept the handoff framing at face value. Read the file directly.
*(This is correct SENTINEL behavior — zero trust, verify independently.)*

**CLAUDE 2 findings — all confirmed real bugs:**

| # | File | Bug | Severity |
|---|------|-----|----------|
| 1 | `bridges/haskell/quantum_governance.hs:67` | `governDecision` missing `%1->` — LinearTypes enabled but not enforced | HIGH |
| 2 | `bridges/haskell/quantum_governance.hs:69-75` | `t1 = t; t2 = t` misleading split — implies linearity violation | MEDIUM |
| 3 | `bridges/haskell/quantum_governance.hs:121` | `checkInvariants` lowercases text then checks for uppercase H in `"noitanicullaH"` — hallucination check silently always passes | HIGH |
| 4 | `bridges/haskell/quantum_governance.hs:2` | `{-# LANGUAGE QualifiedDo #-}` declared but unused | LOW |

**EDUALC missed all four.** Pass 3 (Hebrew RTL invariants) had no Haskell rule.

**Fixes applied:**

```
commit 5400556b
fix: quantum_governance.hs — 4 bugs found by CLAUDE 2 Bifrost handoff test
```

1. Added `%1->` annotation to `governDecision`
2. Removed misleading `t1 = t; t2 = t` — use `t` directly
3. Fixed `checkInvariants` — check `reversed` before lowercasing, not `lower`
4. Removed unused `QualifiedDo` pragma

**EDUALC Pass 3 expanded:**

New rule added to `scripts/edaulc.mjs`:
```javascript
// Haskell: LinearTypes declared but never enforced
if (ext === '.hs') {
  if (/\{-#\s*LANGUAGE\s+LinearTypes\s*#-\}/.test(content) && !/%1->/.test(content))
    return { pass: false, reason: 'Haskell LinearTypes enabled but no %1-> annotations found' }
}
```

**Test verdict:** BIFROST PROTOCOL PROVEN
- Fresh session received packet ✓
- Bounded scope honored ✓
- Real bugs found in < 60 seconds ✓
- No context drag from parent session ✓
- EDUALC expanded from findings ✓

**EDUALC would now catch Bug #1 on the original file.**
Bugs #2, #3, #4 require semantic analysis — candidates for future ERE passes.

---

## ERE PASS EXPANSION LOG

| Date | Pass | Language | Rule Added | Trigger |
|------|------|----------|------------|---------|
| 2026-05-29 | Pass 5 | TypeScript | Threshold 8→20 (tail window false positive) | Manual fix |
| 2026-05-30 | Pass 3 | Haskell | LinearTypes declared but no %1-> annotations | CLAUDE 2 Bifrost test |

---

## OPEN CANDIDATES (not yet in ERE)

| Bug Pattern | Language | Detection difficulty | Source |
|-------------|----------|---------------------|--------|
| Case mismatch after lowercase transform | Haskell | High — semantic | CLAUDE 2 session 001 |
| Unused language pragmas | Haskell | Medium — regex | CLAUDE 2 session 001 |
| `let x = val; y = val` (misleading duplicate bindings) | Haskell | Medium — AST | CLAUDE 2 session 001 |

---

*Test lab sealed. METATRON records. The chain holds.*
