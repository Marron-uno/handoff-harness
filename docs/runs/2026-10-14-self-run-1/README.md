# Self-run 1: the harness builds a feature on its own checkout

Goal: `add a bundle size preflight check: budgets.bundleBytes in the profile maps file paths to a byte cap, preflight fails when a file is over its cap, with a test and a rules.md row`, in feature mode with the spec stage on and no `--change`, so intake authored the OpenSpec change from the sentence and the code. The project was this repository's checkout; the enforcer was the installed 0.4.0 copy, through `node scripts/drive.mjs --cwd . --plugin-root ~/.claude/plugins/cache/marron-uno/handoff-harness/0.4.0`. Auto-approved, main session on Sonnet, judges on their default models. The result is [pull request 1](https://github.com/Marron-uno/handoff-harness/pull/1), left for a human to merge. This is the first recorded self-run and the first recorded run of the authored-change path.

| Fact | Self-run 1 | Run 3 |
|---|---|---|
| Outcome | done, 1 of 1 slices, every verdict a pass | done, 2 of 3 |
| Wall clock | 4.4 min, one session, 24 turns | 5.5 min, 16 turns |
| Cost by Claude Code | $0.77 | $0.88 |
| Price table | $0.67 (0.86x) | $0.77 (0.88x) |
| Stop-hook blocks, guard denials, halts | 0, 0, 0 | 0, 0, 0 |
| Verdict writes rejected | 1 of 4 | 2 of 7 |
| Critic and reviewer tool calls | 7 and 4 | 8 and 10, 2 and 3 |
| Project checks in preflight | `npm test` (82 tests), `npm run check` (10 OpenSpec items) | `npm test` on the fixture |
| Spec stage | authored change: 2 requirements, 6 scenarios, 4 tasks, 6 of 6 criteria cited, 4 minor findings, 4 of 4 tasks ticked | adopted change |

## Timeline (UTC)

| Time | What happened |
|---|---|
| 19:01 | Goal created on the checkout; branch `goal/G-1`. |
| 19:03:23 | Intake: inventory of 4 items and 6 criteria from the sentence, the change written under `openspec/changes/g-1-add-a-bundle-size-preflight-check-budgets-bundle/`, `harness spec check` pass, one slice planned. |
| 19:03:53 | Spec reviewer: pass with four minor findings, among them that "skip" covered both an empty map and a missing file without saying what happens when one file is missing and another is over its cap. Auto-approve committed the change. |
| 19:04:20 | Build: `budgets.bundleBytes` in the default profile, `bundleSizeCheck` exported from `preflight.mjs` and wired as the `bundle_size` check, four tests, a rules row. The fourth test is the spec reviewer's case: a missing file does not hide another file over its cap. |
| 19:04:38 | Preflight: branch, diff budget, paths, language, secrets, OpenSpec validate, `npm test`, `npm run check`, all pass. Packet written. |
| 19:05:26 | Critic's first verdict rejected: a finding carried a `summary` key instead of `id` and `issue`. Kept under `verdicts/rejected/`. |
| 19:05:38 | Critic: pass, 7 tool calls, one minor finding (the pass path is tested only at the exact cap). |
| 19:06:15 | Reviewer: pass, 4 tool calls, the same minor finding. Recorded: `feat: Bundle size budget: profile key, preflight check, test, rules row [S-1] (G-1)`, tasks ticked, branch pushed. |
| 19:06:20 to 19:07 | Reconciliation: every item done. Report written and committed; the driver refreshed it with the session cost. |

## What the self-run shows

- The guard rule did not need loosening. The checkout's `scripts/`, `profiles/` and `docs/` were ordinary project files because a different copy enforced the run; `openspec/specs/` stayed protected; the run never tried to touch the enforcing copy.
- The authored-change path works end to end: the proposal states a hypothesis (none expected to move, measured by the unit test), the delta cites the criteria, the tasks are owned by the slice, and `record` ticked them.
- The harness's own test suite as a project check costs about thirty seconds per preflight and caught nothing, which is the expected result for a clean slice.
- A spec finding turned into a test before the code existed, which is the spec stage doing its job on a four-line feature.

## Findings, ranked

1. **Finding objects still get fumbled once per run.** The skeleton fixes the top level and the criteria entries; the critic put `summary` where `id` and `issue` go. The rejected file is now a replay fixture. Candidate change: the skeleton note or the brief shows one example finding object. Hypothesis: `invalidVerdicts: zero` from 1.
2. **The frozen copy is a manual step.** The driver needs `--plugin-root` and the marketplace copy disabled by hand. A `harness self-run` helper that finds the installed copy, checks its version, and disables and re-enables the marketplace entry would remove two mistakes waiting to happen. No change yet.
3. **Reading `secret-scan.mjs` from inside a self-run is denied** by the `**/*secret*` sensitive-path pattern. It did not matter for this goal; it will for one that touches the secret scan. No change yet; the pattern is broad on purpose.

## What to run next

A self-run on a change that touches a guard, to see the sensitive-path denial and whether the judges can review hook code. And the bench baseline for 0.4.0, so the next retro's hypotheses have numbers to land on.
