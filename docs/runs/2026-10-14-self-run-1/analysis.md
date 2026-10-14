# Run analysis: G-1 "add a bundle size preflight check: budgets.bundleBytes in the profile maps file paths to a byte cap, preflight fails when a file is over its cap, with a test and a rules.md row"

Final stage: done. Wall clock from first to last event: 4.5 min.

## Metrics

| Metric | Value |
|---|---|
| slices done / held / total | 1 / 0 / 1 |
| minutes | 4.4 |
| sessions, turns | 1, 24 |
| cost reported by Claude Code | 0.773 |
| cost from the price table | 0.669 (0.86x) |
| stop-hook blocks | 0 |
| guard denials | 0 |
| halts | 0 |
| verdict writes, invalid | 4, 1 |
| judges that stopped more than once | 1 |
| critic tool calls per slice | S-1: 7 |
| reviewer tool calls per slice | S-1: 4 |
| screenshots | 0 |
| jev answers, routes | 0, none |

## Slices

| Slice | Title | Status | Attempts | Origin |
|---|---|---|---|---|
| S-1 | Bundle size budget: profile key, preflight check, test, rules row | done | 1 | plan |

## Time per stage

| Stage | Visits | Time |
|---|---|---|
| spec_review | 1 | 0.5 min |
| planning | 1 | 0.0 min |
| building | 1 | 0.5 min |
| preflight | 1 | 0.3 min |
| critic | 1 | 1.0 min |
| review | 1 | 0.6 min |
| record | 1 | 0.1 min |
| reconcile | 1 | 0.5 min |
| report | 1 | 0.1 min |
| done | 1 | 0.1 min |

## Cost per stage (harness price table)

| Stage | Calls | Input | Cache read | Output | USD |
|---|---|---|---|---|---|
| intake | 9 | 18 | 363177 | 5020 | 0.261 |
| spec_review | 3 | 10 | 133707 | 1167 | 0.075 |
| building | 2 | 4 | 121911 | 1886 | 0.042 |
| preflight | 1 | 2 | 63372 | 124 | 0.009 |
| critic | 4 | 18 | 215059 | 3148 | 0.036 |
| review | 3 | 12 | 169471 | 1411 | 0.069 |
| record | 1 | 2 | 68656 | 157 | 0.010 |
| reconcile | 4 | 14 | 246805 | 952 | 0.138 |
| report | 1 | 2 | 71452 | 146 | 0.010 |
| done | 1 | 2 | 71799 | 695 | 0.020 |

Harness total: $0.669 (main $0.489, subagents $0.179). Reported by Claude Code: $0.773 over 1 sessions.

## Headless sessions

| # | Stage at start | Turns | USD | Error | Result |
|---|---|---|---|---|---|
| 1 | intake | 24 | 0.773 | false | Goal G-1 is done. The run reached the `done` stage, and the harness says to stop here.  ** |

## Stop-hook blocks

0 blocks.

| Stage:code | Count |
|---|---|

## Guard denials

0 denials.


## Verdicts

| File | Agent | Verdict | Findings | Block | Criteria | Evidence (resolved) | Screenshots |
|---|---|---|---|---|---|---|---|
| S-1-a1-r1-critic.json | critic | pass | 1 | 0 | C-1:met C-2:met C-3:met C-4:met C-5:met C-6:met | 11 (5) | 0 |
| S-1-a1-r1-reviewer.json | reviewer | pass | 1 | 0 | C-1:met C-2:met C-3:met C-4:met C-5:met C-6:met | 10 (5) | 0 |
| reconcile.json | reconciler | | 4 items | | 0 new slices | | |
| spec-a1-spec-reviewer.json | spec-reviewer | pass | 4 | 0 |  | 4 (0) | 0 |

Invalid verdict attempts: 1.

- critic: $.findings[0]: missing required id; $.findings[0]: missing required issue; $.findings[0]: unexpected property summary

## Browser

0 host changes, 0 evidence files.


## Subagent usage

| Agent | Stage | Model | Calls | Stop | USD |
|---|---|---|---|---|---|
| spec-reviewer | spec_review | claude-sonnet-5-5 | 3 | 1 | 0.0362 |
| critic | critic | claude-haiku-5-5 | 4 | 1 | 0.0022 |
| critic | critic | claude-haiku-5-5 | 3 | 2 | 0.0024 |
| reviewer | review | claude-sonnet-5-5 | 4 | 1 | 0.0377 |
| reconciler | reconcile | claude-opus-5-5 | 4 | 1 | 0.101 |

## Halts and holds

- default D-1: Are the keys of budgets.bundleBytes exact project-relative paths or globs? → Exact project-relative paths; globs can be added later without breaking this shape.
- default D-2: What happens when a named file does not exist? → Skipped and listed in the details, because a build output may not exist yet at preflight time.
- default D-3: Is size measured raw or gzipped? → Raw bytes on disk, as the key name says bytes; no compression step.
- reconcile: 0 missing
