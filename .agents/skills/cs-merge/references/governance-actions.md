# Touched-Slice Governance Actions & Anti-Slop Rules

`/cs-merge` is the **sole skill responsible for routing and curating Living Knowledge**. It prevents Living Knowledge from decaying into an append-only graveyard of stale warnings, contradicted rules, and code restatements. Apply the Context Minimization Principle (CMP) to documentation itself: **every line in Living Knowledge must earn its context cost for future modifiers.**

## Strict Scope: Touched Knowledge Slice Only

Determine the Touched Knowledge Slice from:
1. Header `Related Living Knowledge` of `<changes-dir>/<change-id>.md`;
2. `Section 4.2 (Touched Knowledge Slice)` and `Section 4.3 (Trace Clues)` recorded by `/cs-reflect`;
3. Registered `.cstack/index.md` entries that cover the domain concepts (Section 2), product behaviors (Section 3), or architectural modules touched by the final `git diff`.

Read **only** those files/sections. Never scan untouched Living Knowledge directories during `/cs-merge`—frequently modified areas stay clean continuously, while cold areas cost zero review attention.

---

## 1. `ADD` — Minimal Current-State Truth & Why

**When to propose**:
- Confirmed new domain concepts, invariants, or terminology distinctions (from Section 2, reconciled with `4.3 Spec Deviations`);
- Realized external product behaviors, role boundaries, or non-obvious edge rules (from Section 3 + final diff);
- Established Greenfield or redesigned visual direction, aesthetic guardrails, and semantic Design Token routing (into canonical `DESIGN.md` or UI docs registered in `.cstack/index.md` so subsequent Brownfield tasks inherit the visual baseline);
- Durable new structural routes, Use Cases, Ports, or State/Cache Owners (`4.3 Structural Routes`) in a registered Architecture Map;
- Non-obvious constraints or *Why* uncovered during execution (`4.3 Spec Deviations & Hidden Why`).

**Anti-Slop Guardrails (`P1: Knowledge belongs where it is best expressed`)**:
- **Never restate code**: Do not document function signatures, class fields, file-by-file diffs, or control flow already readable from code and types.
- **Write current state, not history**: Integrate facts directly into the canonical prose/table as present-tense truth. Never append dated changelog blurbs (*"In PR #42 we changed X to Y"*—that belongs to `git log`).
- **Bootstrap lazily on Greenfield**: If `.cstack/index.md` has no suitable Living Knowledge target yet and a durable domain/behavior truth must survive Change file deletion, propose creating **one** minimal user-named file (e.g., `docs/domain.md` or `GLOSSARY.md`) and registering it in `.cstack/index.md`—never scaffold empty doc trees.

---

## 2. `RESOLVE` — Conflict Arbitration

**When to propose**:
- A Living Knowledge statement contradicts the final shipped code or tests (`4.2 Contradicted / Stale`, `4.3 Contradicted Claims`);
- Two Living Knowledge rules contradict each other within the touched slice;
- A human edited the touched Living Knowledge file directly while the Change was in flight, creating divergence with the Change's realized behavior.

**Required format**:
- Show **Existing Doc Claim** vs. **Final Code / New Reality** (with exact file/line evidence);
- State a clear **Recommended Verdict** (update doc to match code, keep human edit, or flag unexpected code regression);
- Require explicit human decision before editing.

---

## 3. `COMPRESS` — Consolidate Exceptions & Sink to Code

**When to propose**:
- Adding a new note or exception leaves a touched section with **3+ piecemeal caveats, edge-case footnotes, or layered patches** (`4.3 Exception Hotspots`);
- Multiple bullets repeat variations of one underlying domain rule;
- A prose paragraph acts as a fragile manual checklist that could be enforced mechanically (`CMP Check`).

**Execution rule**:
- Rewrite the cluttered passage into a **single tighter domain principle or compact decision table** with lower reading cost than the prior text;
- Where a rule can be enforced by a type, unit/contract test, or linter/dependency check, note the downward-sinking opportunity alongside the compressed text.

---

## 4. `PRUNE` — Evidence-Verified Subtraction

Propose `PRUNE` (direct deletion of a bullet, paragraph, or obsolete doc entry) **only** when verified against the final `git diff` and current codebase under one of these three criteria:

1. **Obsolete / Dead (`失效`)**:
   - References deleted modules, removed feature flags, retired workflows, or domain states eliminated by the change.
2. **Contradicted & Superseded (`矛盾`)**:
   - Old rule superseded once a `RESOLVE` conflict or new Product Spec replaces it.
3. **Internalized into Code (`已被代码内化`)**:
   - Prose guardrails that existed only to compensate for missing structure (e.g., *"When editing A, always update B"*, *"Callers must normalize X before calling Y"*, `4.3 Code-Internalized Guardrails`) where the final code now enforces the invariant mechanically via encapsulation, static types/exhaustive unions, contract/unit tests, or lint/dependency checks. Once code expresses it reliably, keeping the prose creates future drift risk—delete it.
   - *Guardrail*: Fragile visual/CSS layout preconditions (e.g., stacking context, `overflow`, or sticky-scroll invariants) and ungenerated cross-repo contract rules that are **not** mechanically guarded by types, lints, or automated E2E/visual tests are **not** `Code-Internalized` merely because current styling renders properly—preserve them as concise local `Semantic Comments` or Living Knowledge.

**Safety check**: If a `4.3 Code-Internalized Guardrails` clue relied on a refactor that was later reverted before merge, **do not prune**—downgrade or drop the proposal and explain why.

---

## 5. `REMIND` — Confirm-First Advisory (Non-Destructive by Default)

Not every noisy doc is dead. When `Section 4.2` flags **`Read & Unused (Zero-Utility)`**—or you spot an overly broad doc entry in the touched slice—that is **not** proven obsolete, contradicted, or internalized into code:

- **Do NOT include it in automatic `PRUNE` proposals** (it may still govern sibling features or workflows not exercised by this Change).
- Present it under **Advisory Reminders (`[A-*]`)** explaining:
  1. Why the agent loaded it without benefit (e.g., coarse routing description in `.cstack/index.md`, mixed-concern document, or potentially stale guidance whose obsolescence cannot be proven from this Change alone);
  2. Lightweight options: `keep as-is`, `narrow routing description in .cstack/index.md`, `split section`, or `prune`.
- **Modify or prune `[A-*]` items ONLY if the user explicitly opts in.**
