# Reflection Principles

## Scope

Audit changeability, architecture conformance (discoverability, boundary trust, ownership predictability), and Living Knowledge synchronization for completed changes. Do not present this audit as validation of product correctness, domain completeness, or all quality attributes.

## Evidence Before Judgment

- Treat the live task context as the primary evidence source. The agent's just-experienced route is already observable and does not require separate reconstruction.
- Do not default to reading a diff, logs, or history. Use artifacts and tools only to verify a specific uncertain fact or recover an explicitly missing part of the live trace (using `.cstack/friction.log` if available).
- Summarize route facts relevant to design; do not emit a full reasoning transcript.
- Separate observed trace facts from inference.
- Tie every `found` result to concrete evidence and a plausible future failure scenario.
- Use `unknown` when evidence is incomplete.
- Prefer no finding over a generic or speculative finding.
- Treat passing tests as behavior evidence, not proof that placement and boundaries are correct.

## Authority Before Repair & Merge

Default to **Report mode**. A reflection request authorizes inspection and recommendations, not writes. Human review in Report mode serves two roles: **governance** (deciding which repairs or merges are authorized) and **two-way knowledge synchronization** (the human learns what practice exposed behind the final diff, and supplies domain or organizational context to confirm, narrow, or reject the agent's interpretation). Enter **Repair / Merge mode** only when the user explicitly authorizes applying findings or merging Knowledge Deltas into Living Knowledge.

Classify every proposed action as:
- **How-level** — action inside an already-authorized behavior, owner, boundary, or placement convention (e.g. fix a stale pointer, add a closure index comment, improve a focused test, route through an existing port, remove duplication in favor of an existing owner, merge unconflicted realized deltas into registered Living Knowledge).
- **What-level** — a decision that creates or changes behavior, ownership, a boundary, a layer, dependency direction, a shared abstraction, or resolves a conflict with direct human edits to Living Knowledge. Report the decision and request authority.

How-level describes design authority, not automatic permission to edit. All writes still require user authorization.

## Anti-Overreach

Do not:
- invent a missing trace;
- treat every wide search or duplicate as a design defect;
- create a shared abstraction merely because reuse seems possible;
- silently decide ownership or placement;
- redesign architecture after a local task;
- hide a what-level decision inside a small patch;
- silently mutate Living Knowledge, Architecture Maps, `AGENTS.md`, or skills without explicit authorization.

## Controlled Learning Loop

Reflection may identify improvements to existing guidance surfaces (Architecture Map, `AGENTS.md`, test conventions, or skills). Recommend such changes only when the task provides concrete evidence that current guidance caused or failed to prevent a routing problem.

Prefer this progression:
1. Record the task-local signal.
2. Look for recurrence or strong omission risk.
3. Propose the smallest update to an existing guidance owner.
4. Obtain authorization.
5. Apply and forward-test the guidance change independently.

## Quality Bar

A good reflection is concise, evidence-backed, explicit about uncertainty, useful to the next modifier, and comfortable reporting no issue. A bad reflection re-summarizes the implementation, produces generic architecture advice, or recommends a new abstraction without ownership analysis.
