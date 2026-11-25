# CMP Case: Frontend & Interactive UI Architecture

Apply this case when designing **interactive web/client applications, SPAs, rich workbenches, or client/UI slices of full-stack frameworks** (React, Vue, Svelte, Solid, Next.js/Remix client & route layers, desktop/mobile UI).

## 1. When to Use & No-Dogma Guardrail

- **Strong fit**: Stateful interactive features, complex forms/editors, data-heavy dashboards, optimistic/async workflows, shared UI primitives, and client-server cache coordination.
- **No-Dogma Guardrail**: Do **not** transplant backend Java-style `Entity -> UseCaseClass -> RepositoryInterface` ceremony onto UI components, and do **not** extract headless hooks or state machines for simple presentational leaves with trivial local state (`Wrong-shape Risk`).

## 2. Coordinates & Concern Taxonomy (For Build Plan Section 3)

- **Vertical Owner**: Prefer **Feature Colocation** (`features/<capability>/` owning its view-models, hooks, queries, and feature components), reserving shared roots for domain-agnostic **Design System / UI Primitives** (`shared/ui/`, tokens) and genuinely cross-feature domain models/contracts.
- **Horizontal Concerns & Classification Tags**:
  - `viewmodel-domain-policy`: Pure calculations, filtering/sorting/formatting rules, form validation schemas, and discriminated-union view states (zero DOM or framework lifecycle coupling).
  - `interaction-state-machine`: Multi-step flows, draft/dirty/autosave lifecycles, optimistic-update & rollback transitions, keyboard/focus/selection coordination.
  - `state-ownership-boundary`: Selecting and bounding the **Single Source of Truth** across the 5 frontend state hosts (see Section 3).
  - `server-cache-adapter`: API DTO → frontend model mapping, Query Key factories, **Cache Invalidation Closure**, optimistic cache updaters, and SSR/loader hydration handoff.
  - `ui-primitive-mechanism`: Domain-blind Design System components, headless accessibility (a11y) primitives, layout shells, and CSS/Design Tokens.
  - `route-feature-composition`: Page/route assembly, URL search-param binding, Suspense/Error boundaries, and browser host APIs (`ResizeObserver`, storage, clipboard, media).
  - `test-browser-verification`: Pure logic unit tests, component/a11y interaction tests, and **live browser / visual verification**.

## 3. State Ownership & CMP Transformations in Frontend

### First Rule of Frontend CMP: Explicit Single Source of Truth
Every piece of state must have **exactly one canonical owner** among five hosts:
1. **URL / Router State** — Shareable, bookmarkable, survives refresh/Back button (filters, search query, active tab, selected resource/drawer ID).
2. **Server Cache State** (e.g., TanStack Query / SWR / Apollo / RSC payload) — Remote async truth with caching, background revalidation, and mutation invalidation.
3. **Shared Client Store** (e.g., Zustand / Pinia / Redux / Context) — Cross-feature ephemeral client session/workspace state not owned by server or URL.
4. **Local Component State** — Narrow, single-subtree ephemeral UI state (input draft, open popover, hover/animation).
5. **Pure Derived State** — Computed synchronously during render/selectors from owners 1–4.
   - **Strict Anti-Pattern**: Never copy URL state, Server Cache data, props, or computable Derived State into `useState` and synchronize them with `useEffect` chains.

### Four CMP Transformations Applied to UI
- **`Reduce` (Eliminate State Soup, Style Drift & Duplication)**:
  - Replace scattered boolean flags (`isLoading`, `isError`, `isEmpty`, `isSubmitting`) with explicit discriminated-union UI states so impossible state combinations cannot exist.
  - Consolidate scattered query keys into a feature **Query Key Factory** so cache reads and invalidations share one owner.
  - Centralize visual roles (surface elevation tiers, foreground hierarchy, primary/status accents, typography scale & `tabular-nums`, spacing/radius/motion) into semantic **CSS Custom Properties / Design Tokens** as the **Single Source of Visual Truth**—never scatter raw hex values or one-off font/shadow overrides across feature files.
- **`Relocate` (Quarantine DTOs & Imperative DOM)**:
  - Map raw backend transport DTOs (nullable quirks, snake_case fields, error codes) at the `server-cache-adapter` boundary so JSX trees depend only on clean UI/domain models.
  - Isolate imperative third-party DOM/Canvas/editor/chart libraries behind a narrow wrapper component or hook.
  - Keep `shared/ui` primitives strictly business-agnostic (no domain imports or hardcoded business copy).
