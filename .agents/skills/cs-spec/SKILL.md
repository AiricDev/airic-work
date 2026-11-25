---
name: cs-spec
description: Product Design and Behavior Specification skill for cstack. Creatively designs target product models, responsibilities, external behaviors, Solution Coverage, and Out of Scope guardrails into a single-file Change spec ready for development.
---

# `/cs-spec` — Product Design & Behavior Specification

Design how the target working system *should* operate based on domain reality and product goals—defining responsibilities, workflows, external behaviors, and explicit boundaries.

> **Core Stance — Design the Product, Not a Mirror of Legacy Reality**
> - Unlike `Explore` (which models reality faithfully), `Spec` is a **creative design** activity: you may reorganize workflows, redefine responsibilities across humans, software, and AI agents, and introduce new product abstractions.
> - Specify **external observable behaviors**, not internal code structure, fragile file paths, or implementation mechanisms (those belong to `/cs-build`).

### CStack Knowledge Contract & Frontier Grilling Protocol

#### 1. Minimal Knowledge Layout (Index + Single-File Change)
- **Routing Index (`index`)**: Always check `.cstack/index.md` first (or a custom index path referenced by the repository). The index is a thin **Context Routing Index** listing:
  1. Where **Living Knowledge** lives (user-defined structure — `docs/`, `GLOSSARY.md`, ADRs, code comments, etc. Never force a rigid directory layout on Living Knowledge).
  2. The **Changes directory** path (default: `.cstack/changes/`).
  3. **Active Changes** and their status (`exploring` | `speccing` | `ready-to-build` | `reflected`; removed once settled by `/cs-merge`).
- **Single-File Change (`<changes-dir>/<change-id>.md`)**: Store ALL in-flight exploration, product specification, and post-coding reflection clues for a single change inside **one Markdown file** (Sections 1–4).
- **Lazy Bootstrap**: If `.cstack/index.md` does not exist yet (Greenfield or first use), create a minimal `.cstack/index.md` on first write using this skeleton—do not scaffold extra directories or empty template docs:
  ```markdown
  # Knowledge Index

  ## Living Knowledge
  <!-- Register existing domain, product behavior, or architecture knowledge locations here. Any layout is allowed. -->
  - (None registered yet — Greenfield or add pointers to existing docs/code)

  ## Changes Directory
  - Path: `.cstack/changes/`

  ## Active Changes
  - (None yet)
  ```

#### 2. Strict Delta + Merge Discipline
- **Living Knowledge = Current Realized Reality**: Describes what is currently true about the domain, product behavior, and system. Users may directly edit Living Knowledge at any time to fix inaccurate descriptions of current reality.
- **Change Knowledge = In-Flight Delta**: Never write unimplemented plans, speculative domain changes, or future behaviors into Living Knowledge during `Explore` or `Spec`. Keep all change-driven deltas inside `<changes-dir>/<change-id>.md` until implementation completes, `/cs-reflect` captures execution-trace signals, and `/cs-merge` settles realized truth into Living Knowledge.

#### 3. Frontier Grilling & Human Authority Protocol
- **Facts First (Never Ask What Code/Docs Already Know)**: Before questioning the user, read `index`, relevant Living Knowledge, and the codebase (preferring `cstack-explorer` for broad searches so raw search noise stays out of the main context window). Only ask the user questions that require human business judgment, domain truth, or product choice.
- **Design Tree + Frontier Rounds**: Model unresolved questions as a dependency tree. In each round, ask **only the current frontier** (questions whose upstream prerequisites are already settled—never ask downstream questions that depend on unanswered upstream choices).
- **Recommended Answers + Anti-Rubber-Stamping**: Number every question and give a concise **Recommended Answer** with brief reasoning. On high-impact or hard-to-reverse decisions, explicitly surface trade-offs and concrete counterexamples so the user engages critically instead of rubber-stamping `"agreed"`.
- **Inline Continuous Persistence**: Update `<changes-dir>/<change-id>.md` **immediately as facts and decisions crystallize** after each round—never wait until the end of the session to summarize from memory.
- **Explicit Confirmation Gate**: Never silently promote an unconfirmed assumption into a confirmed fact, and never auto-advance to the next stage without explicit user confirmation of shared understanding.

