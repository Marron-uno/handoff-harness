# Run analysis: G-3 "the Bash guard judges command lines, not prose: a heredoc body that a command only writes to a file (cat or tee with a redirect) is left out of the text before the deny patterns, the push rule and the sensitive-path scan run, a heredoc fed to a shell or an interpreter is still scanned, the push deny pattern and the push rule match within one line, with tests for each case and a rules.md row"

Final stage: done (attempt_cap: Slice S-1 failed 6 attempt(s) (critic_block), 3 since the last retry. A human decides: fix by hand, then `harness retry` continues the slice with 3 more attempts and the count kept; or skip it with `harness slice skip --reason "..."`.). Wall clock from first to last event: 2971.2 min.

## Metrics

| Metric | Value |
|---|---|
| slices done / held / total | 0 / 0 / 1 |
| minutes | 2971.2 |
| sessions, turns | 4, 204 |
| cost reported by Claude Code | 23.787 |
| cost from the price table | 25.298 (1.06x) |
| stop-hook blocks | 0 |
| guard denials | 34 |
| halts | 4 |
| verdict writes, invalid | 19, 5 |
| judges that stopped more than once | 5 |
| critic tool calls per slice | S-1: 122 |
| reviewer tool calls per slice | S-1: 41 |
| screenshots | 0 |
| jev answers, routes | 0, none |

## Slices

| Slice | Title | Status | Attempts | Origin |
|---|---|---|---|---|
| S-1 | Bash guard judges command lines: heredoc stripping, one-line push match, tests, rules row | skipped | 6 | plan |

## Time per stage

| Stage | Visits | Time |
|---|---|---|
| spec_review | 2 | 1.0 min |
| planning | 2 | 0.0 min |
| building | 9 | 33.4 min |
| preflight | 9 | 11.1 min |
| critic | 9 | 37.4 min |
| review | 3 | 15.5 min |
| record | 2 | 11.4 min |
| reconcile | 2 | 3.5 min |
| report | 2 | 0.2 min |
| done | 2 | 1251.4 min |
| budget_exceeded | 1 | 199.8 min |
| halted | 1 | 1.4 min |
| awaiting_human | 2 | 1404.2 min |

## Cost per stage (harness price table)

| Stage | Calls | Input | Cache read | Output | USD |
|---|---|---|---|---|---|
| record | 14 | 420 | 1013294 | 13979 | 4.657 |
| reconcile | 11 | 250 | 1076073 | 8889 | 2.854 |
| report | 1 | 32 | 113598 | 339 | 0.210 |
| done | 24 | 1002 | 4286385 | 19760 | 13.879 |
| spec_review | 2 | 14 | 51406 | 265 | 0.079 |
| critic | 14 | 244 | 4403468 | 13235 | 2.253 |
| review | 3 | 82 | 2086451 | 2291 | 1.366 |

Harness total: $25.298 (main $14.523, subagents $10.775). Reported by Claude Code: $20.983 over 1 sessions.

## Headless sessions

