# Reflection Principles

## Scope & Orthogonal Separation

`/cs-reflect` audits code changeability, architecture conformance (discoverability, boundary trust, ownership predictability), human-AI mental-model alignment, and ephemeral trace capture immediately after coding.

Keep `/cs-reflect` and `/cs-merge` cleanly separated:
- **`/cs-reflect` (in-session, trace-hot)**: Diagnoses structural friction, executes user-approved code refactors in-branch, syncs unexpected discoveries with the human owner, and records `Section 4 (Reflection & Merge Handoff)` into the Change file. It **never** plans Living Knowledge folder layouts, mutates Living Knowledge (`docs/`, `GLOSSARY.md`, `Architecture Map`, etc.), or closes the Change file, because unmerged branches may still change or be abandoned.
- **`/cs-merge` (stateless, merge-time)**: Owns mapping realized changes onto `.cstack/index.md` targets, reconciling against the final `git diff`, and curating canonical Living Knowledge (`ADD` / `RESOLVE` / `COMPRESS` / `PRUNE`) atomically when landing.

Do not present `/cs-reflect` as validation of overall product correctness, domain completeness, or non-inspected quality attributes (security, performance, concurrency).

## Evidence Before Judgment

- Treat the live task context as the primary evidence source. The agent's just-experienced route is already observable and does not require separate reconstruction.
- Do not default to reading a diff, logs, or history. Use artifacts and tools only to verify a specific uncertain fact or recover an explicitly missing part of the live trace (using `.cstack/friction.log` if available).
- Summarize route facts relevant to design; do not emit a full reasoning transcript.
- Separate observed trace facts from inference.
- Tie every `found` result to concrete evidence and a plausible future failure scenario.
- Use `unknown` when evidence is incomplete.
- Prefer no finding over a generic or speculative finding.
- Treat passing tests as behavior evidence, not proof that placement and boundaries are correct.

## Authority Before Refactor & Handoff

Default to **Report mode** (zero writes). Human review in Report mode serves two roles:
1. **Architectural governance**: Deciding which `[R-*]` Refactor Proposals to execute right now in `/cs-reflect` (and resolving any `what-level` choice) vs. deferring as `defer-to-followup` (to prevent PR scope creep) or closing as `wont-fix`.
2. **Two-way knowledge synchronization**: Learning what practice exposed behind the final diff, and confirming which ephemeral trace clues belong in Change File Section 4 for `/cs-merge`.

Classify every `[R-*]` Refactor Proposal as:
- **How-level** — refactor inside an already-authorized behavior, owner, boundary, or placement convention (e.g. fix a stale symbol/pointer, add a Semantic Comment / Modification Closure Index, route through an existing port, consolidate accidental duplication into an established owner).
- **What-level** — refactor that creates or changes behavior, capability ownership, port semantics, a boundary, a layer, dependency direction, or a shared abstraction. Present concrete options with CMP trade-offs so the human architect chooses before `/cs-reflect` executes the refactor (or defers it).

How-level describes design authority, not automatic permission to edit. All code edits and Change file writes require explicit user authorization.

## Anti-Overreach

Do not:
- invent a missing trace;
- treat every wide search or duplicate as a design defect;
- create a shared abstraction merely because reuse seems possible;
- silently decide ownership or placement;
- bloat a focused feature branch with sprawling refactors when `defer-to-followup` keeps review clean;
- hide a what-level decision inside a small patch;
- pre-plan doc file structures or mutate Living Knowledge, Architecture Maps, `AGENTS.md`, or skills directly during `/cs-reflect`.

## Controlled Guidance Feedback

When concrete trace evidence shows that repository guidance (`AGENTS.md`, Architecture Map, or Living Knowledge) misled the agent or diluted context, record it accurately in Section `4.2` (`Contradicted / Stale` or `Read & Unused`) and Section `4.3` (`Trace Clues`) so `/cs-merge` can govern it at merge time with diff verification.

## Quality Bar

A good reflection is concise, evidence-backed, explicit about uncertainty, actionable in its Refactor Proposals, focused strictly on ephemeral clues that `Sections 1–3 + git diff` would miss, and comfortable reporting no issue. A bad reflection re-summarizes the implementation, produces generic architecture advice, or prematurely drafts documentation edits before the branch lands.
