---
name: cs-spec
description: Product Design and Behavior Specification skill for cstack. Creatively designs target product models, responsibilities, external behaviors, Solution Coverage, and Out of Scope guardrails into a single-file Change spec ready for external prototyping or Design.
---

# `/cs-spec` — Product Design & Behavior Specification

Design how the target working system *should* operate based on domain reality and product goals—defining responsibilities, workflows, external behaviors, and explicit boundaries.

> **Core Stance — Design the Product, Not a Mirror of Legacy Reality**
> - Unlike `Explore` (which models reality faithfully), `Spec` is a **creative design** activity: you may reorganize workflows, redefine responsibilities across humans, software, and AI agents, and introduce new product abstractions.
> - Specify **external observable behaviors**, not internal code structure, fragile file paths, or implementation mechanisms (those belong to `Design`).
> - `cstack` does **not** build throwaway prototypes internally; instead, keep Section 3 self-contained and flag UX/interaction hypotheses as `Prototype Candidate` so the user can test them in external prototyping tools and feed conclusions back here.

### CStack Knowledge Contract & Frontier Grilling Protocol

#### 1. Minimal Knowledge Layout (Index + Single-File Change)
- **Routing Index (`index`)**: Always check `.cstack/index.md` first (or a custom index path referenced by the repository). The index is a thin **Context Routing Index** listing:
  1. Where **Living Knowledge** lives (user-defined structure — `docs/`, `GLOSSARY.md`, ADRs, code comments, etc. Never force a rigid directory layout on Living Knowledge).
  2. The **Changes directory** path (default: `.cstack/changes/`).
  3. **Active Changes** and their status (`exploring` | `speccing` | `ready-for-design` | `merged`).
- **Single-File Change (`<changes-dir>/<change-id>.md`)**: Store ALL in-flight exploration and product specification deltas for a single change inside **one Markdown file**.
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
- **Change Knowledge = In-Flight Delta**: Never write unimplemented plans, speculative domain changes, or future behaviors into Living Knowledge during `Explore` or `Spec`. Keep all change-driven deltas inside `<changes-dir>/<change-id>.md` until implementation completes and merges back into Living Knowledge.

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
4. Set the Change file status to `speccing` (and reflect it in `index`).

### Step 2: Product Model & Responsibility Frontier Grilling
Work the unresolved product design choices in structured **Design Tree + Frontier** rounds:
1. **Product Model & Responsibilities**:
   - Propose how domain concepts should be shaped into product abstractions and how responsibilities divide across **Users**, **Software**, **AI Agents**, and **External Systems**.
   - Define target workflows, decision points, handoffs, and authority/permission rules.
2. **Compare Candidates & Surface Trade-offs**:
   - Explicitly distinguish **Confirmed Domain Facts** (from Section 2), **Product Design Choices**, and **Unvalidated Product Hypotheses**.
   - When a candidate product design deviates from a user's original `PS-*`, explain the trade-off transparently rather than silently overwriting it.
3. **Flag External Prototype Candidates**:
   - If a choice hinges on subjective visual layout, multi-step interaction feel, or experiential clarity that cannot be reliably resolved through text alone, mark it explicitly as **`Prototype Candidate`** (stating the exact question to test and 2–3 contrasting directions). The user can take this Change file into an external prototype tool and bring the verdict back to update Section 3.
4. **Update Section 3 Inline**:
   - Immediately persist settled product decisions, behaviors, and boundaries into `<changes-dir>/<change-id>.md` after each round. **Do NOT edit Living Knowledge directly** (strict Delta + Merge).

### Step 3: Lock Behavior Spec, Solution Coverage & Out of Scope
Before closing `Spec`, ensure Section 3 of `<changes-dir>/<change-id>.md` completely covers:
1. **External Behavior & Acceptance Scenarios**:
   - Express key capabilities, state transitions, edge cases, failure/error semantics, and acceptance criteria using clear natural language, concrete examples, and Given-When-Then where helpful (do not force rigid Gherkin boilerplate).
   - Focus strictly on **externally observable behavior** so downstream tests verify behavior rather than internal implementation details.
2. **Mandatory Solution Coverage (`PS-*`)**:
   - Account for **every** `PS-*` recorded in Section 1 using one of four dispositions:
     - `Fulfilled as proposed`
     - `Met via alternative` *(explain how it achieves the underlying motivation)*
     - `Adjusted / Dropped (agreed)` *(record agreed rationale)*
     - `Unresolved` *(must be settled or explicitly deferred before Design)*
   - **Never silently drop an important customer/user proposal.**
3. **Explicit `Out of Scope` Refusal List**:
   - Explicitly list excluded capabilities, edge cases, and non-goals—this is the primary guardrail against scope creep during Design and implementation.
4. **Preliminary Merge Notes (Section 4)**:
   - List which Living Knowledge files/locations (from `index`) should be updated once this change is implemented and verified.

### Step 4: Exit Gate & Handoff
Specification is complete when:
- Target product behaviors, edge cases, and acceptance scenarios are unambiguous enough to drive `Design`;
- Every important `PS-*` has an explicitly agreed disposition in `Solution Coverage`;
- Key Product Decisions and `Out of Scope` boundaries are recorded;
- Any `Prototype Candidates` are either resolved (with verdicts merged into Section 3) or explicitly accepted as deferred;
- The user **explicitly confirms** the specification.

Upon confirmation, update the Change file status to `ready-for-design` (and update `index`), then summarize the finalized spec and ask whether to proceed to `/cs-design` or take the file to an external prototype tool first.

---

## Change File Structure Owned by Spec (Sections 3 & 4)

Write and maintain Sections 3 and 4 inside the **same** `<changes-dir>/<change-id>.md` file:

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

### Product Decisions & Prototype Candidates
- **Decision**: <Choice made> — *Alternatives considered*: <...> — *Rationale*: <...>
- **Prototype Candidate** *(optional, for external prototyping tools)*: <UX/interaction question to validate externally & candidate directions; update with Verdict once tested>

### Out of Scope
- <Explicitly refused feature, edge case, or legacy behavior>

## 4. Living Knowledge Merge Notes
<!-- Consumed after implementation & verification (e.g., during Reflect) to merge realized changes back into Living Knowledge. -->
- **Domain Knowledge to Merge**: <Target Living Knowledge pointer + summary of confirmed additions/revisions>
- **Behavior Knowledge to Merge**: <Target Living Knowledge pointer + summary of new/changed behaviors>
- **Architecture Index Impact**: <Expected Architecture Map updates, if known>
```
