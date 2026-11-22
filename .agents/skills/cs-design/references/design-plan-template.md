# Full Design Plan Template

Print this plan in conversation as a decision-focused alignment tool (do not write a separate design doc). Omit empty rows and sections that add no information.

## 1. Intent, Spec Anchor & Authority

- Active Change / Spec: *(e.g. `.cstack/changes/<change-id>.md` or "Direct request")*
- Intended behavior change:
- Behavior to preserve:
- Out of Scope guardrails:
- Success criteria:
- Settled product or design decisions:
- Genuine ambiguities *(flag product ambiguities to resolve via `/cs-spec`)*:

## 2. Context Route & Modification Closure

- Natural entry point:
- Routing signals followed:
- Sufficient context acquired:
- Trustworthy stopping boundaries:
- Intentionally excluded regions and why:
- Routing gaps / friction found *(also log to `.cstack/friction.log` if active)*:

| Artifact | Role | Change or verify | Why it belongs to the closure |
|---|---|---|---|
|  | primary / sibling / downstream / verification |  |  |

## 3. Policy, Mechanism & CMP Placement

| Concern | Classification | Vertical owner | Horizontal layer / module | Policy / mechanism / boundary / placement | CMP move & evidence |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

- **Classification**: `entity-invariant`, `use-case-policy`, `port-contract`, `adapter-mechanism`, `delivery-mechanism`, `persistence-mechanism`, `mapping-dto-serialization`, `test-verification`, `ownership-placement`, or `architecture-boundary`.
- **CMP moves**: `Reduce`, `Relocate`, `Index`, `Check` (note Wrong-shape vs. Unindexed-closure trade-offs if non-obvious).
- Use `ownership-needed` when no vertical owner is established and `placement-review` when placement is unresolved.

## 4. Boundaries & Human Decisions

| Boundary or capability | Trust | Existing contract or owner | Planned action | Authority |
|---|---|---|---|---|
|  | trusted / verify / untrusted |  |  | how-level / resolved what-level / unresolved what-level |

Unresolved human design gates only:

- Decision:
- Options and CMP trade-offs:
- Safe How-level work that can continue independently:

Write `None` when no unresolved gate exists.

## 5. Inside-Out Implementation, Contracts & Verification

Pair tests with the layer whose behavior they express. Include only applicable steps:

1. Specify or test the relevant invariant or use-case behavior.
2. Implement entity / value-object invariant changes.
3. Implement the use-case policy narrative.
4. Define or adjust client-authored ports (keeping provider types outward).
5. Implement adapter mechanisms and contract/integration tests.
6. Implement delivery, mapping, persistence, and wiring changes.
7. Add required Semantic Comments (Semantic Contracts / Modification Closure Indexes only) and run owning-level tests, dependency checks, and necessary E2E coverage.

- Concrete implementation steps:
- Tests and static checks (by owning level):
- Semantic contracts / closure indexes to encode in comments *(if any)*:
- Manual review focus on policy or contract decisions:
- Later Architecture Map / Merge Notes update *(only if an approved structural route changes)*:
- Agent may implement now:
- Agent must not decide without approval:
- Next step: `proceed` / `resolve gate` / `return to /cs-spec` / `inspect more context`
