# Architecture Map Guide & Templates

Use this template **only** for an explicitly authorized Architecture Map bootstrap task—never create or fill one as an incidental side effect of planning. Register created map path(s) under `Living Knowledge` in `.cstack/index.md`.

Keep every map a compact **Context Routing Index**, never a mirror of implementation detail.

---

## Topology Rule: One Map or Two Maps? (Guided by CMP)

Choose how many map files to maintain based on the repository's physical structure so single-domain tasks do not load irrelevant context (`Zero-Utility` noise):

1. **Physically Separated Frontend & Backend** (e.g., `backend/` + `frontend/`, Monorepo `apps/api` + `apps/web`, or polyglot Go/Python + TypeScript):
   - Maintain **two Case-specific maps** (`backend-map.md` using Block A + `frontend-map.md` using Block B) and register a clear **Cross-End Seam / Contract pointer** in `.cstack/index.md` (using Block C, either inside `index.md` or a thin `seam-contracts.md`).
   - Backend-only tasks load only the backend map; frontend-only tasks load only the frontend map; full-stack tasks load both plus the seam contract.
2. **Tightly Unified Full-Stack Single App** (e.g., small/medium Next.js App Router, Remix, or SvelteKit repo where route directories co-locate server loaders/actions and UI):
   - Start with **one sectioned `architecture-map.md`** combining Blocks A + C + B (omitting unused tables).
   - Split into separate server and client maps later only if scale grows and `/cs-reflect` + `/cs-merge` surface `Read & Unused (Zero-Utility)` reminders from coarse routing.

---

## Common Header & Governance Footer (Include in Every Map)

- Last updated:
- Architectural decision owners:

### Known Boundary Debts

| Boundary or Seam | Problem | Risk | Owner / status |
|---|---|---|---|
|  |  |  |  |

### Open Ownership Questions

| Capability or State | Candidate owners | Decision needed |
|---|---|---|
|  |  |  |

### Maintenance Rules
- Record only approved, durable structural facts that make future context navigation cheaper.
- Verify task-relevant entries against code before relying on them.
- Update the map after authorized implementation creates, moves, or resolves a structural route (typically settled during `/cs-merge`).
- Report an unresolved owner or boundary; never settle it through documentation alone.
- Remove entries that merely duplicate obvious code or are too detailed to remain stable.

---

## Block A — Backend / Service Sections (`clean-architecture` Case)

### Layer / Module Layout

| Layer or Boundary | Location | Notes / Dependency Rule |
|---|---|---|
| Entities / domain |  |  |
| Use cases / application |  |  |
| Ports |  |  |
| Adapters / infrastructure |  |  |
| Delivery |  |  |
| Persistence |  |  |
| Tests |  |  |

### Use Case / Capability Catalog

| Use case / Capability | Purpose | Location | Ports used | Key entities |
|---|---|---|---|---|
|  |  |  |  |  |

### Ports and Adapters

| Port | Capability in client language | Location | Adapters | Contract test |
|---|---|---|---|---|
|  |  |  |  |  |

### Core Entities and Invariants

| Entity or Value Object | Owned invariant | Location |
|---|---|---|
|  |  |  |

---

## Block B — Frontend / Interactive UI Sections (`frontend-architecture` Case)

### Feature & Shared Topology

| Slice / Layer | Responsibility | Location | Import / Boundary Rule |
|---|---|---|---|
| App routes / shells |  |  |  |
| Feature slices (`features/*`) |  |  |  |
| Shared domain / entities |  |  |  |
| Design System & UI primitives |  |  |  |
| Design Tokens & themes |  |  |  |
| Tests & E2E / browser specs |  |  |  |

### State & Server-Cache Ownership

| Domain / Capability | Canonical Owner (`URL` / `Query Cache` / `Store` / `Local`) | KeyFactory / Store Location | Mutation Invalidation Closure |
|---|---|---|---|
|  |  |  |  |

### Design System & UI Primitives

| Primitive / Pattern | Location | Composition Contract / When to Use |
|---|---|---|
|  |  |  |

---

## Block C — Cross-End Seam & Shared Contracts (Full-Stack Projects)

| Seam / Domain | Canonical Contract Source | Codegen / Sync Route | Server Authority & Client Error/Affordance Rules |
|---|---|---|---|
|  | *(e.g. `packages/contracts/`, `openapi.yaml`, tRPC router)* |  |  |