---

## Operating Procedure

### Step 1: Load Context & Brownfield Fast-Path Check
1. Read `.cstack/index.md` (or the repository's registered knowledge index) and relevant **Living Knowledge**.
2. Open the active Change file `<changes-dir>/<change-id>.md` if one already exists from `/cs-explore`.
3. **Brownfield Fast-Path (Direct Spec Invocation)**:
   - If invoked directly without a prior `Explore` session on a **small, well-understood incremental change**: inspect Living Knowledge and the codebase (using `cstack-explorer` for broad lookups), create `<changes-dir>/<change-id>.md`, register it in `index`, and fill in concise Sections 1 and 2 (including any user-proposed `PS-*`) inline.
   - If you uncover unfamiliar domain rules, major terminology conflicts, or deep hidden constraints: **pause and recommend switching to `/cs-explore`** before locking product behavior.
4. **Select On-Demand Product Spec Case(s) (Zero Bloat for Headless Tasks)**:
   - **Interactive UX & Usability (`好不好用`)** → When the Change includes a user-facing interactive interface, read [`references/cases/interactive-ux.md`](references/cases/interactive-ux.md) to check existing UI primitives first and specify spatial continuity, optimistic/undo ergonomics, progressive disclosure, complete UI/URL state matrices, and UX-driven cross-end expectations.
   - **Visual Direction & Style System (`好不好看`)** → When establishing **0→1 Greenfield UI**, **visual redesigns**, **brand/showcase pages**, or **a new visual language** (no mature `DESIGN.md` / Design Token system exists yet), also read [`references/cases/visual-design.md`](references/cases/visual-design.md) to lock purpose-calibrated tone/density, typography/surface/color pillars, and explicit visual anti-slop guardrails. **Skip `visual-design.md`** on routine Brownfield feature tasks that inherit an already-settled Design System.
   - **Headless Backend / API / CLI / Batch** → Skip both UI cases.
5. Set the Change file status to `speccing` (and reflect it in `index`).

### Step 2: Product Model & Responsibility Frontier Grilling
Work the unresolved product design choices in structured **Design Tree + Frontier** rounds:
1. **Product Model & Responsibilities**:
   - Propose how domain concepts should be shaped into product abstractions and how responsibilities divide across **Users**, **Software** (including Client UX vs. Server Authority when full-stack), **AI Agents**, and **External Systems**.
   - Define target workflows, decision points, handoffs, and authority/permission rules (plus usability mechanics when `interactive-ux.md` applies, and visual tone/token pillars when `visual-design.md` applies).
2. **Compare Candidates & Surface Trade-offs**:
   - Explicitly distinguish **Confirmed Domain Facts** (from Section 2), **Product Design Choices**, and **Unvalidated Product Hypotheses**.
   - When a candidate product design deviates from a user's original `PS-*`, explain the trade-off transparently rather than silently overwriting it.
3. **Sketch the Current Choice in HTML When Helpful**:
   - When text leaves a layout, state transition, or visual aesthetic hard to judge, build a minimal single-file HTML sketch in scratch space showing only what helps resolve the current choice:
     - *Visual Style Tile (`visual-design.md` active)*: Use **native CSS Custom Properties** (`--bg-*`, `--fg-*`, `--accent`, font pairings) and realistic domain content—**never Bootstrap CDN**—so the user can inspect real typography, surface contrast, and tone.
     - *Flow / Layout Wireframe (`interactive-ux.md` only)*: Use clean semantic HTML, minimal CSS aligned with the repository's existing component idioms, and light vanilla JavaScript if clicking through states helps.
   - Discuss and revise the sketch as needed. Treat depicted choices as proposals until confirmed, and treat scratch HTML files strictly as disposable aids. Write all agreed behaviors, state rules, visual pillars, and rationale into Section 3 so the Change stands on its own after the sketch is discarded.
4. **Update Section 3 Inline**:
   - Immediately persist settled product decisions, behaviors, and boundaries into `<changes-dir>/<change-id>.md` after each round. **Do NOT edit Living Knowledge directly** (strict Delta + Merge).

### Step 3: Lock Behavior Spec, Solution Coverage & Out of Scope
Before closing `Spec`, ensure Section 3 of `<changes-dir>/<change-id>.md` completely covers:
1. **External Behavior & Acceptance Scenarios**:
   - Express key capabilities, state transitions, edge cases, failure/error semantics, and acceptance criteria using clear natural language, concrete examples, and Given-When-Then where helpful (do not force rigid Gherkin boilerplate).
   - When `interactive-ux.md` applies, cover non-happy-path UI states (empty, loading/optimistic, partial failure, overflow, URL/refresh/Back behavior) and UX-driven cross-end expectations; when `visual-design.md` applies, record the approved visual pillars/token semantics and explicit visual anti-slop guardrails.
   - Focus strictly on **externally observable behavior and visual/interaction contracts** so downstream design and verification test real product intent rather than internal implementation details.
2. **Mandatory Solution Coverage (`PS-*`)**:
   - Account for **every** `PS-*` recorded in Section 1 using one of four dispositions:
     - `Fulfilled as proposed`
     - `Met via alternative` *(explain how it achieves the underlying motivation)*
     - `Adjusted / Dropped (agreed)` *(record agreed rationale)*
     - `Unresolved` *(must be settled or explicitly deferred before `/cs-build`)*
   - **Never silently drop an important customer/user proposal.**
3. **Explicit `Out of Scope` Refusal List**:
   - Explicitly list excluded capabilities, edge cases, and non-goals—this is the primary guardrail against scope creep during `/cs-build`.
   - Do **not** pre-plan documentation updates here; mapping realized changes back into Living Knowledge belongs to `/cs-merge`.

### Step 4: Exit Gate & Handoff
Specification is complete when:
- Target product behaviors, edge cases, and acceptance scenarios are unambiguous enough to drive `/cs-build`;
- Every important `PS-*` has an explicitly agreed disposition in `Solution Coverage`;
- Key Product Decisions and `Out of Scope` boundaries are recorded;
- Open product questions that affect the handoff are resolved in Section 3 or explicitly deferred with the user's agreement;
- The user **explicitly confirms** the specification.

Upon confirmation, update the Change file status to `ready-to-build` (and update `index`), then summarize the finalized spec and ask whether to proceed to `/cs-build`.

---

## Change File Structure Owned by Spec (Section 3)

Write and maintain Section 3 inside the **same** `<changes-dir>/<change-id>.md` file (preserving Section 4 `Reflection & Merge Handoff` if re-entering an existing Change):

```markdown
## 3. Product Design & Behavior Spec

### Product Model & Responsibilities
- **Product Abstractions**: <Concepts introduced or reshaped for the product>
- **Role Division**: <What Users, Software, AI Agents, and External Systems are each responsible for>

### Target Workflows
1. <Step-by-step target working flow, decision points, and authority boundaries>

### Behavior Specification & Acceptance Scenarios
- **<Capability / Behavior Name>**:
  - *Behavior & Rules*: <Observable outcomes, state transitions, permissions, failure semantics>
  - *Concrete Scenarios*:
    - **Scenario 1**: Given <context>, when <action/event>, then <observable outcome>.
    - **Edge / Failure Case**: <Boundary condition and expected system response>.

### Solution Coverage
| Proposal ID | Summary | Disposition | Rationale / Mapped Behavior |
| :--- | :--- | :--- | :--- |
| `PS-1` | <Original proposal> | `Fulfilled as proposed` / `Met via alternative` / `Adjusted or dropped` / `Unresolved` | <Why and where it is addressed> |

### Product Decisions
- **Decision**: <Choice made> — *Alternatives considered*: <...> — *Rationale*: <...>
- **Open Question** *(if any)*: <Unresolved choice and how to validate it or what deferral the user agreed to>

### Out of Scope
- <Explicitly refused feature, edge case, or legacy behavior>
```
