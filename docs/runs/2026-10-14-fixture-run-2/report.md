# G-1: build all of the handoff

Mode: handoff. Branch: goal/G-1. Stage: report.

## Slices

| Slice | Title | Status | Attempts | Commit |
|---|---|---|---|---|
| S-1 | Listing: newest first and tag filter | done | 1 | b94e130 |
| S-2 | Markdown export | done | 1 | ca2c19e |
| S-3 | Note count on the page | done | 1 | 86da41a |
| S-4 | Note count: verifiable with a seeded store | done | 1 | 794b117 |

## Spec

OpenSpec change: `openspec/changes/lantern-v0-2`. 3 requirement(s), 5 scenario(s), 4 task(s), 5/5 criteria cited, validate pass

Spec review: pass over 1 attempt(s). Committed at approval: 0bc5bf8.

Tasks ticked: 4 of 4.

Archive by hand when the branch merges: `openspec archive lantern-v0-2 --yes`.

## Criteria

| Criterion | Status |
|---|---|
| C-3 | met |
| C-4 | met |
| C-5 | met |
| C-6 | met |
| C-7 | met |

## Inventory coverage

out_of_scope: 1, done: 4

Missing after reconciliation: 0

## Cost per stage

| Stage | Calls | Input | Cache read | Output | USD |
|---|---|---|---|---|---|
| intake | 11 | 22 | 404502 | 6481 | 0.368 |
| spec_review | 4 | 30 | 198423 | 5871 | 0.301 |
| building | 20 | 40 | 1138812 | 10304 | 0.566 |
| preflight | 3 | 6 | 167362 | 543 | 0.065 |
| critic | 16 | 254 | 1932489 | 42234 | 0.917 |
| review | 26 | 152 | 2626505 | 24214 | 1.709 |
| record | 4 | 8 | 263284 | 807 | 0.097 |
| reconcile | 10 | 92 | 1067723 | 11135 | 1.430 |
| report | 1 | 2 | 84999 | 173 | 0.029 |

Total: $5.483

## Holds (need a human)

- H-1: What is the public URL of the deployed page? (blocks nothing)

## Defaults applied

- D-1: Should tags be case-insensitive? → Yes, compare lowercased.

## Run log

Stage transitions: 27. Stop-hook blocks: 0. Guard denials: 2. Halts: 0.

| Guard | Count |
|---|---|
| state | 2 |

