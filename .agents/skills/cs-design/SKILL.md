---
name: cs-design
description: Context-cost driven software design planner for cstack. Uses the Context Minimization Principle (CMP) and Clean Architecture to acquire sufficient context, separate policy from mechanism, evaluate modification closure and boundary trust, surface unresolved human-owned design gates, and produce an inside-out implementation and verification plan in conversation.
---

# `/cs-design` — Context-Cost Driven Software Design Planner

Plan non-trivial software changes so the product behavior is expressed cleanly in code while keeping future modifications cheap to understand and route.

> **Core Stance — Plan in Conversation; Express Design in Code**
> - **Code is the primary design artifact.** Print the design plan in conversation as a decision-focused alignment tool—do **not** write a separate design document that duplicates code structure.
> - Once unresolved What-level gates are cleared, the agent can proceed directly into executing the plan.
> - Skip trivial formatting-only, comment-only, mechanical dependency-bump, or generated-only changes.

## Mental Model (CMP + Clean Architecture)

Apply the **Context Minimization Principle (CMP)** as the primary design judgment:

> For the modifications a system must realistically support, prefer the design whose sufficient context is cheaper to acquire.

Analyze context cost along two axes:
- **Depth**: How much context must be read—and how many untrustworthy boundaries crossed—to reason locally about a behavior.
- **Breadth**: Whether a modifier can reliably discover the complete **Modification Closure** (every artifact that must change or be verified together).

Shape context cost through four **Context Transformations**:
- **Reduce**: Consolidate a scattered decision into one clear owner to shrink Modification Closure.
- **Relocate**: Place volatile mechanism details behind a trustworthy contract so traversal stops at the boundary.
- **Index**: Establish a discoverable route (naming, registry, or explicit closure index) when co-changing locations cannot be merged.
- **Check**: Turn implicit assumptions into types, tests, lint rules, or static dependency checks.

Weigh added **Boundary Cost / Carrying Depth / Conceptual Surface** against saved context cost, and balance **Wrong-shape Risk** (premature abstraction) against **Unindexed-closure Risk** (scattering decisions without a route).

Treat **Clean Architecture** as the primary context-routing practice—**governed by CMP, not dogma**:
1. Separate **Policy** (what the system decides: entities, invariants, use-case narrative, domain rules) from **Mechanism** (how it is wired: UI, HTTP/CLI delivery, ORM, SDKs, queues, files, serialization, transport DTOs).
2. Let a **Use Case** own the ordered policy narrative of an application behavior; let **Entities / Value Objects** own stable invariants independent of flow and infrastructure.
3. Let the client (Use Case) author **Ports** in domain language; keep provider details and SDK/DB/transport types outward in **Adapters**.
4. Keep source dependencies pointing **inward** so boundaries remain trustworthy.
5. **No Architecture Dogma**: If a subsystem or Greenfield scope has no meaningful What/How separation, do not add extra layers that increase Context Cost.

## Keep the Two Routes Distinct

- **Discovery route**: Start from the task's natural entry point (Change spec, failing test, endpoint, domain rule, schema, event, or existing use case). Follow the strongest local routing signals until the owner, layer, modification closure, and trustworthy stopping boundaries are clear. Never force a fixed layer-reading order.
- **Implementation route**: Express **policy before mechanism (inside-out)**. Establish entity invariants and use-case policy first, let that client define needed ports, then plan adapters, delivery, mapping, wiring, and integration verification outward.

The discovery route may move outside-in. The implementation route stays inside-out. Do not confuse them.

## Authority Boundary

Treat a human design gate strictly as an **unresolved What-level decision**, not merely the presence of a new file or symbol.

Consider a decision **already resolved** when the user request, an approved Change Spec (`changes/<change-id>.md`), an existing architectural rule, or an established owner clearly supplies it. Do not ask the user to re-approve settled decisions.

- **How-level**: Work within an authorized behavior, owner, boundary, contract, or placement rule (e.g. adapter, mapper, DTO, controller wiring, repository behind an approved port, focused tests, or restoring an established boundary).
- **What-level**: Decide product behavior, use-case boundaries, owned domain concepts, port semantics, capability ownership, cross-module policy placement, dependency direction, shared-policy extraction, Greenfield structural layout, or a new placement rule.

When a What-level decision remains unresolved, present concrete options with CMP trade-offs and stop before implementing that decision. Independent How-level work may continue when safe.

## Planning Modes

- **Quick plan**: Use when intent and ownership are clear, the change is mechanism-only or policy-local, existing boundaries and contracts stay intact, and no unresolved gate exists. Return intent, placement, inside-out steps, and verification inline in conversation.
- **Full plan**: Use when policy, contracts, or boundaries change; Modification Closure crosses layers; Greenfield structure is being chosen; ownership/placement is unclear; or an unresolved gate exists. Read and fill [`references/design-plan-template.md`](references/design-plan-template.md) in conversation, omitting empty rows and non-decisions.

