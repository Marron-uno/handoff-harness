# Spec stage

## Purpose

With `--openspec` on the goal, the run builds from an OpenSpec change that cites the inventory. Enforced by `scripts/lib/openspec.mjs`, the intake handler, the spec reviewer's verdict rules, `goal approve` and `record`.

## Requirements

### Requirement: The change cites the inventory

`harness spec check` SHALL verify the delta format, run `openspec validate <change> --strict`, and require that every in-scope criterion id is cited somewhere in the proposal, deltas or tasks, that every task cites an inventory id, and that every task is owned by exactly one slice of the plan. Intake SHALL NOT complete on a change that fails the check.

#### Scenario: Uncited criterion

- **WHEN** the change cites every criterion except C-4
- **THEN** the check fails naming C-4 and intake repeats

### Requirement: A spec verdict before the goal card

The spec reviewer SHALL judge the change in the `spec_review` stage with a verdict that has `slice` null, the active spec attempt, empty criteria and the current work hash. A block SHALL send the run back to intake with the findings; after `caps.maxAttempts` blocks the run SHALL rest in `awaiting_human`.

#### Scenario: Block then pass

- **WHEN** the spec reviewer blocks on an invented requirement and intake amends the change
- **THEN** the second attempt's verdict is judged against the amended change

### Requirement: Scripts tick the tasks

Approval SHALL commit the change folder; `record` SHALL tick the slice's tasks in `tasks.md` inside the slice commit; the goal predicate SHALL require every task ticked except tasks owned by a skipped or held slice. Archiving the change into `openspec/specs` SHALL remain a human step.

#### Scenario: Task left open

- **WHEN** a built slice's task is not ticked
- **THEN** the goal predicate reports the task id and the run does not reach `done`
