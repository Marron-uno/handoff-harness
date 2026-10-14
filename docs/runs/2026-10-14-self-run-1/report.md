# G-1: add a bundle size preflight check: budgets.bundleBytes in the profile maps file paths to a byte cap, preflight fails when a file is over its cap, with a test and a rules.md row

Mode: feature. Branch: goal/G-1. Stage: done.

## Slices

| Slice | Title | Status | Attempts | Commit |
|---|---|---|---|---|
| S-1 | Bundle size budget: profile key, preflight check, test, rules row | done | 1 | 6142557 |

## Spec

OpenSpec change: `openspec/changes/g-1-add-a-bundle-size-preflight-check-budgets-bundle`. 2 requirement(s), 6 scenario(s), 4 task(s), 6/6 criteria cited, validate pass

Spec review: pass over 1 attempt(s). Committed at approval: a8bb6eb.

Tasks ticked: 4 of 4.

Archive by hand when the branch merges: `openspec archive g-1-add-a-bundle-size-preflight-check-budgets-bundle --yes`.

## Criteria

| Criterion | Status |
|---|---|
| C-1 | met |
| C-2 | met |
| C-3 | met |
| C-4 | met |
| C-5 | met |
| C-6 | met |

## Inventory coverage

done: 4

Missing after reconciliation: 0

## Cost per stage

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

Total from the price table: $0.669 (main session $0.489, subagents $0.179).
Reported by Claude Code: $0.773 over 1 headless session(s). This is the number of record; the table is an estimate.

## Defaults applied

- D-1: Are the keys of budgets.bundleBytes exact project-relative paths or globs? → Exact project-relative paths; globs can be added later without breaking this shape.
- D-2: What happens when a named file does not exist? → Skipped and listed in the details, because a build output may not exist yet at preflight time.
- D-3: Is size measured raw or gzipped? → Raw bytes on disk, as the key name says bytes; no compression step.

## Run log

Stage transitions: 11. Stop-hook blocks: 0. Guard denials: 0. Halts: 0.

