# Spec Case: Interactive UX & Workflow Usability ("好不好用")

Load this case whenever the Change includes a **user-facing interactive interface** (Web, Desktop, Mobile, or rich TUI)—both on 0→1 Greenfield products and on routine Brownfield feature additions. Skip it for headless APIs, background jobs, CLIs, or pure visual re-skinning where interaction flows do not change.

> **Why This Case Exists**: Step-by-step transaction lists (`1 -> 2 -> 3`) and happy-path `Given-When-Then` scenarios work well for backend APIs, but on the frontend they push coding agents toward **Interaction Slop**: modal fatigue, full-screen blocking spinners, lost scroll/selection context, flat 20-field database forms, and dead-end error toasts.

---

## 1. Anchor in Existing UI Primitives & Visual Baseline (`Facts First`)

Before proposing layouts, interactions, or HTML sketches:
- Check `.cstack/index.md`, any registered `DESIGN.md` / Design System docs, and the codebase for existing **component primitives, design tokens, route shells, and interaction conventions** (how tables, drawers, dialogs, forms, and toasts already behave).
- **Brownfield Rule**: When an established visual system already exists and no redesign was requested, **conform to existing Design Tokens and primitives**—do not re-open brand palette or font debates during routine feature specs. (If visual identity itself is missing or being redesigned, load [`visual-design.md`](visual-design.md) alongside this case.)

## 2. Four Usability Dimensions to Grill & Specify

Raise only the choices that materially affect usability for this Change (via Frontier Grilling):

### A. Spatial Continuity & Context Preservation
- Choose deliberately between **inline action/editing**, **split-view / drawer / popover**, and **modal or full-page navigation**.
- Preserve the user's spatial anchor (scroll position, active filters, selection state, open workspace context) across routine edits and inspections instead of forcing full-list reloads or page jumps.

### B. Feedback Immediacy, Forgiveness & Ergonomics
- **Optimistic & non-blocking by default for reversible actions**: Prefer instant optimistic feedback + **Undo** over repetitive *"Are you sure?"* confirmation modals and screen-blocking spinners. Reserve blocking confirmation strictly for destructive, irreversible, or high-stakes actions.
- **Input preservation**: Never wipe half-completed user input when validation or submission fails; surface errors inline next to the offending field or item with a clear recovery path.
- **Smart defaults & keyboard ergonomics**: Define sensible defaults, initial focus placement, `Enter` / `Esc` semantics, and high-frequency keyboard or bulk actions where relevant.

### C. Information Hierarchy & Progressive Disclosure
- Never mirror raw backend database columns into flat forms or overcrowded tables.
- Separate **primary signals & frequent actions** (immediately visible) from **secondary/advanced configuration** (progressively disclosed on demand).

### D. Complete UI State & Navigation Matrix
Specify observable behavior across non-happy-path states wherever non-trivial:
- **Empty states**: Distinguish *first-time / zero-data onboarding* (with actionable guidance) from *no-match filter/search results* (with quick reset).
- **Loading & refresh states**: Initial skeleton/placeholder vs. background revalidation vs. long-running progress/streaming feedback; double-submit prevention.
- **Partial failure & degradation**: What stays usable when one panel, row action, or secondary query fails?
- **Overflow & viewport adaptation**: Long text/titles, large item counts, and target viewport sizes (desktop split-pane vs. narrow/mobile collapse).
- **URL, refresh & history semantics**: Which states (filters, active tab, selected item, open drawer/step) live in the URL so refresh, deep-linking, and the browser Back button behave predictably, and when unsaved drafts require a leave guard?

## 3. Capture UX-Driven Cross-End Expectations (Handoff to `/cs-build`)

Great interaction UX often depends on backend contract support. Without prescribing internal code or SQL/DTO schemas in `Spec`, explicitly record external behavior expectations that constrain the Backend ↔ Frontend seam:
- **Zero-waterfall workspace views** (cohesive view data rather than sequential client round-trips);
- **Optimistic / autosave / reorder semantics** (safe retries, conflict detection, or undo windows);
- **Actionable capability & error semantics** (explaining why an action is unavailable and mapping failures to specific fields/items rather than generic error strings);
- **Authority vs. visibility** (distinguishing UX hiding/disabling of controls from authoritative server-side permission enforcement).

## 4. Lightweight Flow & Wireframe Sketching

When text leaves a layout or state transition hard to picture:
- Build a minimal single-file HTML sketch in scratch space using clean semantic HTML and lightweight CSS (clicking through Empty / Loading / Active / Error states with vanilla JS if helpful).
- Match the repository's existing component concepts rather than inventing conflicting widget patterns, and treat sketch markup strictly as a disposable alignment aid—persisting all agreed interaction rules into Change Section 3.
