# Post-Change Design Reflection

Keep the report concise. Use `—` where a field does not apply.

## Trace Coverage

- Live route available:
- Supplementary `.cstack/friction.log` entries used: `None` unless read for compaction/handoff recovery.
- Important gaps:
- Additional fact checks performed: `None` unless a specific uncertainty required one.
- Overall confidence: `high | medium | low`

## Task Route

- Natural entry point and useful routing signals:
- Misleading paths, corrections, shortcuts, or placement uncertainty:
- Final placement decision and why it appeared to fit the existing design:

## Modification Closure

- Expected route for a future modifier:
- Files, contracts, tests, and guidance that had to stay consistent:
- Verification used:

## CMP Checks

| Check | Result | Evidence | Future Risk | Confidence | Level |
|---|---|---|---|---|---|
| Missing Path | `found | not-found | unknown` | | | | `how-level | what-level | —` |
| Boundary Bypass | `found | not-found | unknown` | | | | `how-level | what-level | —` |
| Unowned Capability | `found | not-found | unknown` | | | | `how-level | what-level | —` |

## Practice Discoveries & Expectation Gaps

*(Report only non-obvious friction discoveries or deviations from expected outcome; write `None` if execution matched expectations.)*

- **Expected vs. actual**:
- **Evidence & uncertainty / scope**:
- **Candidate Knowledge Delta & destination**: `keep local | Living Knowledge | guidance | /cs-spec | /cs-explore`

## Recommended Response

- Priority: `Do now | Schedule later | Just note | None`
- Smallest action:
- Existing owner or destination:
- Human decision required:
- Cross-stage feedback *(only if root cause belongs in `/cs-spec` or `/cs-explore`, else `None`)*:

## Living Knowledge Merge Proposal *(omit only if neither an active Change file nor a practice-discovered Knowledge Delta applies)*

- Active Change file: `<changes-dir>/<change-id>.md` *(or `None — practice-discovered delta only`)*
- Target Living Knowledge / Architecture Map updates:
- Conflicts with direct human edits to Living Knowledge: `None` or explicit diff/question
- Index closeout: Mark `<change-id>` as `merged` in `.cstack/index.md` upon authorization *(if an active Change file applies)*.

## Learning Feedback

- Should an existing Architecture Map, `AGENTS.md`, test convention, or skill be updated? Give concrete evidence, or `No`.
- Apply repairs, merges, or guidance updates **only if explicitly authorized**.
