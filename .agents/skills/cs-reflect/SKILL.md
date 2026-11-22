---
name: cs-reflect
description: Post-change design reflection and knowledge synchronization skill for cstack. Reflects directly on the live task context after a completed non-trivial change to detect Missing Path, Boundary Bypass, and Unowned Capability signals, surface expectation-vs-reality discoveries from practice, and propose merging realized Knowledge Deltas back into Living Knowledge.
---

# `/cs-reflect` — Post-Change Design Reflection & Knowledge Sync

Inspect how a completed change affected the codebase's future changeability, synchronize what practice just revealed back to the human owner, and close the loop on realized knowledge changes.

Observe the route used to find and place the change directly from the **current live task context**, surface evidence-backed CMP design signals plus non-obvious expectation-vs-reality discoveries, and prepare the Delta-to-Living Knowledge merge.

> **Core Stance — Evidence First; Report by Default**
> - The goal is to lower future context cost by keeping modification closures discoverable, boundaries trustworthy, capabilities predictably owned, and both human understanding and Living Knowledge aligned with realized code.
> - This is an architecture-maintainability and knowledge-synchronization audit—not proof that the product model or overall architecture is optimal.
> - Skip routine summaries, formatting-only edits, generated-only changes, or ordinary test reporting.

## Primary Observation Rule

The **live task context** is the primary observation surface. Searches, files opened, signals followed, dead ends, corrections, boundary choices, placement uncertainty, and verification just experienced are already available as direct evidence.

- Do **not** begin by reconstructing the task from `git diff`, rerunning searches, or dumping a chronological transcript.
- Use the diff, final code, tests, or a focused tool call **only** to verify a specific uncertain fact.
- **Compaction / Handoff Recovery**: If `.cstack/friction.log` exists and contains entries from this task (e.g., after context compaction or session handoff), read it as supplementary episodic evidence. If neither live context nor `.cstack/friction.log` covers part of the route, state the gap explicitly and mark affected checks `unknown`. Never manufacture a route from artifacts alone.

## Operating Modes & Write Authority

- **Report mode is the default.** Inspect, diagnose, and recommend—do **not** edit code, Living Knowledge, Architecture Maps, or skills merely because an action is how-level.
- **Repair / Merge mode requires explicit user authorization.** Apply only the approved how-level repairs and/or approved Living Knowledge merges, then verify them proportionately.
- Never introduce a new concept, owner, boundary, layer, or placement rule without explicit human authorization (**Stay Out of the Architect's Chair**).

## Evidence Contract

For each of the three CMP checks, report:
- `result`: `found`, `not-found`, or `unknown`
- `evidence`: concrete events observed in the live trace (optionally supplemented by `.cstack/friction.log` or corroborated by files/tests/diff)
- `future-risk`: a plausible way a later modifier could omit, bypass, or duplicate behavior
- `confidence`: `high`, `medium`, or `low`
- `level`: `how-level` or `what-level` when action is proposed

Separate observed facts from inference. Wide search, many changed files, or passing tests alone do not fire a check.

## Workflow

1. **Observe the live route first.** Recall from current task context: natural entry point, signals followed, useful and misleading paths, corrections, boundary choices, placement decisions, and verification.
2. **Establish trace coverage.** State what parts of the live route remain available and note material gaps (checking `.cstack/friction.log` if present and relevant). Perform focused fact checks only when uncertainty would change a conclusion.
3. **Identify the modification closure.** List the artifacts that had to change or stay consistent together and the route a future modifier is expected to follow.
4. **Run all three CMP checks.** Evaluate **Missing Path**, **Boundary Bypass**, and **Unowned Capability** using [`references/checks.md`](references/checks.md). Apply the evidence threshold before returning `found`.
5. **Surface expectation gaps & practice discoveries (Knowledge Sync).**
   - Compare what the plan, spec, or existing guidance expected against what actually happened in practice (see Section 4 of [`references/checks.md`](references/checks.md)).
   - Surface only **non-obvious** findings the human owner would miss from the final diff alone: hidden domain/codebase constraints exposed by friction, undocumented tool/runtime prerequisites, or deviations/workarounds from original expectations.
   - For each finding, state expected vs. actual (with trace evidence), remaining uncertainty/scope, and a **Candidate Knowledge Delta** destination (`keep local`, `Living Knowledge`, `guidance`, or feedback to `/cs-spec` / `/cs-explore`). If execution matched expectations with no non-obvious discovery, report `None`.
6. **Analyze ownership & cross-stage feedback.**
   - If capability ownership is unclear, report candidate owners and the human decision required; never choose silently.
   - If structural awkwardness actually stems from a product behavior or domain-model flaw rather than code placement, flag it as feedback for `/cs-spec` or `/cs-explore` instead of inventing code abstractions to hide it.
7. **Check Delta-to-Living Knowledge Merge (planned and practice-discovered deltas).**
   - Check `.cstack/index.md` for an active Change file (`<changes-dir>/<change-id>.md`) corresponding to this completed work.
   - Compare the realized implementation against the Change file's Domain Delta (Section 2), Product Spec (Section 3), and Merge Notes (Section 4), any direct human edits made to Living Knowledge since the Change began, and any **practice-discovered Knowledge Deltas** from Step 5 (even on Fast Path tasks with no active Change file).
   - Propose the exact minimal updates to Living Knowledge and/or the Architecture Map (flagging any conflict with user edits for human decision), plus marking any active Change `merged` in `.cstack/index.md`.
8. **Recommend the smallest response.** Classify each proposed action with [`references/principles.md`](references/principles.md). Prefer an existing destination, boundary, or convention.
9. **Produce the report.** Use [`references/report-template.md`](references/report-template.md). Keep it concise; one precise signal beats generic advice. Explicitly say when no actionable routing issue or expectation gap was found.
10. **Apply only when authorized.** In Repair / Merge mode:
    - Apply approved how-level code/routing repairs and rerun relevant verification;
    - Apply approved Living Knowledge & Architecture Map merges (from both planned Change deltas and approved practice discoveries) and set any completed Change file status to `merged` (updating `.cstack/index.md`);
    - Reset consumed entries in `.cstack/friction.log` (if present);
    - Never silently self-modify `AGENTS.md`, Architecture Maps, or skills without explicit authorization.

## The Three CMP Checks

- **Missing Path** — required context or sibling changes were unnecessarily hard to discover, creating omission or reinvention risk.
- **Boundary Bypass** — the change crossed, duplicated, or weakened an established service, port, adapter, repository, validator, policy, state machine, API, or layer boundary.
- **Unowned Capability** — new or duplicated behavior has no predictable architectural home and needs an ownership decision.

## Non-Goals

Do not use this reflection to claim that:
- the domain model or product behavior is inherently correct;
- the current architecture is optimal merely because its boundaries were followed;
- security, performance, concurrency, operability, or usability were reviewed unless explicitly inspected;
- every broad modification closure is a locality failure.

## Final Check

Before finishing, verify that:
1. All three CMP checks have explicit results (`found | not-found | unknown`), and every `found` has concrete evidence plus a future-risk scenario.
2. Non-obvious practice discoveries and expectation deviations are surfaced with evidence and scope (or explicitly marked `None`), without routine implementation padding.
3. Trace gaps and uncertainty are visible (never fabricated).
4. If an active Change file or practice-discovered Knowledge Delta applies, its Living Knowledge merge proposal (and any conflict with direct human edits) is included.
5. All recommendations respect write authority (Report mode performs zero writes), and the report explicitly states when no routing issue was found.
