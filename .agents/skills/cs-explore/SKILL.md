---
name: cs-explore
description: Problem and Domain Discovery skill for cstack. Uses Design Tree Frontier grilling and concrete examples to uncover real-world domain knowledge, detect terminology conflicts, and faithfully capture proposed solutions into a single-file Change delta.
---

# `/cs-explore` — Problem & Domain Discovery

Understand the real-world problem and business domain faithfully **before** designing the software product.

> **Core Stance — Model Reality, Not the Product Yet**
> - Your job in `Explore` is to discover what is true about the problem, stakeholders, domain concepts, rules, constraints, and existing workflows.
> - Do **not** prematurely design UI, software features, or internal code architecture here—that belongs to `/cs-spec` and `Design`.

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

### Step 1: Orient from Index & Existing Reality (Facts First)
1. Read `.cstack/index.md` (or the repository's registered knowledge index). If missing, prepare to lazily bootstrap it on first write.
2. Read relevant **Living Knowledge** referenced by `index` (domain terms, existing behaviors, architecture pointers).
3. If exploring inside an existing codebase, dispatch `cstack-explorer` (or targeted read-only searches) to gather facts already answerable from code and docs so you never waste user time on codebase-answerable questions.
4. Determine the active change file:
   - If resuming an existing change, open `<changes-dir>/<change-id>.md`.
   - Otherwise, choose a concise kebab-case `<change-id>`, create `<changes-dir>/<change-id>.md` with `Status: exploring`, and register it under `Active Changes` in `index`.

### Step 2: Capture Input & Respect Proposed Solutions
When the user presents a problem, request, or ready-made solution:
1. **Capture Proposed Solutions Faithfully (`PS-*`)**:
   - Record every customer/user-proposed feature, workflow, or mechanism verbatim under `## 1. Problem & Proposed Solutions` with numbered IDs (`PS-1`, `PS-2`, ...), noting the inferred business motivation behind each.
   - **Never** force the user to rephrase their solution into an abstract problem statement, and **never** interrogate them with condescending "why?" chains.
   - Instead, treat their proposal as a high-signal clue: probe concrete scenarios, edge cases, exceptions, and failure modes of the proposal to uncover the underlying domain rules.
2. **Detect Knowledge Gaps & Conflicts**:
   - Check incoming concepts against existing Living Knowledge for synonym drift, contradictory definitions, hidden constraints, missing stakeholders, or unstated assumptions.

### Step 3: Frontier Grilling & Example-Driven Refinement
Work the unresolved knowledge/decision tree in structured rounds:
1. **Ask Only the Current Frontier**:
   - Present only the questions whose upstream prerequisites are already settled.
   - Number each question (`1.`, `2.`, ...), provide your **Recommended Answer / Working Hypothesis**, and briefly state why or what trade-off is at stake.
2. **Stress-Test with Concrete Examples & Counterexamples**:
   - Prefer *"Suppose `<concrete scenario X>` happens—does rule Y still hold, or is that an exception?"* over abstract philosophical questions.
   - Challenge vague or conflicting terminology immediately against Living Knowledge.
3. **Update the Change File Inline (Strict Delta)**:
   - After **every round**, immediately update Sections 1 and 2 of `<changes-dir>/<change-id>.md` with newly confirmed facts, refined domain concepts/rules, and remaining open assumptions.
   - Strictly separate **Confirmed Facts** from **Open Questions & Assumptions**—never promote an unconfirmed hypothesis into a domain fact.
   - **Do NOT edit Living Knowledge directly**; keep all change-driven deltas inside `<changes-dir>/<change-id>.md`.

### Step 4: Exit Gate & Handoff
Exploration is sufficient when:
- The problem, goals, stakeholders, key domain concepts, rules, constraints, and existing practices needed for product design are clearly understood;
- All user-proposed solutions are captured as `PS-*`;
- Remaining uncertainties are explicitly visible under `Open Questions & Assumptions`;
- The user **explicitly confirms** shared understanding.

Present a concise summary of what was confirmed and what remains open, then ask whether to proceed to `/cs-spec` (or continue exploring / stop).

---

## Change File Structure Owned by Explore (Sections 1 & 2)

Write and maintain Sections 1 and 2 inside `<changes-dir>/<change-id>.md`:

```markdown
# Change: <change-id>

- **Status**: `exploring`
- **Related Living Knowledge**: <paths/links from index, or "None (Greenfield)">

## 1. Problem & Proposed Solutions
- **Problem & Goal**: <Real-world problem, desired outcome, and business context>
- **Stakeholders & Constraints**: <Key actors, current responsibilities, hard constraints>
- **Proposed Solutions (Captured)**:
  - **PS-1**: <Faithful description of proposed solution> — *Underlying motivation*: <Why it was proposed>
  - **PS-2**: <...>

## 2. Domain Delta
### Concepts & Relationships
- **<CanonicalTerm>** *(new | refined | conflicts-with `<ExistingTerm>`)*: <Unambiguous domain meaning & relationships>

### Business Rules, Events & States
- <Rule, invariant, lifecycle state, or boundary condition verified via concrete examples>

### Existing Workflows & Practices
- <How the work is currently performed in reality, including pain points and exceptions>

### Confirmed Facts vs. Open Assumptions
- **Confirmed Facts**:
  - <Verified domain truth>
- **Open Questions & Assumptions**:
  - <Unresolved uncertainty or unverified hypothesis, clearly tagged as unconfirmed>
```
