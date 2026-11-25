---
name: cs-reflect
description: Post-change design reflection, refactoring, and trace-capture skill for cstack. Reflects directly on the live task context after implementation to detect Missing Path, Boundary Bypass, and Unowned Capability signals, draft and execute user-approved refactors, synchronize practice discoveries with the human owner, and record Section 4 (Reflection & Merge Handoff) into the Change file for /cs-merge.
---

# `/cs-reflect` — Post-Change Design Reflection, Refactoring & Trace Capture

Inspect how a completed change affected the codebase's future changeability while the **live execution trace** is still hot, synchronize non-obvious discoveries from practice with the human owner, execute approved structural refactors in-branch, and record ephemeral trace clues into the Change file (`Section 4`) so `/cs-merge` has everything `Sections 1–3 + git diff` alone cannot see.

> **Core Stance — Diagnose & Refactor While the Trace Is Hot; Leave Doc Routing & Governance to `/cs-merge`**
> - `/cs-reflect` owns **in-branch design health, two-way human-AI synchronization, and capturing ephemeral trace clues**.
> - Do **not** pre-plan Living Knowledge file layouts or edit Living Knowledge (`docs/`, `GLOSSARY.md`, `Architecture Map`, etc.) here—PRs may still iterate or revert before landing. Choosing target Living Knowledge locations and running Local GC (`ADD` / `RESOLVE` / `COMPRESS` / `PRUNE`) belong exclusively to `/cs-merge`.
> - Skip routine summaries, formatting-only edits, generated-only changes, or ordinary test reporting.

## Primary Observation Rule

The **live task context** is the primary observation surface. Searches, files opened, Living Knowledge read, dead ends, misleading docs, corrections, boundary choices, placement uncertainty, and verification just experienced are already available as direct evidence.

- Do **not** begin by reconstructing the task from `git diff`, rerunning searches, or dumping a chronological transcript.
- Use the diff, final code, tests, or a focused tool call **only** to verify a specific uncertain fact.
- **Compaction / Handoff Recovery**: If `.cstack/friction.log` exists and contains entries from this task, read it as supplementary episodic evidence. If neither live context nor `.cstack/friction.log` covers part of the route, state the gap explicitly and mark affected checks `unknown`. Never manufacture a route from artifacts alone.

## Operating Modes & Write Authority

- **Report mode is the default (zero writes).** Inspect, diagnose, draft concrete `[R-*]` Refactor Proposals, preview Section 4 of the Change file, and pause at the Human Review Gate—do **not** edit code, Change files, Living Knowledge, or skills before approval.
- **Refactor & Record mode requires explicit user authorization.** Once the user decides which `[R-*]` refactors to run now vs. defer and confirms the Section 4 clues:
  1. Execute the approved refactors (`how-level` local repairs and user-resolved `what-level` refactors), rerun proportionate verification, and mark completed items `fixed-in-branch` (or leave deferred ones `defer-to-followup` / `wont-fix`);
  2. Write or update `## 4. Reflection & Merge Handoff` in `<changes-dir>/<change-id>.md` and set `Status: reflected` (in both the Change file and `.cstack/index.md`).
