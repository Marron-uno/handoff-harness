# Run analysis: G-1 "build all of the handoff"

Final stage: done. Wall clock from first to last event: 11.5 min.

## Slices

| Slice | Title | Status | Attempts | Origin |
|---|---|---|---|---|
| S-1 | Listing: newest first, copy, case-insensitive tag filter (verify create-note criteria) | done | 1 | plan |
| S-2 | exportMarkdown | done | 1 | plan |
| S-3 | Note count on the page | done | 1 | plan |

## Time per stage

| Stage | Visits | Time |
|---|---|---|
| planning | 1 | 0.0 min |
| building | 3 | 0.8 min |
| preflight | 3 | 0.3 min |
| critic | 4 | 3.4 min |
| halted | 1 | 3.3 min |
| review | 3 | 1.6 min |
| record | 3 | 0.2 min |
| reconcile | 1 | 0.5 min |
| report | 1 | 0.1 min |
| done | 1 | 0.0 min |

## Cost per stage (harness price table)

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

Harness total: $2.270. Driver total as reported by Claude Code: $1.241 over 2 sessions.

## Headless sessions

| # | Stage at start | Turns | USD | Error | Result |
|---|---|---|---|---|---|
| 1 | intake | 1 | 0.379 | false | The critic passed S-1. All five criteria (C-1 to C-5) are met, there are no block findings |
| 1 | critic | 38 | 0.862 | false | Goal G-1, "build all of the handoff", is finished. The report is at `.harness/report.md`.  |

## Stop-hook blocks

24 blocks.

| Stage:code | Count |
|---|---|
| intake:intake_incomplete | 1 |
| building:build | 3 |
| preflight:preflight | 3 |
| critic:critic | 3 |
| critic:critic_verdict_missing | 6 |
| review:review | 3 |
| record:record | 3 |
| reconcile:reconcile | 1 |
| report:report | 1 |

## Guard denials

1 denials.

| Guard | Count |
|---|---|
| sensitive | 1 |

## Verdicts

| File | Agent | Verdict | Findings | Block | Criteria | Evidence (resolved) | Screenshots |
|---|---|---|---|---|---|---|---|
| S-1-a1-r1-critic.json | critic | pass | 1 | 0 | C-1:met C-2:met C-3:met C-4:met C-5:met | 13 (12) | 0 |
| S-1-a1-r1-reviewer.json | reviewer | pass | 1 | 0 | C-1:met C-2:met C-3:met C-4:met C-5:met | 6 (6) | 0 |
| S-2-a1-r1-critic.json | critic | pass | 1 | 0 | C-6:met | 6 (5) | 0 |
| S-2-a1-r1-reviewer.json | reviewer | pass | 1 | 0 | C-6:met | 4 (3) | 0 |
| S-3-a1-r1-critic.json | critic | pass | 2 | 0 | C-7:met | 9 (7) | 0 |
| S-3-a1-r1-reviewer.json | reviewer | pass | 1 | 0 | C-7:met | 3 (2) | 1 |
| reconcile.json | reconciler | | 5 items | | 0 new slices | | |

## Browser

1 host changes, 1 evidence files.

- reviewer opened localhost (fixture) in stage review
- .harness/evidence/S-3/count-page.jpg (9988 bytes)

## Subagent usage

| Agent | Stage | Model | Calls | USD |
|---|---|---|---|---|
| critic | halted | claude-haiku-5-5 | 12 | 0.1057 |
| critic | critic | claude-haiku-5-5 | 18 | 0.0963 |
| reviewer | review | claude-sonnet-5-5 | 6 | 0.1954 |
| critic | critic | claude-haiku-5-5 | 25 | 0.122 |
| reviewer | review | claude-sonnet-5-5 | 4 | 0.0907 |
| critic | critic | claude-haiku-5-5 | 25 | 0.1607 |
| reviewer | review | claude-sonnet-5-5 | 10 | 0.1996 |
| reconciler | reconcile | claude-opus-5-5 | 5 | 0.1946 |

## Halts and holds

- halt runaway in halted: Stop hook blocked 7 times in stage critic without progress. Halted. Inspect .harness/events.jsonl, then `harness resume`.
- hold H-1: What is the public URL of the deployed page? (blocks nothing)
- default D-1: Should tags be case-insensitive? → Yes, compare lowercased.
- reconcile: 0 missing
