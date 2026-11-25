# CMP Case: Clean Architecture (Backend, Services & Domain Modules)

Apply this case when designing **backend services, APIs, workers, CLIs, or domain-centric server modules** where business rules outlive delivery frameworks, databases, and external SDKs.

## 1. When to Use & No-Dogma Guardrail

- **Strong fit**: Domain-rich services, transactional workflows, multi-adapter integrations, background orchestrators, and server-side modules in full-stack applications.
- **No-Dogma Guardrail**: If an endpoint, script, or thin glue module has no meaningful separation between *what* is decided and *how* data is transported/stored, do **not** invent pass-through `UseCase` + `Port` + `Repository` boilerplate that increases Carrying Depth without reducing Context Cost.

## 2. Coordinates & Concern Taxonomy (For Build Plan Section 3)

- **Vertical Owner**: Business capability, bounded context, or application use case (e.g., `billing/invoice-settlement`, `assessment/recommend-standards`).
- **Horizontal Layers**: `entity`, `use case`, `port`, `adapter`, `delivery`, `persistence`, `mapper`, `test` (drop layers with no real responsibility).
- **Classification Tags**:
  - `entity-invariant`: Domain entities, value objects, and state invariants independent of orchestration and IO.
  - `use-case-policy`: Ordered application workflow, policy branching, transaction/consistency scope, and authorization orchestration.
  - `port-contract`: Client-authored interfaces expressed in domain/use-case language (never leaking ORM, HTTP, queue, or vendor SDK types).
  - `adapter-mechanism`: External service clients, queue publishers/consumers, clock/ID/crypto providers implementing a Port.
  - `delivery-mechanism`: HTTP controllers/handlers, RPC routers, GraphQL resolvers, CLI commands, job triggers, request parsing.
  - `persistence-mechanism`: SQL/ORM queries, migrations, repositories, transaction managers, cache storage.
  - `mapping-dto-serialization`: Translating between transport/persistence shapes and domain types at the outer boundary.
  - `test-verification`: Owning-level unit, fake-port use-case, contract, integration, or dependency-direction checks.

## 3. Typical Modification Closures & CMP Transformations

- **`Reduce` (Consolidate Scattered Policy)**: Pull business conditionals, status transitions, and permission invariants out of controllers, SQL queries, and cron scripts into a single owning `Entity` or `Use Case`.
- **`Relocate` (Hide Infrastructure Volatility)**: Keep vendor SDK quirks, retry/pagination mechanics, ORM entities, and SQL joins behind narrow **Use-Case-authored Ports** so local reasoning stops at the port signature.
- **`Index` (Connect Non-Local Closures)**: Explicitly link domain events to handlers, DB schema migrations to persistence mappers, outbox/queue producers to consumers, and Delivery DTOs to Cross-End API Contracts.
- **`Check` (Enforce Inward Dependencies)**: Encode invariants in value objects/types, verify adapter conformance with shared Port contract tests, and guard inward dependency direction (`Delivery / Persistence / Adapters -> Use Cases -> Entities`) via module boundaries or lint/arch tests.

## 4. Boundary Trust & Structural Smells

Rate a touched boundary `untrusted` or `verify` when you spot:
- **Provider-shaped ports**: Interfaces named or shaped around vendor/ORM mechanics (`PrismaUserPort`, passing raw `HttpRequest` or `SqlRow` inward).
- **Controller/Repository policy leakage**: Business rules split between HTTP handlers and repository query builders, forcing modifiers to read the full stack.
- **Direct layer bypass**: Delivery handlers mutating persistence tables directly while an established Use Case owns invariants and side effects for that concept.
- **Anemic pass-through Ceremony**: Three layers forwarding identical fields with zero invariant enforcement or mechanism isolation (`Wrong-shape Risk`).

## 5. Authority Boundary (`What-level` vs. `How-level`)

- **`What-level` (Human Gate if Unresolved)**: Use-case boundaries, owned domain concepts/invariants, port semantics & failure contracts, transaction/eventual-consistency boundaries, cross-module policy ownership, dependency direction changes, or public/cross-end API semantics.
- **`How-level` (Agent Autonomous Within Approved Design)**: Implementing adapters/repositories behind an approved port, DTO/row mappers, controller/CLI wiring, SQL query tuning preserving contract semantics, focused tests, or routing a bypass back through an established Use Case/Port.

## 6. Inside-Out Execution, Verification & Architecture Map Schema

### Inside-Out Implementation & Owning-Level Verification (Build Plan Section 5)
Include only steps touched by the Change:
1. **Entity / Value-Object Invariants** → Pure unit tests (zero IO, zero mocks).
2. **Use-Case Policy Narrative** → Use-case tests against lightweight in-memory/fake Ports verifying decisions, edge cases, and failure semantics.
3. **Client-Authored Ports** → Lock domain-language signatures, side-effect expectations, and error contracts.
4. **Persistence & Infrastructure Adapters** → Adapter integration & Port contract tests against real DB/testcontainers/wire mocks.
5. **Delivery, Mapping & Wiring** → Handler/serialization tests, static dependency checks, and targeted E2E seam verification.

### Clean Architecture Map Sections (When Bootstrapping/Updating a Backend Map)
- **Layer / Module Layout**: `Entities / domain`, `Use cases / application`, `Ports`, `Adapters / infrastructure`, `Delivery`, `Persistence`, `Tests`.
- **Use Case Catalog**: `Use case | Purpose | Location | Ports used | Key entities`.
- **Ports & Adapters**: `Port | Capability in client language | Location | Adapters | Contract test`.
- **Core Entities & Invariants**: `Entity / Value Object | Owned invariant | Location`.