- **`Index` (Connect Frontend Modification Closures)**:
  - **Cache Invalidation Closure**: Explicitly connect every mutation to the exact query keys / optimistic caches it must update or invalidate.
  - **URL ↔ View Closure**: Co-locate or index URL search-param parsing/serialization schemas with the route/filter controls that read and write them.
  - **Token & Locale Closure**: Connect new semantic colors/spacings/statuses across light/dark theme tokens and i18n locale dictionaries.
- **`Check` (Mechanical UI Guardrails)**:
  - Use exhaustive `switch` / `never` checks on UI state unions so every state (empty, loading, error, active) is handled.
  - Prefer **Composition / Slots / Compound Components** over adding boolean mode props (`isCompactWithoutHeader`) to shared components.
  - Enforce feature boundaries and Design System token/primitive usage via lint/import rules where available.

## 4. Boundary Trust & Frontend Structural Smells

Rate a boundary `untrusted` or `verify` when you spot:
- **Effect-driven state sync**: `useEffect` watching state/props purely to `setState` elsewhere (high risk of stale renders, loops, and hidden coupling).
- **DTO penetration**: Deep presentational components importing raw backend API response types or duplicating backend permission conditionals.
- **Boolean-prop explosion (`God Component`)**: Shared UI component branching on 5+ boolean flags for different product screens instead of exposing composable slots or distinct variants.
- **Design System, Token & stacking bypass**: Ad-hoc hex colors, rogue font imports, nested bordered card-in-card clutter, raw unaccessible `<div onClick>` controls bypassing existing primitives, magic `z-index: 9999` escalations, or parent `overflow: hidden` / `transform` silently breaking sticky/fixed children.
- **Client-only security illusion**: Treating hidden/disabled UI buttons or client route guards as authorization without server-side enforcement.

## 5. Authority Boundary (`What-level` vs. `How-level`)

- **`What-level` (Human Gate if Unresolved)**:
  - Choosing the state owner when trade-offs affect UX (e.g., should filter/drawer state live in the URL vs. local memory? cross-feature store vs. server cache?);
  - Creating or altering a shared Design System primitive, global Design Token, or cross-feature layout contract;
  - Optimistic instant update + Undo vs. blocking confirmation/spinner semantics;
  - Server vs. Client rendering/serialization boundary placement (e.g., RSC `'use client'` split, SSR vs. client fetch).
- **`How-level` (Agent Autonomous Within Approved Design)**:
  - Extracting pure ViewModel helpers, reducers, or local headless hooks inside a feature slice;
  - Mapping API DTOs inside an established query/adapter layer and wiring query-key invalidation;
  - Decomposing large JSX trees into focused presentational subcomponents using existing Design System primitives and tokens;
  - Replacing accidental `useEffect` derived-state sync with pure computation.

## 6. Inside-Out Execution, Verification & Architecture Map Schema

### Inside-Out Implementation & Owning-Level Verification (Build Plan Section 5)
Include only steps touched by the Change:
1. **Pure ViewModel, Schemas & State Transitions** → Fast, DOM-free unit tests covering calculations, validation, and state-machine edge cases.
2. **Server-Cache Adapter & Headless Hooks** → Implement DTO mappers, Query Key factories, mutation invalidation / optimistic rollback closures, and URL/store bindings; verify with hook/contract tests.
3. **Design Tokens, UI Primitives & Feature Composition** → On 0→1 or visual redesigns, lock semantic Design Tokens & foundational primitives first; on Brownfield features, compose strictly from existing tokens/primitives, implementing the full UI State Matrix (empty, loading/skeleton, optimistic, inline/partial error, overflow, keyboard/focus, `tabular-nums` alignment).
4. **Owning-Level UI & Live Browser Verification**:
   - Component/interaction tests for behavioral & a11y contracts (roles, labels, keyboard navigation).
   - **Mandatory Live Browser Verification** (Playwright / browser subagent / Chrome DevTools) whenever layout, CSS styling/tokens, stacking context (`z-index`/modals/popovers), scroll/responsive breakpoints, URL navigation, or SSR hydration is touched—**never treat JSDOM/unit tests alone as proof that visual layout and real browser runtime work**.

### Frontend Architecture Map Sections (When Bootstrapping/Updating a Frontend Map)
- **Feature & Shared Topology**: `Slice / Layer (app routes, features/*, entities/*, shared/ui, tokens) | Responsibility | Location | Import boundary rule`.
- **State & Server-Cache Ownership**: `Domain / Capability | Canonical Owner (URL / Query Cache / Store / Local) | Key / Store Location | Mutation Invalidation Closure`.
- **Design System & UI Primitives**: `Primitive / Token Group | Location | Composition Contract / When to Use`.
- **Cross-End API & Runtime Boundaries**: `Client Adapter / Loader | Contract Source | Auth / Error / SSR Rules`.