- Never introduce a new concept, owner, boundary, layer, or placement rule without explicit human authorization (**Stay Out of the Architect's Chair**), and **never** modify Living Knowledge files during `/cs-reflect`.

## Evidence Contract

For each of the three CMP checks (**Missing Path**, **Boundary Bypass**, **Unowned Capability**), report:
- `result`: `found`, `not-found`, or `unknown`
- `evidence`: concrete events observed in the live trace (optionally supplemented by `.cstack/friction.log` or corroborated by files/tests/diff)
- `future-risk`: a plausible way a later modifier could omit, bypass, or duplicate behavior
- `confidence`: `high`, `medium`, or `low`
- `level`: `how-level` or `what-level` when action is proposed

Separate observed facts from inference. Wide search, many changed files, or passing tests alone do not fire a check.

## Workflow

1. **Observe the live route & trace coverage.**
   - Recall from current task context: natural entry point, Living Knowledge docs opened, signals followed, useful and misleading paths, corrections, boundary choices, placement decisions, and verification.
   - Check `.cstack/friction.log` (if present) and any active `<changes-dir>/<change-id>.md` from `.cstack/index.md`. State material trace gaps explicitly.
2. **Identify the modification closure.**
   - List the artifacts that had to change or stay consistent together and the route a future modifier is expected to follow.
3. **Diagnose CMP design friction & draft Refactor Proposals (`[R-*]`).**
   - Run **Missing Path**, **Boundary Bypass**, and **Unowned Capability** using [`references/checks.md`](references/checks.md) and [`references/principles.md`](references/principles.md).
   - For every actionable issue, draft a structured **Refactor Proposal (`[R-*]`)**: concrete symptom, CMP root cause (Depth/Breadth cost), concrete refactor route (target owner, contract/boundary change, co-change surface), authority level (`how-level | what-level`—presenting options with CMP trade-offs if `what-level`), and recommended disposition (`fix now` vs. `defer-to-followup` to avoid PR scope creep).
   - If structural awkwardness actually stems from a product behavior or domain-model flaw, flag it for `/cs-spec` or `/cs-explore` rather than inventing code abstractions to hide it.
4. **Surface practice discoveries for human synchronization.**
   - Compare what the plan, spec, or existing guidance expected against what actually happened in practice (Section 4 of [`references/checks.md`](references/checks.md)).
   - Surface only **non-obvious** findings the human owner would miss from the final diff alone (hidden constraints, undocumented runtime/tool prerequisites, expectation deviations). Report `None` if execution matched expectations.
5. **Capture ephemeral trace clues (what `Sections 1–3 + git diff` cannot see).**
   - Do **not** waste effort choosing Living Knowledge target layouts—`/cs-merge` handles routing via `.cstack/index.md`. Instead, extract only the live-session clues that vanish once this chat closes:
     - **4.2 Touched Knowledge Slice**: Which Living Knowledge files/sections were actually `Read & Used`, `Contradicted / Stale`, or `Read & Unused (Zero-Utility)` during this task (noting why unused docs were loaded, e.g., coarse `index.md` routing vs. dead content).
     - **4.3 Trace Clues for `/cs-merge`**:
       - *Spec Deviations & Hidden Why*: Intentional mid-coding adjustments to Sections 2–3 or non-obvious domain/runtime constraints behind the code (so `/cs-merge` neither merges superseded Spec claims nor misses hidden *Why*);
       - *Contradicted Claims*: Specific doc claims disproven in practice + code evidence;
       - *Code-Internalized Guardrails*: Specific prose warnings/rules now enforced by types, tests, or encapsulation (including refactors executed in Step 7);
       - *Exception Hotspots & Structural Routes*: Touched doc sections with 3+ scattered caveats needing compression, or durable new architectural boundaries/ports/owners established.
6. **Human Review Gate (Report Mode).**
   - Present the concise report using [`references/report-template.md`](references/report-template.md) and ask the user to confirm:
     1. Which `[R-*]` Refactor Proposals to **execute now in `/cs-reflect`** (picking an option on `what-level` choices) vs. record as `defer-to-followup` or `wont-fix`;
     2. Which **Touched Knowledge Slice & Trace Clues** (`4.2` & `4.3`) to persist into Change File Section 4 for `/cs-merge`.
7. **Execute Approved Refactors & Persist Section 4 (Authorized Only).**
   - Execute each refactor approved for immediate action, run owning-level tests and boundary/type checks (plus live browser verification if UI layout, styling, or runtime behavior changed), and update its disposition to `fixed-in-branch` (adding any prose rule newly internalized by the refactor to `4.3 Code-Internalized Guardrails`).
   - Write `## 4. Reflection & Merge Handoff` into `<changes-dir>/<change-id>.md` and update `Status: reflected` in both the Change file and `.cstack/index.md`:
     - **Fast-Path Rule (no prior Change file)**: If the task started directly from `/cs-build` without a Change file, lazily create a compact `<changes-dir>/<change-id>.md` (header with `Status: reflected`, 2-line Context summary, and Section 4) and register it in `.cstack/index.md` **only** when `defer-to-followup` refactors or non-empty `4.2`/`4.3` clues remain for `/cs-merge`. If neither remains, keep **zero file overhead** and clear consumed entries in `.cstack/friction.log`.
   - **Strict Guardrail**: Do **not** edit any Living Knowledge file or delete the Change file; leave `.cstack/friction.log` cleanup to `/cs-merge` whenever a Change file remains active.

## Change File Structure Owned by Reflect (Section 4)

Append or update Section 4 inside `<changes-dir>/<change-id>.md` (preserving Sections 1–3 when present):

```markdown
## 4. Reflection & Merge Handoff

### 4.1 Design Friction & Refactor Proposals
- **[R-1] `<Missing Path | Boundary Bypass | Unowned Capability>`** — `<file/module>` (`<how-level | what-level>`)
  - **Symptom & Evidence**: <Concrete friction observed in live trace / friction.log>
  - **CMP Root Cause & Future Risk**: <Why context cost is elevated and how a future modifier could fail>
  - **Refactor Proposal**: <Concrete target owner, boundary/contract adjustment, and co-change closure>
  - **Disposition**: `pending` | `fixed-in-branch` | `defer-to-followup` | `wont-fix`

### 4.2 Touched Knowledge Slice
<!-- Ephemeral read-trace invisible from git diff; bounds /cs-merge strictly to touched docs -->
- **Read & Used**: `<doc/path#section>` *(or `None`)*
- **Contradicted / Stale**: `<doc/path#section>` — <what conflicted with code/reality> *(or `None`)*
- **Read & Unused (Zero-Utility)**: `<doc/path#section>` — <why loaded & whether likely obsolete vs. valid for other flows> *(or `None`)*

### 4.3 Trace Clues for `/cs-merge`
<!-- Execution-time clues that vanish after the coding session; /cs-merge handles target doc routing -->
- **Spec Deviations & Hidden Why**: <Intentional adjustments to Sections 2–3 or non-obvious domain/runtime constraints discovered in practice, or `None`>
- **Contradicted Claims**: <Doc claim X vs. realized code/truth Y (`<file#L..>`), or `None`>
- **Code-Internalized Guardrails**: <Prose rules/warnings now enforced by types/tests/encapsulation (`<evidence path>`), or `None`>
- **Exception Hotspots & Structural Routes**: <Doc sections with 3+ scattered caveats or durable new ports/boundaries/owners established, or `None`>
```

## Final Check

Before finishing, verify that:
1. All three CMP checks have explicit results (`found | not-found | unknown`), and every actionable issue has a concrete `[R-*]` Refactor Proposal.
2. Non-obvious practice discoveries are surfaced for human synchronization (or explicitly marked `None`), without routine implementation padding.
3. Section 4 (`4.2` & `4.3`) captures the exact ephemeral clues that `Sections 1–3 + git diff` alone would miss, without prematurely planning Living Knowledge file layouts.
4. Report mode performs **zero writes**; authorized mode executes only approved refactors (with verification) and writes **only** to the Change file (plus `.cstack/index.md` status)—never mutating Living Knowledge directly.
