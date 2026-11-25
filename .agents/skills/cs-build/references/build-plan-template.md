# Full Build Plan Template

Print this plan in conversation as a decision-focused alignment and execution guide (do not write a separate design doc). Omit empty rows and sections that add no information.

## 1. Intent, Spec Anchor & Active CMP Case(s)

- Active Change / Spec: *(e.g. `.cstack/changes/<change-id>.md` or "Direct request")*
- Active CMP Case(s): *(`clean-architecture` | `frontend-architecture` | `clean-architecture + frontend-architecture (full-stack)` | `direct-cmp (lightweight)`)*
- Intended behavior change:
- Behavior to preserve:
- Out of Scope guardrails:
- Success criteria:
- Settled product or architectural decisions:
- Genuine ambiguities *(flag product or UX state ambiguities to resolve via `/cs-spec`)*:

## 2. Context Route & Modification Closure

- Natural entry point:
- Routing signals followed:
- Sufficient context acquired:
- Trustworthy stopping boundaries:
- Intentionally excluded regions and why:
- Routing gaps / friction found *(also log to `.cstack/friction.log` if active)*:

| Artifact | Role | Change or verify | Why it belongs to the closure |
|---|---|---|---|
|  | primary / seam-contract / sibling / downstream / verification |  |  |

## 3. Policy, Mechanism & CMP Placement

| Concern | Classification | Vertical owner | Horizontal layer / slice | Policy / state-owner / contract / mechanism | CMP move & evidence |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

- **Classification**: Use the concrete concern tags from the loaded CMP Case(s) (e.g., `entity-invariant`, `use-case-policy`, `port-contract`, `adapter-mechanism`, `delivery-mechanism`, `persistence-mechanism` for Clean Architecture; `viewmodel-domain-policy`, `interaction-state-machine`, `state-ownership-boundary`, `server-cache-adapter`, `ui-primitive-mechanism`, `route-feature-composition` for Frontend Architecture; plus `cross-end-seam`, `ownership-needed`, or `placement-review` when applicable).
- **CMP moves**: `Reduce`, `Relocate`, `Index`, `Check` (note Wrong-shape vs. Unindexed-closure trade-offs if non-obvious).

## 4. Boundaries, Cross-End Seam & Human Gates

| Boundary, state host, or seam | Trust | Existing contract or owner | Planned action | Authority |
|---|---|---|---|---|
|  | trusted / verify / untrusted |  |  | how-level / resolved what-level / unresolved what-level |

*(When spanning Backend + Frontend, include a row for the **Cross-Boundary Seam**: canonical contract source, server policy authority vs. UI affordance projection, and UX-driven read/write/error semantics.)*

Unresolved human gates only:

- Decision:
- Options and CMP trade-offs:
- Safe How-level work that can continue independently:

Write `None — proceeding directly to inside-out build` when no unresolved gate exists.

## 5. Inside-Out Execution & Owning-Level Verification

Follow the inside-out sequence of the active CMP Case(s), pairing every step with verification at its owning level (include only applicable steps):

- **Single-domain change**: Core invariants / pure ViewModel & state transitions → Use-case policy / headless & cache contracts → Client-authored Ports / DTO & Token boundaries → Adapters, UI primitives, delivery/composition & wiring.
- **Full-stack change (`clean-architecture + frontend-architecture`)**: Lock core domain policy + Cross-Boundary Contract first → build Backend inside-out and Frontend inside-out against that locked contract → close with wired end-to-end & live-browser verification.

- Concrete build steps:
- Tests, static checks & browser verification (by owning level; require live browser check whenever UI layout, CSS styling/stacking, routing, or hydration changes):
- Semantic contracts / closure indexes to encode in comments *(if any)*:
- Later Architecture Map impact *(settled via `/cs-merge`; only if an approved structural route changes)*:
- Execution status: `building now (no unresolved gates)` / `paused at unresolved What-level gate` / `return to /cs-spec` / `inspect more context`
