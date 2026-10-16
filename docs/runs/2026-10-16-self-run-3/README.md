# Self-run 3: a guard-bearing change on the harness's own checkout, closed by a human cut

Goal: `the Bash guard judges command lines, not prose: a heredoc body that a command only writes to a file (cat or tee with a redirect) is left out of the text before the deny patterns, the push rule and the sensitive-path scan run, a heredoc fed to a shell or an interpreter is still scanned, the push deny pattern and the push rule match within one line, with tests for each case and a rules.md row`, in feature mode with the spec stage on and no `--change`, so intake authored the OpenSpec change from the sentence. The project was this repository's checkout. The enforcer was the installed 0.5.0 copy for the six build attempts (headless, `scripts/drive.mjs` with `--plugin-root` at that copy) and the 0.5.1 copy for the interactive close-out. This is the first recorded run on a guard-bearing slice, the first with the adversarial review brief, the first to hit the attempt cap, and the first closed by a human decision that cut a criterion.

The result: criterion C-3 (the push rule matching within one line) was cut by decision D-4 after six attempts; the heredoc half (C-1, C-2), its tests (C-4) and the rules row (C-5) landed by hand as [pull request 7](https://github.com/Marron-uno/handoff-harness/pull/7), merged as 79fe290 and released as 0.5.1. The run then closed through `harness next`, reconcile and report ([pull request 8](https://github.com/Marron-uno/handoff-harness/pull/8)); the change was archived in [pull request 9](https://github.com/Marron-uno/handoff-harness/pull/9).

The numbers in `analysis.md`, `expect.json` and the Metrics block of the retro cover the whole events file, which also holds G-1, G-2 and the session's work after done (retro finding R-2). The table gives G-3 alone where the two differ.

| Fact | Self-run 3 (G-3 only) | Self-run 1 |
|---|---|---|
| Outcome | done, 0 of 1 slices; S-1 skipped after 6 attempts, C-3 cut by D-4, the rest landed by hand | done, 1 of 1, every verdict a pass |
| Wall clock | 25.3 h from `goal new` (2026-10-15 19:17Z) to done (2026-10-16 20:32Z), 23.4 h of it resting in awaiting_human; about 2 h of work | 4.4 min |
| Sessions, turns | 2 headless (54 and 110 turns) and 2 interactive (the hand fixes, the close-out) | 1, 24 |
| Cost by Claude Code | $22.70 for the two headless sessions ($1.72 and $20.98); the interactive sessions are not in the record | $0.77 |
| Price table | $25.30 for the whole file; $4.20 of it the judges of G-3 (haiku critics $0.20, strong critics $2.05, strong reviewers $1.33, reconciler $0.15, spec reviewer $0.04) | $0.67 (0.86x) |
| Stop-hook blocks, guard denials, halts | 0, 17, 2 (the file: 0, 34, 4) | 0, 0, 0 |
| Verdict writes rejected | 4 of 15 (the file: 5 of 19), all four the same C-5 evidence rule | 1 of 4 |
| Critic and reviewer tool calls | 12 critic runs: 50 calls on haiku, 65 on opus; 2 strong-reviewer runs, 37 calls | 7 and 4 |
| Project checks in preflight | `npm test` (118 to 124 tests), `npm run check` (11 OpenSpec items), `tests_discriminate`; 76 to 83 s a pass, 8 passes, all green | `npm test` (82 tests), `npm run check` (10 items) |
| Spec stage | authored change: 1 requirement, 8 scenarios, 4 tasks, 5 of 5 criteria cited; pass at the first attempt with 2 minor findings; narrowed by hand after D-4 (task 1.2 cut), 3 of 3 remaining tasks ticked | authored change, 4 of 4 tasks ticked |

## Timeline (UTC)

| Time | What happened |
|---|---|
| 10-15 19:17 | Goal created on the checkout; branch `goal/G-3`; budget $15 and 40 minutes (raised twice later, to $25 and 1500 minutes, then $60 and 4500). |
| 19:18 to 19:19 | Intake: 4 items and 5 criteria from the sentence, the change written under `openspec/changes/`, `harness spec check` pass, one slice; spec reviewer pass with 2 minor findings; auto-approved. |
| 19:19 to 19:36 | Attempts 1 to 3. Preflight green each time in about 80 s. Haiku critic blocks a1 (the push rule read only the first push) and a2 (write-then-run spellings); the strong critic blocks a3 on escapes in the stripping itself (a process substitution taken as the written file, two bash delimiters the terminator search missed). First rejected verdict write at 19:29 (C-5 evidence rule). Attempt cap at 19:36; headless session 1 ends: 54 turns, $1.72. |
| 10-16 14:48 | Human retry after the fail-safe rule was written by hand into the working tree; budget raised. |
| 15:02 to 15:32 | Attempt 4. Critic pass (after one rejected write); strong reviewer blocks round 1 (backslash-newline under an unquoted delimiter; the push rule stopping at a raw newline). Rebuild; critic pass (one rejected write); strong reviewer blocks round 2 (carriage returns before the terminator compare; `joinOpenPush` and a heredoc that `xargs` rebuilds into a push). |
| 15:35 to 16:05 | Attempt 4 round 3, then attempts 5 and 6, each blocked by the strong critic: 15:41 (the delimiter built by deleting quotes and backslashes), 15:53 (`xargs`, `tr` or `paste` rebuilding a push from heredoc lines), 16:05 (a global option value swallowing a heredoc operator; one rejected write first). Attempt cap; headless session 2 ends: 110 turns, $20.98. Every block from attempt 5 on hit the push half (C-3). |
| 16:06 | The worker tried to edit a memory file under `~/.claude`; the protected-path guard denied it. |
| 18:05 | Decision D-4 recorded with `harness decide`: C-3 cut; the push rule and the deny pattern return to the whole-text match of main. The heredoc half, tests and rules row committed by hand (baa6819 narrows the change, ecbd07a is the fix, version 0.5.1); pull request 7 merged at 19:44 as 79fe290. |
| 20:18 | Budget raised; `harness slice skip` on S-1; stage `record` with no active slice. |
| 20:23 to 20:32 | Interactive close-out under the 0.5.1 copy. `harness resume` showed the stale attempt_cap halt beside a record brief naming `harness record`, which fails with no slice; `harness next` moved the run to reconcile. `reconcile prepare` marked all four items deterministically done from the attempt-4 critic passes; the reconciler, told of D-4, overrode I-2 to out_of_scope with no new slice. `reconcile load`, `report`, done. Report commit 87e2b39, pull request 8. |

## What the self-run shows

- The adversarial review of a guard works: every round a strong judge found a real place where the guard and the shell disagree about where a line or a heredoc ends, and each fix held in the next round. The heredoc half converged; the push half did not, because a regex cannot follow every bash mechanism that carries words across a newline. The human cut was the right end, and the proposal's Out of scope records why.
- Nothing in the machine noticed that five block findings across attempts carried the same spec authority while every verdict kept C-3 met. The attempt cap is the only brake, and it let six attempts and $21 through (retro R-1).
- The frozen enforcer denied 11 probe writes by the judges and the builder, all heredocs holding push strings written to fixture files, which is the false positive this goal fixed. A guard fix cannot protect its own run; the judges need a way to probe the checkout's guard, not the live hook (retro R-6, issue 6).
- The record is not scoped to the goal: `events.jsonl`, `usage.json` and the metrics carry G-1, G-2 and the post-done session, and the cost table books $13.88 to stage `done` (retro R-2, issue 5).
- Four close-out defects surfaced in the last ten minutes: the skip leaves the halt set, the record brief with no slice names a failing command, the reconcile input counts passing verdicts from rejected attempts, and the report's criteria table reads C-3 met next to its own out_of_scope line (retro R-4, R-5). `state.json` and `report.md` in this folder show both.
- The validator's C-5 rule sent four fresh critics back once each for a documentation criterion on a guard-bearing slice (retro R-3), and the replay eval cannot replay those rejections, so `expect.json` turns that check off for this run (retro R-7).

## Findings, ranked

The retro proposal is `.harness/proposals/2026-10-16-G-3-retro.md`, with evidence, cause, proposed change and hypothesis for each: R-1 blocks on one authority go uncounted; R-2 the record is not scoped to the goal; R-3 the C-5 evidence rule on docs criteria; R-4 skip leaves the halt and the empty record brief; R-5 stale verdicts in the reconcile input and the report; R-6 judges probe through the frozen live hook; R-7 rule-based rejections are not replayable.

## What to run next

A goal in this repository that takes the retro as its source and fixes R-1 to R-7, in that order of value; then a bench baseline for 0.5.1 so the hypotheses have numbers to land on. The next guard-bearing self-run should be launched from a plain terminal with the installed copy at the version under test, and the judges should probe the checkout's guard source.
