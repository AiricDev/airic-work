# Post-Change Design Reflection

Keep the report concise. Use `—` where a field does not apply. Perform **zero writes** until the user responds to the Human Review Gate.

## Trace Coverage

- Live route available:
- Supplementary `.cstack/friction.log` entries used: `None` unless read for compaction/handoff recovery.
- Important gaps:
- Additional fact checks performed: `None` unless a specific uncertainty required one.
- Overall confidence: `high | medium | low`

## Task Route & Modification Closure

- Natural entry point and useful routing signals:
- Misleading paths, corrections, shortcuts, or placement uncertainty:
- Final placement & artifacts that had to stay consistent together:
- Verification used:

## CMP Checks

| Check | Result | Evidence | Future Risk | Confidence | Level |
|---|---|---|---|---|---|
| Missing Path | `found | not-found | unknown` | | | | `how-level | what-level | —` |
| Boundary Bypass | `found | not-found | unknown` | | | | `how-level | what-level | —` |
| Unowned Capability | `found | not-found | unknown` | | | | `how-level | what-level | —` |

## Refactor Proposals (`[R-*]`)

*(Write `None — no actionable structural friction found` when all checks are `not-found`.)*

- **`[R-1]` `<Missing Path | Boundary Bypass | Unowned Capability>`** — `<file/module>` (`<how-level | what-level>`)
  - **Symptom & CMP Root Cause**:
  - **Refactor Proposal** *(include options & CMP trade-offs if `what-level`)*:
  - **Recommended Action**: `Execute now in /cs-reflect` | `defer-to-followup (avoid PR scope creep)` | `Reopen /cs-spec or /cs-explore`

## Practice Discoveries & Expectation Gaps (Human Sync)

*(Report only non-obvious friction discoveries or deviations from expected outcome; write `None` if execution matched expectations.)*

- **Expected vs. actual**:
- **Evidence & scope**:

## Section 4 Handoff Preview (Ephemeral Clues for `/cs-merge`)

- **Target Change file**: `<changes-dir>/<change-id>.md` *(or `Fast Path — create compact Change file` / `None — zero-overhead Fast Path`)*
- **4.2 Touched Knowledge Slice**:
  - *Read & Used*:
  - *Contradicted / Stale*:
  - *Read & Unused (Zero-Utility)*:
- **4.3 Trace Clues for `/cs-merge`**:
  - *Spec Deviations & Hidden Why*:
  - *Contradicted Claims / Code-Internalized Guardrails*:
  - *Exception Hotspots & Structural Routes*:

## Human Review Gate

1. **Refactors**: Which `[R-*]` proposals should be **executed now in `/cs-reflect`** (and which option if `what-level`), vs. recorded as `defer-to-followup` or `wont-fix`?
2. **Merge Handoff**: Confirm writing Section 4 (`4.1–4.3`) to the Change file for `/cs-merge` *(Living Knowledge routing & edits remain untouched until `/cs-merge`)*.
