# Living Knowledge Governance & Merge Closeout Plan

Keep the proposal compact so the human can review and approve in seconds. Perform **zero writes** until approved.

## 1. Reconciliation Summary

- **Active Change**: `<changes-dir>/<change-id>.md` (`Status: <status>`)
- **Diff Baseline**: `<base>...HEAD` *(or commit range)*
- **Trace Handoff (`Section 4`)**: `Present` | `Missing — degraded to Sections 1–3 + final diff`
- **Touched Knowledge Slice Inspected**: `<paths#sections>` *(or `None registered yet`)*
- **Shipped vs. Spec Deviations**: `None` *(or brief list of spec items adjusted/dropped in final diff)*

## 2. Touched-Slice Governance Proposals (`[M-*]`)

*(Omit empty action groups; write `None — Living Knowledge already matches shipped state` if no edits are needed.)*

### `ADD` (New Canonical Truth)
- **`[M-1]` `<target-doc#section>`**: <Concise addition — domain rule, behavior, Why, or routing entry>

### `RESOLVE` (Conflicts Requiring Verdict)
- **`[M-2]` `<target-doc#section>`**:
  - *Doc says*: <...>
  - *Final code / reality (`<file#L..>`)*: <...>
  - *Recommended verdict*: <...>

### `COMPRESS` (Consolidate / Sink)
- **`[M-3]` `<target-doc#section>`**: <Replace N scattered caveats with compact rule/table; note optional code/test/lint check>

### `PRUNE` (Obsolete / Contradicted / Code-Internalized)
- **`[M-4]` `<target-doc#section>`** *(`obsolete` | `contradicted` | `internalized in <file/test>`)*: <Exact stale rule/passage to delete and verification evidence>

## 3. Advisory Reminders (`[A-*]` — Confirm Before Modifying)

*(For non-dead `Zero-Utility` context, coarse `.cstack/index.md` pointers, or unverified staleness; `None` if none.)*

- **`[A-1]` `<target-doc or .cstack/index.md>`**: <Why surfaced + options: `keep as-is (default)` | `narrow index.md pointer` | `prune / edit`>

## 4. Deferred Refactor Routing (`[R-*]` from Section 4.1)

*(List any `pending` or `defer-to-followup` items so nothing vanishes when the Change file is deleted; `None` if all resolved.)*

- **`[R-1]` `<title>`** (`<file/module>`):
  - *Recommended route*: `Create follow-up Change stub` | `Add to Architecture Map -> Known Boundary Debts` | `External Issue` | `Close as wont-fix`

## 5. Closeout Actions & Approval Gate

Upon approval, `/cs-merge` will:
1. Apply approved `[M-*]` proposals (and any explicitly opted-in `[A-*]` reminders) to Living Knowledge;
2. Route `[R-*]` deferred refactors per your choice;
3. Update `.cstack/index.md` (register any new Living Knowledge files; remove `<change-id>` from `Active Changes`);
4. **Delete `<changes-dir>/<change-id>.md`** (preserved in Git history; say `archive` or `keep` to override) and clear consumed `.cstack/friction.log` entries.

**Reply to approve** (e.g., `all`, `M-1, M-3, M-4`, `skip M-2`, `apply A-1 (narrow index)`, `R-1 -> Known Boundary Debts`).
