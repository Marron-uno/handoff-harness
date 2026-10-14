# Evals

## ADDED Requirements

### Requirement: One definition of a run's metrics

`scripts/lib/metrics.mjs` SHALL compute a flat set of numbers from a directory holding `state.json` and `events.jsonl`, whether a project's `.harness/` or a recorded snapshot, and `harness analyze`, `harness retro`, the replay evals and the bench SHALL all use it.

#### Scenario: Recorded runs

- **WHEN** the metrics run over the three recorded snapshots
- **THEN** they reproduce the numbers in each run's write-up

### Requirement: Replay evals run in CI over recorded runs

For every snapshot under `docs/runs/` with an `expect.json`, the test suite SHALL check the current code against the recorded artifacts: the metrics named in the expectation, the held slices the goal predicate reports for the recorded state, that every recorded valid verdict still passes the schema, and that every file under `verdicts/rejected/` still fails it.

#### Scenario: Held slice regression

- **WHEN** the recorded run 3 state is replayed
- **THEN** the goal predicate reports S-3 as held pending, so the run would rest instead of ending done

### Requirement: A bench compares arms on the fixture

`scripts/eval/bench.mjs --label <name> --runs N` SHALL drive N fresh headless runs of the fixture goal, snapshot each with its metrics, and write a summary; `scripts/eval/compare.mjs <baseline> <candidate>` SHALL print per-metric min, mean and max for both arms with the delta, and SHALL mark each hypothesis in a proposal as supported, weak or not supported from the direction and the overlap of the ranges.

#### Scenario: Overlapping ranges

- **WHEN** the candidate's mean moved in the hypothesized direction but its range overlaps the baseline's
- **THEN** the hypothesis is marked weak, not supported

### Requirement: A plugin eval case for the goal skill

`evals/` SHALL hold at least one `claude plugin eval` case that runs the goal skill on the fixture and grades that the skill fired and that the inventory, plan and goal card were written.

#### Scenario: Suite runs

- **WHEN** `claude plugin eval . --case goal-intake` runs with the tools the skill needs
- **THEN** the case is scored from the graders and the result lands under `evals/results/`
