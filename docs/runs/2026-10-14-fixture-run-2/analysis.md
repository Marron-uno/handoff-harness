# Run analysis: G-1 "build all of the handoff"

Final stage: done. Wall clock from first to last event: 11.5 min.

## Slices

| Slice | Title | Status | Attempts | Origin |
|---|---|---|---|---|
| S-1 | Listing: newest first and tag filter | done | 1 | plan |
| S-2 | Markdown export | done | 1 | plan |
| S-3 | Note count on the page | done | 1 | plan |
| S-4 | Note count: verifiable with a seeded store | done | 1 | reconcile |

## Time per stage

| Stage | Visits | Time |
|---|---|---|
| spec_review | 1 | 0.8 min |
| planning | 1 | 0.0 min |
| building | 4 | 0.9 min |
| preflight | 4 | 0.1 min |
| critic | 4 | 3.0 min |
| review | 4 | 3.3 min |
| record | 4 | 0.1 min |
| reconcile | 2 | 2.0 min |
| report | 1 | 0.0 min |
| done | 1 | 0.0 min |

## Cost per stage (harness price table)

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

Harness total: $5.483. Driver total as reported by Claude Code: $1.737 over 1 sessions.

## Headless sessions

| # | Stage at start | Turns | USD | Error | Result |
|---|---|---|---|---|---|
| 1 | intake | 53 | 1.737 | false | Goal G-1 ("build all of the handoff") is done. The brief says to stop here, and the stage  |

## Stop-hook blocks

0 blocks.

| Stage:code | Count |
|---|---|

## Guard denials

2 denials.

| Guard | Count |
|---|---|
| state | 2 |

## Verdicts

| File | Agent | Verdict | Findings | Block | Criteria | Evidence (resolved) | Screenshots |
|---|---|---|---|---|---|---|---|
| S-1-a1-r1-critic.json | critic | pass | 2 | 0 | C-3:met C-4:met C-5:met | 13 (10) | 0 |
| S-1-a1-r1-reviewer.json | reviewer | pass | 1 | 0 | C-3:met C-4:met C-5:met | 5 (4) | 0 |
| S-2-a1-r1-critic.json | critic | pass | 1 | 0 | C-6:met | 5 (3) | 0 |
| S-2-a1-r1-reviewer.json | reviewer | pass | 1 | 0 | C-6:met | 3 (1) | 0 |
| S-3-a1-r1-critic.json | critic | pass | 3 | 0 | C-7:met | 9 (5) | 0 |
| S-3-a1-r1-reviewer.json | reviewer | pass | 2 | 0 | C-7:met | 4 (3) | 1 |
| S-4-a1-r1-critic.json | critic | pass | 2 | 0 | C-7:met | 7 (7) | 0 |
| S-4-a1-r1-reviewer.json | reviewer | pass | 2 | 0 | C-7:met | 5 (4) | 1 |
| reconcile.json | reconciler | | 5 items | | 0 new slices | | |
| spec-a1-spec-reviewer.json | spec-reviewer | pass | 4 | 0 |  | 6 (6) | 0 |

Invalid verdict attempts: 5.

- spec-reviewer: $.findings[0]: missing required id; $.findings[0]: missing required issue; $.findings[0]: unexpected property title
- critic: $.findings[2].authority: does not match ^(criterion|spec|rule|handoff|test):[^\s]+$
- critic: slice S-3 is not the active slice S-4; C-7: evidence path does not exist: npm test
- reviewer: $.findings[1].authority: does not match ^(criterion|spec|rule|handoff|test):[^\s]+$
- review: C-7: evidence of type test needs a path

## Browser

1 host changes, 2 evidence files.

- reviewer opened localhost (fixture) in stage review
- .harness/evidence/S-3/count.jpg (3616 bytes)
- .harness/evidence/S-4/count-3.jpg (3618 bytes)

## Subagent usage

| Agent | Stage | Model | Calls | USD |
|---|---|---|---|---|
| spec-reviewer | spec_review | claude-sonnet-5-5 | 5 | 0.1056 |
| spec-reviewer | spec_review | claude-sonnet-5-5 | 8 | 0.1453 |
| critic | critic | claude-haiku-5-5 | 17 | 0.1113 |
| reviewer | review | claude-sonnet-5-5 | 3 | 0.1474 |
| critic | critic | claude-haiku-5-5 | 18 | 0.0762 |
| reviewer | review | claude-sonnet-5-5 | 2 | 0.0524 |
| critic | critic | claude-haiku-5-5 | 20 | 0.1092 |
| critic | critic | claude-haiku-5-5 | 27 | 0.1442 |
| reviewer | review | claude-sonnet-5-5 | 11 | 0.195 |
| reconciler | reconcile | claude-opus-5-5 | 19 | 0.6992 |
| critic | critic | claude-haiku-5-5 | 16 | 0.0893 |
| critic | critic | claude-haiku-5-5 | 19 | 0.1102 |
| reviewer | review | claude-sonnet-5-5 | 10 | 0.1856 |
| reviewer | review | claude-sonnet-5-5 | 12 | 0.2212 |
| reviewer | review | claude-sonnet-5-5 | 17 | 0.2868 |
| reconciler | reconcile | claude-opus-5-5 | 19 | 0.4947 |

## Halts and holds

- hold H-1: What is the public URL of the deployed page? (blocks nothing)
- default D-1: Should tags be case-insensitive? → Yes, compare lowercased.
- reconcile: 0 missing
