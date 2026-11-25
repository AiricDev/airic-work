---
name: cs-build
description: Context-cost driven software construction and verification skill for cstack. Uses the Context Minimization Principle (CMP) with on-demand domain architecture cases (Clean Architecture for backend/services, Frontend Architecture for interactive UI, and Cross-Boundary Seam rules for full-stack changes) to plan structure in conversation, gate only unresolved What-level decisions, and directly execute inside-out implementation and owning-level verification.
---

# `/cs-build` — CMP-Driven Software Construction & Verification

Plan software structure cleanly in conversation using CMP, pause **only** on genuinely unresolved human-owned design gates, and build + verify the change inside-out so future modifications stay cheap to understand and route.

> **Core Stance — Plan in Conversation; Gate on `What`, Execute on `How`**
> - **Code is the primary design artifact.** Print a concise Quick or Full CMP build plan in conversation—do **not** write disposable design documents that duplicate code structure.
> - **Gate-Driven Direct Execution**:
>   - **Unresolved `What-level` gate exists** (or user explicitly requested plan-only review) → Present options with CMP trade-offs and **pause** before implementing the gated decision. Once resolved, execute immediately.
>   - **Zero unresolved `What-level` gates** → Print the CMP build plan inline and **proceed directly into inside-out implementation and owning-level verification** without waiting for redundant rubber-stamping.
> - Skip full CMP planning on trivial formatting-only, comment-only, or mechanical dependency-bump edits.

## Mental Model: CMP Kernel + Domain Architecture Cases

Apply the **Context Minimization Principle (CMP)** as the universal engineering judgment:

> For the modifications a system must realistically support, prefer the design whose sufficient context is cheaper to acquire.

Analyze context cost along two axes:
- **Depth**: How much context must be read—and how many untrustworthy boundaries crossed—to reason locally about a behavior.
- **Breadth**: Whether a modifier can reliably discover the complete **Modification Closure** (every artifact that must change or be verified together).

Shape context cost through four **Context Transformations**:
- **Reduce**: Consolidate a scattered decision or duplicated state into one clear owner to shrink Modification Closure.
- **Relocate**: Place volatile mechanism details behind a trustworthy contract so traversal stops at the boundary.
- **Index**: Establish a discoverable route (naming, registry, key factory, or explicit closure index) when co-changing locations cannot be merged.
- **Check**: Turn implicit assumptions into static types, exhaustive unions, contract/unit tests, or lint/dependency guards.

Weigh added **Boundary Cost / Carrying Depth / Conceptual Surface** against saved context cost, and balance **Wrong-shape Risk** (premature or ill-fitting abstraction) against **Unindexed-closure Risk** (scattering co-changing decisions without a route).

Across every domain, separate **Policy & Contracts** (stable rules, invariants, state transitions, client-owned boundaries) from **Mechanism** (volatile delivery, persistence, external SDKs, transport DTOs, UI primitives, host APIs), keeping dependencies pointing toward stable policy and contracts.

### On-Demand CMP Architecture Cases (Sharp Domain Guidance, Zero Dilution)

Generic abstractions make weak engineering guidance. **Select and read only the CMP Case(s) matching the touched scope**:

- **Backend, Services, APIs, Workers & Domain Modules** → Read [`references/cases/clean-architecture.md`](references/cases/clean-architecture.md)
- **Frontend & Interactive Client UI** → Read [`references/cases/frontend-architecture.md`](references/cases/frontend-architecture.md)
- **Full-Stack / Cross-Boundary Tasks (Backend + Frontend together)** → Read **both** cases and apply the **Cross-Boundary Seam Rules** below.
- **Repo-Specific Conventions & Lightweight Fallback (`No Architecture Dogma`)**: Honor established architecture rules registered in `.cstack/index.md` / Architecture Maps unless proposing a `What-level` change. For small scripts, standalone utilities, or thin glue modules where heavy layering only adds Carrying Depth, skip specialized cases and apply the four CMP transformations directly.

### Cross-Boundary Seam Rules (When a Task Spans Backend & Frontend)

When loading both backend and frontend cases in a single task, treat the **Backend ↔ Frontend Seam** as a first-class boundary:
1. **Single Contract Anchor & Closure**: Anchor both ends on one canonical contract (`packages/contracts`, OpenAPI/Protobuf/GraphQL/tRPC, or an explicit cross-repo `Modification Closure Index` when ungenerated).
2. **Authoritative Policy vs. UI Projection**: Keep business invariants and permission enforcement authoritative on the server; project capability affordances and structured field/domain error codes across the contract so the UI never duplicates backend domain conditionals (`UI hiding ≠ authorization`).
3. **UX-Driven Seam Semantics**: Shape read/write contracts to serve the Spec's interaction model (cohesive view read models vs. client request waterfalls; idempotency, versioning, or undo semantics for optimistic UI and autosave; field-actionable errors).
4. **Contract-Hinged Inside-Out Execution**: Lock core domain policy + the cross-end contract first, then build backend inside-out and frontend inside-out against that locked contract, closing with wired end-to-end and live-browser verification.

## Keep the Two Routes Distinct

