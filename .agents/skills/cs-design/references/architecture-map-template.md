# Architecture Map

Use this template **only** for an explicitly authorized Architecture Map bootstrap task—never create or fill one as an incidental side effect of planning. Register the created map's path under `Living Knowledge` in `.cstack/index.md`.

Keep the map a stable **Context Routing Index**, not a mirror of implementation detail.

- Last updated:
- Architectural decision owners:

## Layer / Module Layout

| Layer or Boundary | Location | Notes |
|---|---|---|
| Entities / domain |  |  |
| Use cases / application |  |  |
| Ports |  |  |
| Adapters / infrastructure |  |  |
| Delivery |  |  |
| Persistence |  |  |
| Tests |  |  |

## Use Case / Capability Catalog

| Use case / Capability | Purpose | Location | Ports used | Key entities |
|---|---|---|---|---|
|  |  |  |  |  |

## Ports and Adapters

| Port | Capability in client language | Location | Adapters | Contract test |
|---|---|---|---|---|
|  |  |  |  |  |

## Core Entities and Invariants

| Entity or Value Object | Owned invariant | Location |
|---|---|---|
|  |  |  |

## Conventions and Placement Rules

- New use case / capability:
- New port:
- New adapter:
- Naming:
- Dependency-rule enforcement:
- Other:

## Known Boundary Debts

| Boundary | Problem | Risk | Owner / status |
|---|---|---|---|
|  |  |  |  |

## Open Ownership Questions

| Capability | Candidate owners | Decision needed |
|---|---|---|
|  |  |  |

## Maintenance Rules

- Record only approved, durable structural facts that make future context navigation cheaper.
- Verify task-relevant entries against code before relying on them.
- Update the map after authorized implementation creates, moves, or resolves a structural route (or during `/cs-reflect` merge).
- Report an unresolved owner or boundary; never settle it through documentation alone.
- Remove entries that merely duplicate obvious code or are too detailed to remain stable.
