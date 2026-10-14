# G-1: build all of the handoff

Mode: handoff. Branch: goal/G-1. Stage: report.

## Slices

| Slice | Title | Status | Attempts | Commit |
|---|---|---|---|---|
| S-1 | Listing: newest first, copy, case-insensitive tag filter (verify create-note criteria) | done | 1 | 052d19f |
| S-2 | exportMarkdown | done | 1 | 256d2c1 |
| S-3 | Note count on the page | done | 1 | 83e3817 |

## Criteria

| Criterion | Status |
|---|---|
| C-1 | met |
| C-2 | met |
| C-3 | met |
| C-4 | met |
| C-5 | met |
| C-6 | met |
| C-7 | met |

## Inventory coverage

done: 5

Missing after reconciliation: 0

## Cost per stage

| Stage | Calls | Input | Cache read | Output | USD |
|---|---|---|---|---|---|
| critic | 11 | 152 | 1254955 | 24655 | 0.672 |
| review | 9 | 52 | 675895 | 9511 | 0.649 |
| record | 6 | 12 | 305977 | 695 | 0.113 |
| building | 13 | 26 | 611641 | 5410 | 0.308 |
| preflight | 4 | 8 | 200257 | 492 | 0.077 |
| reconcile | 6 | 20 | 347320 | 2277 | 0.320 |
| report | 1 | 2 | 65055 | 162 | 0.024 |
| halted | 1 | 24 | 109154 | 6797 | 0.106 |

Total: $2.270

## Holds (need a human)

- H-1: What is the public URL of the deployed page? (blocks nothing)

## Defaults applied

- D-1: Should tags be case-insensitive? → Yes, compare lowercased.

## Run log

Stage transitions: 21. Stop-hook blocks: 24. Guard denials: 1. Halts: 1.

| Guard | Count |
|---|---|
| sensitive | 1 |

