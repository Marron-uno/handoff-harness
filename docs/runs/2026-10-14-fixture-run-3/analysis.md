# Run analysis: G-1 "build all of the handoff"

Final stage: done. Wall clock from first to last event: 5.5 min.

## Slices

| Slice | Title | Status | Attempts | Origin |
|---|---|---|---|---|
| S-1 | Listing: sort, copy, tag filter | done | 1 | plan |
| S-2 | Markdown export | done | 1 | plan |
| S-3 | Note count on the page | pending | 0 | plan |

## Time per stage

| Stage | Visits | Time |
|---|---|---|
| spec_review | 1 | 0.5 min |
| planning | 1 | 0.0 min |
| building | 2 | 0.4 min |
| preflight | 2 | 0.1 min |
| critic | 2 | 1.7 min |
| review | 2 | 0.8 min |
| record | 2 | 0.1 min |
| reconcile | 1 | 0.7 min |
| report | 1 | 0.0 min |
| done | 1 | 0.1 min |

## Cost per stage (harness price table)

| Stage | Calls | Input | Cache read | Output | USD |
|---|---|---|---|---|---|
| intake | 7 | 14 | 244688 | 4218 | 0.196 |
| spec_review | 3 | 12 | 120694 | 1093 | 0.067 |
| building | 4 | 8 | 205734 | 1878 | 0.049 |
| preflight | 1 | 2 | 50171 | 152 | 0.008 |
| critic | 12 | 56 | 641842 | 4550 | 0.122 |
| review | 6 | 18 | 307262 | 2378 | 0.142 |
| record | 2 | 4 | 122471 | 437 | 0.019 |
| reconcile | 5 | 16 | 295701 | 1455 | 0.141 |
| report | 1 | 2 | 67729 | 219 | 0.010 |
| done | 1 | 2 | 68088 | 658 | 0.019 |

Harness total: $0.774 (main $0.541, subagents $0.233). Reported by Claude Code: $0.884 over 1 sessions.

## Headless sessions

| # | Stage at start | Turns | USD | Error | Result |
|---|---|---|---|---|---|
| 1 | intake | 16 | 0.884 | false | G-1 is only partly done. The harness says the goal is complete and moved to `done`, but th |

## Stop-hook blocks

0 blocks.

| Stage:code | Count |
|---|---|

## Guard denials

0 denials.


## Verdicts

| File | Agent | Verdict | Findings | Block | Criteria | Evidence (resolved) | Screenshots |
|---|---|---|---|---|---|---|---|
| S-1-a1-r1-critic.json | critic | pass | 0 | 0 | C-3:met C-4:met C-5:met | 9 (9) | 0 |
| S-1-a1-r1-reviewer.json | reviewer | pass | 0 | 0 | C-3:met C-4:met C-5:met | 6 (6) | 0 |
| S-2-a1-r1-critic.json | critic | pass | 1 | 0 | C-6:met | 5 (4) | 0 |
| S-2-a1-r1-reviewer.json | reviewer | pass | 0 | 0 | C-6:met | 2 (2) | 0 |
| reconcile.json | reconciler | | 5 items | | 0 new slices | | |
| spec-a1-spec-reviewer.json | spec-reviewer | pass | 3 | 0 |  | 4 (4) | 0 |

Invalid verdict attempts: 2.

- critic: $.criteria[0].evidence[0]: expected object, got string; $.criteria[0].evidence[1]: expected object, got string; $.criteria[0].evidence[2]: expected object, got string
- critic: $.criteria[0].evidence[0]: unexpected property note; $.criteria[0].evidence[1]: unexpected property note; $.criteria[0].evidence[2]: unexpected property note

## Browser

0 host changes, 0 evidence files.


## Subagent usage

| Agent | Stage | Model | Calls | Stop | USD |
|---|---|---|---|---|---|
| spec-reviewer | spec_review | claude-sonnet-5-5 | 4 | 1 | 0.0348 |
| critic | critic | claude-haiku-5-5 | 4 | 1 | 0.0016 |
| critic | critic | claude-haiku-5-5 | 2 | 2 | 0.001 |
| critic | critic | claude-haiku-5-5 | 2 | 3 | 0.0007 |
| reviewer | review | claude-sonnet-5-5 | 2 | 1 | 0.0564 |
| critic | critic | claude-haiku-5-5 | 10 | 1 | 0.0191 |
| reviewer | review | claude-sonnet-5-5 | 3 | 1 | 0.0272 |
| reconciler | reconcile | claude-opus-5-5 | 4 | 1 | 0.0921 |

## Halts and holds

- hold H-1: What is the public URL of the deployed page? Only the owner knows. (blocks S-3)
- default D-1: Should tags be case-insensitive? → Yes, compare lowercased.
- reconcile: 0 missing
