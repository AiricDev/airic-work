# Reflection Checks

## Common Decision Rule

Return `found` **only** when both are present:
1. Concrete trace or artifact evidence.
2. A plausible future modification failure caused by that evidence.

The live task context is concrete trace evidence; no external log or repeated search is needed to establish an event the agent just experienced (though `.cstack/friction.log`, when present, can supply episodic evidence after compaction or handoff). Return `not-found` when the available route supports the intended design. Return `unknown` when trace coverage is insufficient. Do not treat repository size, a wide search, many touched files, or passing tests as sufficient evidence by themselves.

## 1. Missing Path

**Question**: Was context that should have been reachable through an established route unnecessarily hard to find?

Evidence includes:
- A relevant helper, schema, test, registry, or implementation was found only after avoidable broad searching.
- Related artifacts had to change together but were not connected by naming, placement, imports, tests, Semantic Comments / Closure Indexes, or an Architecture Map.
- A misleading route pointed to the wrong owner or almost caused an existing capability to be reimplemented.
- The same sibling location was missed more than once during the task.

Do not fire when the modification closure is broad by nature and the architecture already makes its consumers discoverable.

**Future risk**: A later modifier omits a sibling change or duplicates an existing implementation.

Allowed **how-level** responses (when an existing destination or convention is clear):
- Correct a misleading name or stale pointer.
- Add a Semantic Comment / Modification Closure Index pointing to an existing canonical implementation or sibling co-change site.
- Improve a focused test name or nearby documentation.
- Add an entry to an existing Architecture Map, routing index, or registry.
- Move a small item to an already-established conventional location.

Creating a new registry, abstraction, or ownership rule is **what-level**.

## 2. Boundary Bypass

**Question**: Did the change bypass, duplicate, or weaken an established boundary?

Evidence includes:
- A layer accessed private state, low-level details, or another layer's implementation type.
- Code bypassed an existing service, port, adapter, repository, validator, policy, state machine, or API contract.
- Boundary-owned logic was duplicated in another consumer.
- Tests passed through a direct route that production code must not copy.
- The patch weakened dependency direction, public contract semantics, or introduced an excuse comment justifying a shortcut.

**Future risk**: Later changes must reason about internals the boundary was meant to hide, or copy the bypass.

Allowed **how-level** responses (when the intended boundary already exists):
- Route the call through the existing public contract.
- Replace duplication with the existing owner.
- Add a contract test or static dependency guard for an established rule.
- Correct a misleading boundary method name or local Semantic Contract comment.

Creating or redrawing a boundary is **what-level**.

## 3. Unowned Capability

**Question**: Did the task reveal behavior whose architectural owner cannot be predicted?

Evidence includes:
- Similar logic exists in multiple locations with no canonical owner.
- A new helper appears reusable but its current placement was chosen for convenience.
- A rule spans modules and no existing entity, policy, service, adapter, or Architecture Map names an owner.
- Different consumers resolve the same decision independently.

**Future risk**: Later modifiers cannot find the behavior, choose inconsistent placements, or reinvent it.

When `found`, report:
- the capability and current placement;
- why the placement is unstable;
- plausible existing owners, if any;
- the human decision required;
- one output label: `ownership-needed`, `placement-unclear`, or `duplication-risk`.

Do not silently choose an owner. Removing accidental duplication through an already-established owner is **how-level**; choosing a new owner or shared abstraction is **what-level**.

## 4. Practice Discoveries & Expectation Gaps (Knowledge Sync Lens)

This lens complements the three CMP checks. Even when code placement and boundaries are clean, contact with reality during execution can expose facts that the spec, plan, or human owner did not anticipate—and that vanish inside the final diff.

**Question**: What did practice reveal that differed from expectations, and what must be synchronized back to the human owner?

Fire only on **non-obvious, evidence-backed** episodes:
- **Hidden constraint or nuance**: A real domain rule, dual-purpose model, undocumented precondition, or runtime/tool quirk discovered only when execution hit friction.
- **Expectation deviation / workaround**: A place where the delivered behavior, verification scope, or implementation subtly departed from the original spec or plan.
- **Misleading assumption**: Existing docs, comments, or prior beliefs that proved stale or incomplete in practice.

Do **not** fire for routine debugging, ordinary implementation details, or facts already obvious from the Change spec. Prefer `None` over padding.

For each finding, report:
- `expected vs. actual` (grounded in concrete trace evidence);
- `implication & scope` (what is confirmed vs. uncertain, and whether it is local or general);
- `candidate destination`: `keep local` | `Living Knowledge` | `guidance (AGENTS.md / map / skill)` | `reopen in /cs-spec or /cs-explore`.