- **Discovery route**: Start from the task's natural entry point (Change spec, failing test, route/component, endpoint, domain rule, schema, event, or use case). Follow the strongest local routing signals until ownership, coordinates, modification closure, and trustworthy stopping boundaries are clear. Never force a fixed layer-reading order.
- **Implementation route**: Build **policy and contracts before volatile mechanisms (inside-out)**, following the concrete sequence of the active CMP Case(s).

## Authority Boundary

Treat a human gate strictly as an **unresolved What-level decision**, not merely the presence of a new file or symbol. Consider a decision **already resolved** when the user request, an approved Change Spec (`changes/<change-id>.md`), an existing architectural rule, or an established owner clearly supplies it.

- **How-level**: Work within an authorized behavior, owner, boundary, contract, state host, token system, or placement rule (see active Case for domain-specific examples).
- **What-level**: Decide product behavior, capability/use-case boundaries, state ownership host (URL vs. cache vs. store vs. local), port or cross-end contract semantics, shared Design System primitives/tokens, cross-module policy placement, dependency direction, or Greenfield structural topology.

## Build Plan Modes

- **Quick plan**: Use when intent and ownership are clear, the change is mechanism-only or policy-local, existing boundaries/state hosts/contracts stay intact, and no unresolved gate exists. Print concise intent, active Case(s), placement, and inside-out steps inline, then execute immediately.
- **Full plan**: Use when policy, state ownership, contracts, or boundaries change; Modification Closure crosses layers or the Backend↔Frontend seam; Greenfield structure is being chosen; ownership/placement is unclear; or an unresolved gate exists. Read and fill [`references/build-plan-template.md`](references/build-plan-template.md) in conversation (omitting empty rows), pause if any gate is unresolved, or execute immediately if all decisions are settled.

## Operating Workflow

### Phase 1: CMP Context & Structural Plan
1. **Load cstack Knowledge & Clarify Intent**:
   - Check `.cstack/index.md` (when present) to locate Living Knowledge (Architecture Maps, Cross-End Contracts, `DESIGN.md` / Design Tokens) and the active Change file (`<changes-dir>/<change-id>.md`—including any deferred `[R-*]` Refactor Proposal from Section 4.1).
   - State the intended behavior change, behavior to preserve, `Out of Scope` guardrails, settled decisions, and genuine ambiguities.
   - **Spec Feedback Loop**: If unresolved product behavior, UX state semantics, or domain policy ambiguity blocks construction, flag it explicitly and recommend resolving it via `/cs-spec` (or gate it as an unresolved What-level decision).
2. **Start from the Natural Entry Point & Select CMP Case(s)**:
   - Read task-relevant Architecture Map entries (if registered) and verify them against code; use `cstack-explorer` for broad read-only searches so search noise stays out of the main context window.
   - Load the matching Case file(s) from `references/cases/`.
3. **Acquire Sufficient Context, Locate Coordinates & Confirm Closure**:
   - Inspect only what is needed to determine vertical/state ownership, horizontal coordinates, Modification Closure, and boundary trust (`trusted / verify / untrusted`). Stop at trustworthy boundaries.
   - Note where the structure applies **Reduce / Relocate / Index / Check**, plan needed **Semantic Comments** (`Semantic Contracts` & `Modification Closure Indexes` only—never restatement or excuse comments), and silently append a 1-line entry to `.cstack/friction.log` if search/boundary/ownership friction occurs.
4. **Print Build Plan & Check Authority Gates**:
   - Output the **Quick** or **Full** build plan in conversation.
   - **If any unresolved `What-level` gate exists** (or user asked to review the plan before coding): **Stop here** and wait for human resolution (executing independent safe `How-level` prep only when cleanly isolated).
   - **If zero unresolved gates exist**: Proceed directly to Phase 2.

### Phase 2: Inside-Out Implementation & Owning-Level Verification
5. **Build Inside-Out**:
   - Execute the planned steps inside-out per the active Case(s) (contract-hinged when full-stack; drop untouched layers), respecting `Out of Scope` guardrails and encoding any planned Semantic Comments.
   - Continue logging any newly encountered `[MISSING_PATH]`, `[BOUNDARY_BYPASS]`, or `[UNOWNED_CAPABILITY]` friction silently to `.cstack/friction.log` (when active).
6. **Verify at the Owning Level**:
   - Run verification matched to each touched layer: pure unit tests (invariants, derivations, state machines), fake-port/hook/contract tests (use cases, query/cache closures), adapter/integration tests, static type/lint/dependency checks, and **mandatory live browser verification** (Playwright / browser subagent / DevTools) whenever UI layout, CSS styling/tokens, stacking context, responsive behavior, routing, or hydration changed.
7. **Close Out Build & Handoff to `/cs-reflect`**:
   - Never mutate Living Knowledge or Architecture Maps as a side effect of building (unless the user explicitly authorized a standalone Architecture Map bootstrap task following [`references/architecture-map-template.md`](references/architecture-map-template.md)).
   - Report the completed changes, verification evidence, and any durable structural routes added, then suggest running **`/cs-reflect`** while the live execution trace is hot.
