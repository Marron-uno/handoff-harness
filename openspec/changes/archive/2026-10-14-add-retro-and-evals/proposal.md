# Change: Retro skill, evals, and an OpenSpec for the harness itself

## Why

After each of the three recorded runs the retrospective was done by hand: read the events, rank the findings, fix the harness, write it up. The run 3 retro found a bug the model had noticed and the script had not. That loop is the harness's own feedback and it should be a command, and a change to the harness should be measured, not asserted. Motivated by `docs/runs/2026-10-14-fixture-run-3/README.md` findings 1 to 5.

## What Changes

- `harness retro` and the `retro` skill: a proposal under `.harness/proposals/` with the run's metrics, the signals a script can see, and findings with a cause, a change by file and a hypothesis as a metric and a direction.
- `scripts/lib/metrics.mjs`: one definition of a run's numbers, shared by analyze, retro, the replay evals and the bench.
- Rejected verdicts kept under `.harness/verdicts/rejected/` as replay fixtures.
- Evals in three tiers (`docs/evals.md`): replay over recorded runs in CI, a paid bench of N headless runs with a comparison against a baseline and against the proposal's hypotheses, and a `claude plugin eval` case for the goal skill.
- This `openspec/` folder: baseline specs for the state machine, verdicts, guards, preflight, the spec stage, cost and holds, derived from `docs/rules.md`; later rules are deferred until a change touches them.

## Hypothesis

`invalidVerdicts: down` from 2 of 7 on run 3 once the evidence shape is in the briefs, measured by the replay eval over `verdicts/rejected/` and by the bench. The retro itself is measured by whether its signals on run 3 name the held slice, the rejected writes and the critic's calls without being told; that is a unit test.

## Out of scope

Running a goal against the harness repo itself. The path guard denies every write under the plugin root, so the harness cannot yet build its own change; lifting that for the harness repo only is a follow-up change that goes through this spec stage.

## Impact

- New specs: `retro`, `evals`
- Code: `scripts/lib/metrics.mjs`, `scripts/lib/retro.mjs`, `scripts/cli.mjs`, `scripts/hooks/subagent-stop.mjs`, `scripts/eval/*`, `skills/retro/`, `evals/`, `tests/metrics.test.mjs`, `tests/retro.test.mjs`, `tests/replay.test.mjs`, `tests/evals.test.mjs`