Inspect enough context to choose accurately; do not trigger Full plan merely because the repository is large.

## Planning Workflow

1. **Load cstack Knowledge & Clarify Intent**:
   - Check `.cstack/index.md` (when present) to locate Living Knowledge (including any registered Architecture Map) and the active Change file (`<changes-dir>/<change-id>.md`).
   - State the intended behavior change, behavior to preserve, `Out of Scope` guardrails (from Spec), settled decisions, and genuine ambiguities.
   - **Spec Feedback Loop**: If unresolved product behavior or domain policy ambiguity blocks design, do **not** guess—flag it explicitly and recommend resolving it via `/cs-spec` (or gate it as an unresolved What-level decision).
2. **Start from the Natural Entry Point**:
   - Read task-relevant Architecture Map entries (if registered/present) and verify them against code; follow local signals (names, imports, types, tests, registries, contracts).
   - For broad codebase exploration, prefer delegating read-only discovery to `cstack-explorer` so raw search noise stays out of the main context window.
3. **Acquire Sufficient Context & Record Friction**:
   - Inspect only what is needed to determine ownership, layers, closure, contracts, and verification surface. Stop at trustworthy boundaries and note why excluded regions stay out.
   - If an expected route is missing/misleading, a boundary is untrusted, or a capability lacks an owner, report it in the plan and append a 1-line entry to `.cstack/friction.log` (when friction tracking is active).
4. **Locate Coordinates & Classify Concerns**:
   - Assign vertical owner (use case / capability) and horizontal layer (`entity`, `use case`, `port`, `adapter`, `delivery`, `persistence`, `mapper`, `test`), or explicit lightweight module placement when CA layers do not apply.
   - Tag concerns (`entity-invariant`, `use-case-policy`, `port-contract`, `adapter-mechanism`, `delivery-mechanism`, `persistence-mechanism`, `mapping-dto-serialization`, `test-verification`, `ownership-placement`, `architecture-boundary`). Use `ownership-needed` when vertical ownership is missing and `placement-review` when placement is unresolved.
5. **Confirm Modification Closure & CMP Transformations**:
   - List every artifact that must change, be checked, or stay consistent. If closure is still unknown, return *"inspect more context first"* instead of speculating.
   - Note where the design applies **Reduce / Relocate / Index / Check** and check for Wrong-shape vs. Unindexed-closure trade-offs.
6. **Check Boundary Trust**:
   - Rate each touched contract as `trusted`, `verify`, or `untrusted` (is it use-case-shaped? are behavior, failures, and side effects clear? do dependencies point inward?).
   - Restoring an established boundary = How-level; changing contract semantics or redrawing a boundary = What-level gate.
7. **Plan Ports, Adapters & Semantic Comments**:
   - Reuse fitting ports; author new/changed ports in client language without leaking provider/ORM/HTTP/SDK types inward.
   - Specify **Semantic Comments** only where programming constructs cannot express: (a) **Semantic Contracts** (invariants, side effects, failure semantics enabling local reasoning), or (b) **Modification Closure Indexes** (change-together pointers invisible to static types). Never plan restatement or excuse comments.
8. **Surface Unresolved Gates Only**:
   - List only What-level decisions still unresolved after checking the request, Change Spec, and existing architecture.
9. **Produce Inside-Out Execution & Owning-Level Verification Plan**:
   - Order steps inside-out (drop layers with no change).
   - Pair tests with the owning level: entity tests (invariants), use-case tests with fake ports (policy), contract tests (ports), integration tests (adapters), delivery/persistence/mapper tests, and lint/arch checks (dependency direction). Use E2E for cross-system confidence, not as the only policy oracle.
10. **Defer Routing-Index & Living Knowledge Updates**:
    - Never edit the Architecture Map or Living Knowledge merely to produce a plan, and never settle a new owner/boundary by implication through documentation.
    - If authorized implementation will add or move a durable structural route, include updating the Architecture Map (and Change file Merge Notes if active) as a post-implementation step.
    - Only if the user explicitly authorizes bootstrapping a new Architecture Map as its own task, use [`references/architecture-map-template.md`](references/architecture-map-template.md) and register its path in `.cstack/index.md`.

## Final Check

Before printing the plan, verify:
1. Intent, preserved behavior, `Out of Scope` guardrails, and settled authority are explicit.
2. Context was gathered from a natural entry point and stopped at trustworthy boundaries.
3. Ownership, placement, Modification Closure, and CMP trade-offs are evidence-backed.
4. Policy and mechanism are separated (where meaningful under CMP) and provider types stay outward.
5. Only genuinely unresolved What-level decisions are gated.
6. Implementation steps move inside-out, verification sits at the owning level, and any Architecture Map update is deferred to authorized post-implementation maintenance.
