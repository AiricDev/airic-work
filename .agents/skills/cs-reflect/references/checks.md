# Reflection Checks & Ephemeral Trace Clues

## Common Decision Rule

Return `found` **only** when both are present:
1. Concrete trace or artifact evidence.
2. A plausible future modification failure caused by that evidence.

The live task context is concrete trace evidence; no external log or repeated search is needed to establish an event the agent just experienced (though `.cstack/friction.log`, when present, can supply episodic evidence after compaction or handoff). Return `not-found` when the available route supports the intended design. Return `unknown` when trace coverage is insufficient. Do not treat repository size, a wide search, many touched files, or passing tests as sufficient evidence by themselves.

Every actionable `found` check produces a structured **`[R-*]` Refactor Proposal** specifying symptom, CMP root cause, concrete refactor route, authority level (`how-level | what-level`), and recommended disposition (`fix now` in `/cs-reflect` vs. `defer-to-followup` to avoid PR scope creep).

## 1. Missing Path

**Question**: Was context that should have been reachable through an established route unnecessarily hard to find?

Evidence includes:
- A relevant helper, schema, UI primitive, query key, test, registry, or implementation was found only after avoidable broad searching.
- Related artifacts had to change together (including mutation → query-cache invalidation closures, URL search-param ↔ view state bindings, theme/i18n token sets, or ungenerated Backend ↔ Frontend contract seams) but were not connected by naming, placement, imports, key factories, tests, Semantic Comments / Closure Indexes, or an Architecture Map.
- A misleading route pointed to the wrong owner or almost caused an existing capability or UI primitive to be reimplemented.
- The same sibling location was missed more than once during the task.

Do not fire when the modification closure is broad by nature and the architecture already makes its consumers discoverable.

**Future risk**: A later modifier omits a sibling change or duplicates an existing implementation.

Allowed **how-level** refactor responses (when an existing destination or convention is clear):
- Correct a misleading symbol/file name or stale pointer in code/tests.
- Add a Semantic Comment / Modification Closure Index pointing to an existing canonical implementation or sibling co-change site.
- Improve a focused test name or co-locate a small item in an already-established conventional location.
- *(Note: If a durable structural route needs recording in an Architecture Map or Living Knowledge doc, note it under `4.3 Structural Routes` for `/cs-merge` rather than editing Living Knowledge during `/cs-reflect`.)*

Creating a new registry, shared abstraction, or ownership rule is **what-level** (present options and CMP trade-offs for human decision before refactoring).

## 2. Boundary Bypass

**Question**: Did the change bypass, duplicate, or weaken an established boundary?

Evidence includes:
- A layer accessed private state, low-level details, or another layer/feature's internal type.
- Code bypassed an existing service, port, adapter, repository, validator, policy, state machine, query-cache adapter, Design System primitive/token, or cross-end API contract (including style drift on Brownfield UI: hardcoded hex colors, rogue fonts, arbitrary radii/shadows, or nested card-in-card template slop bypassing `DESIGN.md` / semantic tokens).
- Raw backend transport DTOs penetrated deep into UI components, or backend domain/permission conditionals were duplicated in frontend JSX instead of projected across the contract.
- Computable derived UI state or URL/server-cache truth was copied into local state and synchronized via `useEffect`.
- Tests passed through a direct route that production code must not copy (or JSDOM unit tests were treated as visual/browser proof when CSS layout, stacking, or hydration changed).
- The patch weakened dependency direction, public contract semantics, or introduced an excuse comment justifying a shortcut.

**Future risk**: Later changes must reason about internals the boundary was meant to hide, or copy the bypass.

Allowed **how-level** refactor responses (when the intended boundary already exists):
- Route the call through the existing public contract, port, query adapter, or Design System primitive/token.
- Replace duplication (or `useEffect` derived-state sync) with the existing canonical owner or pure derivation.
- Add a contract test or static dependency/import guard enforcing an already-established rule.
- Correct a misleading boundary method name or local Semantic Contract comment.

Creating or redrawing a boundary or changing port/contract semantics is **what-level** (present concrete options for human decision before executing in `/cs-reflect` or deferring via `defer-to-followup`).

## 3. Unowned Capability

**Question**: Did the task reveal behavior or state whose architectural owner cannot be predicted?

Evidence includes:
- Similar logic exists in multiple locations with no canonical owner.
- The same UI/domain state truth is duplicated across competing hosts (URL params, server query cache, client store, and local component state) with no clear Single Source of Truth.
- A shared UI component accumulated ad-hoc boolean mode props across screens (`Wrong-shape Risk`), or components escalated magic `z-index` / overlay rules without a shared elevation owner.
- A new helper appears reusable but its current placement was chosen for convenience.
- A rule spans modules (or spans Backend and Frontend) and no existing entity, policy, service, contract, state host, or Architecture Map names an owner.
- Different consumers resolve the same decision independently.

**Future risk**: Later modifiers cannot find the behavior, choose inconsistent placements, or reinvent it.

When `found`, report inside `[R-*]`:
- the capability and current placement;
- why the placement is unstable;
- candidate owners and their CMP trade-offs;
- the human decision required;
- one output label: `ownership-needed`, `placement-unclear`, or `duplication-risk`.

Do not silently choose an owner. Removing accidental duplication in favor of an already-established owner is **how-level**; choosing a new owner or shared abstraction is **what-level** (execute in `/cs-reflect` only after the human selects an owner, or record as `defer-to-followup`).

## 4. Practice Discoveries & Ephemeral Clues for `/cs-merge`

Once the coding session closes, `/cs-merge` will only see `.cstack/index.md`, `Sections 1–3` of the Change file, and the final `git diff`. Record into `Section 4.2` and `4.3` **only the clues that would otherwise vanish** (leaving target doc routing and editing entirely to `/cs-merge`):

### 4A. Expectation Gaps (Human Synchronization & `Spec Deviations & Hidden Why`)
Surface **non-obvious, evidence-backed** episodes so both the human owner and `/cs-merge` stay aligned with reality:
- **Intentional Spec / Plan Adjustments**: Places where design or coding legitimately refined or deviated from Sections 2–3 (so `/cs-merge` does not merge outdated Spec statements or misread intentional changes as bugs).
- **Hidden Constraints & Why**: Undocumented domain rules, dual-purpose models, or runtime/tool preconditions uncovered only through friction (the *Why* invisible in `git diff`).

Do **not** fire for routine debugging or facts already obvious from Sections 1–3 and the diff. Prefer `None` over padding.

### 4B. Read-Trace & Pruning Clues (`4.2` & `4.3`)
`git diff` never shows which documentation files were read or made obsolete by new code structure:
- **Touched Knowledge Slice (`4.2`)**:
  - `Read & Used`: Living Knowledge files/sections consulted and relied upon.
  - `Contradicted / Stale`: Docs or rules that disagreed with code reality or newly confirmed domain rules.
  - `Read & Unused (Zero-Utility)`: Living Knowledge opened during the task that contributed zero signal (note whether it looks genuinely dead vs. valid for other features behind a coarse `index.md` pointer).
- **Pruning & Compression Clues (`4.3`)**:
  - *Contradicted Claims*: Exact doc claim vs. code reality + file/line evidence.
  - *Code-Internalized Guardrails*: Prose warnings ("always update B when editing A") now enforced mechanically by encapsulation, types, tests, or lint checks—including rules internalized by a refactor just executed in `/cs-reflect`.
  - *Exception Hotspots & Structural Routes*: Touched doc sections noticed to have 3+ piecemeal caveats, plus any durable new Use Case, Port, or boundary established during implementation.
