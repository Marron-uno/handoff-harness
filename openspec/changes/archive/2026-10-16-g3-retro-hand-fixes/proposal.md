# Change: Hand fixes from the G-3 retro

## Why

Self-run 3 (goal G-3, recorded under `docs/runs/2026-10-16-self-run-3`) left the retro proposal `.harness/proposals/2026-10-16-G-3-retro.md` with seven findings. Three of them are defects in the state machine's bookkeeping rather than in any guard, and each cost the human a step in that run: the retro's own numbers mixed three goals and the session's work after done (R-2), a skipped slice left its attempt-cap halt beside a record brief whose command fails without a slice (R-4), and the reconcile input and the report took the cut criterion as met from the passes of an attempt the human had skipped past (R-5). This change closes those three by hand.

## What Changes

- `goal new` moves the previous goal's events log, cost summary and intake artifacts under `.harness/runs/<goal id>/` instead of leaving the log and the cost summary in place, numbers the new goal one past the highest id that the previous state, the log and the kept runs know, and the cost attribution counts transcript and subagent rows between the goal's creation and its completion only (R-2).
- `slice skip` clears the halt with the slice; the record stage with no active slice renders a brief that names `harness next`, and `harness record` fails naming it (R-4).
- One module decides which verdicts set a criterion: those of the active goal, on a slice that was not skipped, at that slice's recorded attempt. The report lists a skipped slice's criteria as `skipped`; the reconcile input marks an item done deterministically from those verdicts and no others (R-5).

## Hypothesis

Measured by the replay eval of the next recorded run under `docs/runs/`: `halts: down` from self-run 3's figure of 4 to the run's own count, and `sessions: down` from 4 for the same reason, since the log holds one goal; `haltCode: zero` for a run that a skip takes to done. Not expected to move: `slicesDone`, `reconcileMissing`. The recorded self-run 3 keeps its numbers, since its snapshot holds the mixed log.

## Out of scope

R-1 (block findings against one requirement left uncounted), R-3 (the probe rule on a documentation criterion of a guard-bearing slice), R-6 (judges probing a guard against the frozen copy) and R-7 (the replay eval and guard-bearing rejections). R-3 and the lane change for sessions resting in a human-wait stage touch the guards and the validator, so they land through a goal run on this checkout, where the adversarial review applies.

## Impact

- Specs: `state-machine` (one modified and two added requirements), `cost` (one modified requirement)
- Code: `scripts/cli.mjs`, `scripts/lib/paths.mjs`, `scripts/lib/machine.mjs`, `scripts/lib/criteria.mjs` (new), `scripts/lib/report.mjs`, `scripts/lib/reconcile.mjs`, `scripts/lib/usage.mjs`, `briefs/record-advance.md` (new)
- Tests: `tests/g3-retro.test.mjs` (new), `tests/field-issues.test.mjs`, `tests/usage.test.mjs`, `tests/e2e-machine.test.mjs`
- Docs: `docs/rules.md`, `docs/architecture.md`; version 0.5.2
- Guard-bearing paths (`scripts/lib/guards`, `scripts/hooks`, `profiles`, `schemas`): none touched, so the change lands as a hand pull request, like the field-issues change.