| # | Stage at start | Turns | USD | Error | Result |
|---|---|---|---|---|---|
| 1 | building | 110 | 20.983 | false | The harness halted at the attempt cap, so I stopped as instructed. Goal G-3 rests in `awai |

## Stop-hook blocks

0 blocks.

| Stage:code | Count |
|---|---|

## Guard denials

34 denials.

| Guard | Count |
|---|---|
| sensitive | 7 |
| git | 22 |
| lane | 3 |
| protected | 2 |

## Verdicts

| File | Agent | Verdict | Findings | Block | Criteria | Evidence (resolved) | Screenshots |
|---|---|---|---|---|---|---|---|
| S-1-a1-r1-critic.json | critic | block | 2 | 1 | C-1:met C-2:met C-3:met C-4:met C-5:met | 14 (14) | 0 |
| S-1-a1-r1-reviewer.json | reviewer | pass | 1 | 0 | C-1:met C-2:met C-3:met C-4:met C-5:met C-6:met | 10 (10) | 0 |
| S-1-a2-r1-critic.json | critic | block | 1 | 1 | C-1:met C-2:met C-3:met C-4:met C-5:met | 15 (15) | 0 |
| S-1-a3-r1-critic.json | critic-strong | block | 4 | 2 | C-1:unmet C-2:unmet C-3:met C-4:met C-5:met | 17 (17) | 0 |
| S-1-a4-r1-critic.json | critic | pass | 1 | 0 | C-1:met C-2:met C-3:met C-4:met C-5:met | 9 (9) | 0 |
| S-1-a4-r1-reviewer.json | reviewer-strong | block | 4 | 2 | C-1:unmet C-2:met C-3:met C-4:met C-5:met | 19 (19) | 0 |
| S-1-a4-r2-critic.json | critic | pass | 2 | 0 | C-1:met C-2:met C-3:met C-4:met C-5:met | 16 (16) | 0 |
| S-1-a4-r2-reviewer.json | reviewer-strong | block | 4 | 2 | C-1:unmet C-2:met C-3:met C-4:met C-5:met | 19 (19) | 0 |
| S-1-a4-r3-critic.json | critic-strong | block | 2 | 1 | C-1:unmet C-2:met C-3:met C-4:met C-5:met | 14 (14) | 0 |
| S-1-a5-r3-critic.json | critic-strong | block | 2 | 1 | C-1:met C-2:met C-3:met C-4:met C-5:met | 12 (12) | 0 |
| S-1-a6-r3-critic.json | critic-strong | block | 1 | 1 | C-1:met C-2:met C-3:met C-4:met C-5:met | 13 (13) | 0 |
| reconcile.json | reconciler | | 4 items | | 0 new slices | | |
| spec-a1-spec-reviewer.json | spec-reviewer | pass | 2 | 0 |  | 2 (0) | 0 |

Invalid verdict attempts: 5.

- critic: $.findings[0]: missing required id; $.findings[0]: missing required issue; $.findings[0]: unexpected property summary
- critic: C-5: on a guard-bearing slice a met criterion needs evidence of type command or test (a probe or a test you ran), not a file quote alone
- critic: C-5: on a guard-bearing slice a met criterion needs evidence of type command or test (a probe or a test you ran), not a file quote alone
- critic: C-5: on a guard-bearing slice a met criterion needs evidence of type command or test (a probe or a test you ran), not a file quote alone
- critic-strong: C-5: on a guard-bearing slice a met criterion needs evidence of type command or test (a probe or a test you ran), not a file quote alone

## Browser

0 host changes, 86 evidence files.

- .harness/evidence/S-1/bash-prose-test-r2.txt (199 bytes)
- .harness/evidence/S-1/bash-prose-test.txt (246 bytes)
- .harness/evidence/S-1/head/profiles/default.json (6696 bytes)
- .harness/evidence/S-1/head/profiles/jev-questions.v1.json (1458 bytes)
- .harness/evidence/S-1/head/scripts/cli.mjs (38232 bytes)
- .harness/evidence/S-1/head/scripts/dev/check-syntax.mjs (787 bytes)
- .harness/evidence/S-1/head/scripts/drive.mjs (5911 bytes)
- .harness/evidence/S-1/head/scripts/eval/bench.mjs (6010 bytes)
- .harness/evidence/S-1/head/scripts/eval/compare.mjs (4767 bytes)
- .harness/evidence/S-1/head/scripts/hooks/_common.mjs (1013 bytes)
- .harness/evidence/S-1/head/scripts/hooks/post-tool-use.mjs (2691 bytes)
- .harness/evidence/S-1/head/scripts/hooks/pre-compact.mjs (432 bytes)
- .harness/evidence/S-1/head/scripts/hooks/pre-tool-use.mjs (2602 bytes)
- .harness/evidence/S-1/head/scripts/hooks/session-start.mjs (1787 bytes)
- .harness/evidence/S-1/head/scripts/hooks/stop.mjs (1615 bytes)
- .harness/evidence/S-1/head/scripts/hooks/subagent-start.mjs (497 bytes)
- .harness/evidence/S-1/head/scripts/hooks/subagent-stop.mjs (4408 bytes)
- .harness/evidence/S-1/head/scripts/lib/analyze.mjs (10268 bytes)
- .harness/evidence/S-1/head/scripts/lib/brief.mjs (630 bytes)
- .harness/evidence/S-1/head/scripts/lib/environment.mjs (1666 bytes)
- .harness/evidence/S-1/head/scripts/lib/events.mjs (747 bytes)
- .harness/evidence/S-1/head/scripts/lib/git.mjs (6081 bytes)
- .harness/evidence/S-1/head/scripts/lib/glob.mjs (631 bytes)
- .harness/evidence/S-1/head/scripts/lib/goal-check.mjs (2210 bytes)
- .harness/evidence/S-1/head/scripts/lib/guards/browser-guard.mjs (2978 bytes)
- .harness/evidence/S-1/head/scripts/lib/guards/git-guard.mjs (5026 bytes)
- .harness/evidence/S-1/head/scripts/lib/guards/index.mjs (4149 bytes)
- .harness/evidence/S-1/head/scripts/lib/guards/language-guard.mjs (5208 bytes)
- .harness/evidence/S-1/head/scripts/lib/guards/path-guard.mjs (7070 bytes)
- .harness/evidence/S-1/head/scripts/lib/guards/prose-lint.mjs (810 bytes)
- .harness/evidence/S-1/head/scripts/lib/guards/secret-scan.mjs (2590 bytes)
- .harness/evidence/S-1/head/scripts/lib/io.mjs (2024 bytes)
- .harness/evidence/S-1/head/scripts/lib/jev/calibrate.mjs (2044 bytes)
- .harness/evidence/S-1/head/scripts/lib/jev/client.mjs (5470 bytes)
- .harness/evidence/S-1/head/scripts/lib/jev/inventory-prefilter.mjs (1419 bytes)
- .harness/evidence/S-1/head/scripts/lib/jev/questions.mjs (284 bytes)
- .harness/evidence/S-1/head/scripts/lib/jev/trace-classify.mjs (2334 bytes)
- .harness/evidence/S-1/head/scripts/lib/jev/verdict-gate.mjs (2378 bytes)
- .harness/evidence/S-1/head/scripts/lib/machine.mjs (30769 bytes)
- .harness/evidence/S-1/head/scripts/lib/metrics.mjs (8037 bytes)
- .harness/evidence/S-1/head/scripts/lib/openspec.mjs (12924 bytes)
- .harness/evidence/S-1/head/scripts/lib/packet.mjs (5046 bytes)
- .harness/evidence/S-1/head/scripts/lib/paths.mjs (3062 bytes)
- .harness/evidence/S-1/head/scripts/lib/preflight.mjs (9780 bytes)
- .harness/evidence/S-1/head/scripts/lib/profile.mjs (761 bytes)
- .harness/evidence/S-1/head/scripts/lib/reconcile.mjs (6067 bytes)
- .harness/evidence/S-1/head/scripts/lib/report.mjs (5402 bytes)
- .harness/evidence/S-1/head/scripts/lib/retro.mjs (7472 bytes)
- .harness/evidence/S-1/head/scripts/lib/schema.mjs (3728 bytes)
- .harness/evidence/S-1/head/scripts/lib/state.mjs (3595 bytes)
- .harness/evidence/S-1/head/scripts/lib/usage.mjs (6028 bytes)
- .harness/evidence/S-1/head/scripts/lib/verdict.mjs (5406 bytes)
- .harness/evidence/S-1/head/scripts/status-line.mjs (1233 bytes)
- .harness/evidence/S-1/npm-check-r2.txt (174 bytes)
- .harness/evidence/S-1/npm-check.txt (174 bytes)
- .harness/evidence/S-1/npm-test-r2.txt (474 bytes)
- .harness/evidence/S-1/npm-test.txt (475 bytes)
- .harness/evidence/S-1/probe-output.txt (4851 bytes)
- .harness/evidence/S-1/probe-r2-output.txt (6182 bytes)
- .harness/evidence/S-1/probe-r2-x4-output.txt (1304 bytes)
- .harness/evidence/S-1/probe-r2-x4.mjs (2238 bytes)
- .harness/evidence/S-1/probe-r2.mjs (9252 bytes)
- .harness/evidence/S-1/probe.mjs (6775 bytes)
- .harness/evidence/S-1/rules-grep-r2.txt (121 bytes)
- .harness/evidence/S-1/sandbox/A1-shape.sh (64 bytes)
- .harness/evidence/S-1/sandbox/A2-shape.sh (73 bytes)
- .harness/evidence/S-1/sandbox/A5-shape.sh (58 bytes)
- .harness/evidence/S-1/sandbox/B1-shape.sh (79 bytes)
- .harness/evidence/S-1/sandbox/B4-shape.sh (91 bytes)
- .harness/evidence/S-1/sandbox/B5-shape.sh (89 bytes)
- .harness/evidence/S-1/sandbox/notes.md (0 bytes)
- .harness/evidence/S-1/sandbox/notes2.md (0 bytes)
- .harness/evidence/S-1/sandbox/notes3.md (30 bytes)
- .harness/evidence/S-1/sandbox-r2/C1-shape.sh (77 bytes)
- .harness/evidence/S-1/sandbox-r2/C2-shape.sh (77 bytes)
- .harness/evidence/S-1/sandbox-r2/C5-shape.sh (75 bytes)
- .harness/evidence/S-1/sandbox-r2/C6-shape.sh (99 bytes)
- .harness/evidence/S-1/sandbox-r2/X1-shape.sh (47 bytes)
- .harness/evidence/S-1/sandbox-r2/X2-shape.sh (50 bytes)
- .harness/evidence/S-1/sandbox-r2/X3-shape.sh (52 bytes)
- .harness/evidence/S-1/sandbox-r2/X4a.sh (45 bytes)
- .harness/evidence/S-1/sandbox-r2/X4b.sh (48 bytes)
- .harness/evidence/S-1/sandbox-r2/X4c.sh (50 bytes)
- .harness/evidence/S-1/sandbox-r2/X4d.sh (36 bytes)
- .harness/evidence/S-1/sandbox-r2/a.md (33 bytes)
- .harness/evidence/S-1/sandbox-r2/bin/git (67 bytes)

## Subagent usage

| Agent | Stage | Model | Calls | Stop | USD |
|---|---|---|---|---|---|
| spec-reviewer | spec_review | claude-sonnet-5-5 | 3 | 1 | 0.0362 |
| critic | critic | claude-haiku-5-5 | 4 | 1 | 0.0022 |
| critic | critic | claude-haiku-5-5 | 3 | 2 | 0.0024 |
| reviewer | review | claude-sonnet-5-5 | 4 | 1 | 0.0377 |
| reconciler | reconcile | claude-opus-5-5 | 4 | 1 | 0.101 |
| general-purpose | done | claude-fable-5-1 | 12 | 1 | 6.8216 |
| spec-reviewer | spec_review | claude-sonnet-5-5 | 4 | 1 | 0.0432 |
| critic | critic | claude-haiku-5-5 | 12 | 1 | 0.0471 |
| critic | critic | claude-haiku-5-5 | 7 | 1 | 0.0259 |
| critic | critic | claude-haiku-5-5 | 4 | 2 | 0.0122 |
| critic-strong | critic | claude-opus-5-5 | 15 | 1 | 0.3381 |
| critic | critic | claude-haiku-5-5 | 8 | 1 | 0.0288 |
| critic | critic | claude-haiku-5-5 | 5 | 2 | 0.0191 |
| reviewer-strong | review | claude-opus-5-5 | 20 | 1 | 0.6436 |
| critic | critic | claude-haiku-5-5 | 10 | 1 | 0.0452 |
| critic | critic | claude-haiku-5-5 | 4 | 2 | 0.0199 |
| reviewer-strong | review | claude-opus-5-5 | 17 | 1 | 0.6843 |
| critic-strong | critic | claude-opus-5-5 | 13 | 1 | 0.5202 |
| critic-strong | critic | claude-opus-5-5 | 18 | 1 | 0.6023 |
| critic-strong | critic | claude-opus-5-5 | 17 | 1 | 0.539 |
| critic-strong | critic | claude-opus-5-5 | 2 | 2 | 0.0503 |
| reconciler | reconcile | claude-opus-5-5 | 6 | 1 | 0.1544 |

## Halts and holds

- halt budget_usd in budget_exceeded: Cost budget of $6 exceeded ($17.05 attributed). Raise it with `harness goal budget --usd N` and resume.
- halt aborted in undefined: false cost halt, see issue 5
- halt attempt_cap in awaiting_human: Slice S-1 failed 3 attempt(s) (critic_block). A human decides: fix by hand, then `harness retry` continues the slice with 3 more attempts and the count kept; or skip it with `harness slice skip --reason "..."`.
- halt attempt_cap in awaiting_human: Slice S-1 failed 6 attempt(s) (critic_block), 3 since the last retry. A human decides: fix by hand, then `harness retry` continues the slice with 3 more attempts and the count kept; or skip it with `harness slice skip --reason "..."`.
- default D-1: Which commands count as feeding a heredoc to a shell or interpreter? → Anything that is not cat or tee with a redirect keeps its heredoc scanned; only the file-writing shape is stripped, so an unknown command fails safe.
- default D-2: Does a tee without a file argument count as writing to a file? → No; tee must name a file, and cat must redirect to a file, otherwise the body stays in the text.
- default D-4: Does C-3 (the push deny pattern and the push rule match within one line) stay in the goal after six attempts? → No. C-3 is cut; the push deny pattern and the push rule go back to the whole-text match, so a push followed by prose on a later line stays a known false positive. Each adversarial round found another shell mechanism carrying words across a newline into a push: open expansions and quotes (a4-r1), an unquoted heredoc rebuilt by xargs (a4-r2), git and push split across heredoc lines (a5), a global option value touching << (a6). The heredoc half (C-1, C-2) with tests (C-4) and the rules row (C-5) lands by hand on goal/G-3 as a pull request; the goal stays in awaiting_human.
- reconcile: 0 missing
