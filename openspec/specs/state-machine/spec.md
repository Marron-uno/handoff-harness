# State machine

## Purpose

One run, one state file. Scripts decide which stage the run is in, whether it may advance, and when it rests; the model never declares a stage complete. Enforced by `scripts/lib/machine.mjs`, the Stop hook and the CLI commands that produce evidence.

## Requirements

### Requirement: Stages advance only on verified evidence

The machine SHALL advance from a stage only when the artifact that stage must produce exists and is valid: inventory, plan and goal card for intake; a verdict with the current work hash for critic and review; a commit carrying the slice id for record; a fresh reconciliation result for reconcile; a report for report. Otherwise it SHALL repeat the stage brief.

#### Scenario: Stop without the artifact

- **WHEN** the main session stops in the critic stage and no verdict file exists for the active slice, attempt and round
- **THEN** the Stop hook blocks with the critic brief and the stage does not change

#### Scenario: CLI command carries the evidence

- **WHEN** `harness preflight` runs in the preflight stage and every check passes
- **THEN** the command itself advances the machine to critic and prints the critic brief, without a stop

### Requirement: Resting stages end the session

The Stop hook SHALL let a session end only in a resting stage: `awaiting_approval`, `awaiting_human`, `budget_exceeded`, `halted`, `done`. In every other stage it SHALL block with the brief for that stage.

#### Scenario: Done run stops silently

- **WHEN** the session stops and the stage is `done`
- **THEN** the hook allows the stop and writes nothing

### Requirement: Caps hand control to a human

The machine SHALL rest in `awaiting_human` or `halted` with a coded reason when a slice fails its attempt cap, a review passes its round cap, the Stop hook has blocked `maxConsecutiveBlocks` times without a stage transition, the work hash oscillates between two values, or a time or cost budget is exceeded. The runaway cap SHALL stay below Claude Code's limit of eight continuations.

#### Scenario: Runaway

- **WHEN** the Stop hook has blocked seven times in one stage with no transition between them
- **THEN** the run rests in `halted` with code `runaway` and the reason names the stage

### Requirement: Goal completion is a script predicate

The goal SHALL be done only when every slice that is not held or skipped is done, every reconciliation item is done or explicitly partial with no missing items left after the allowed passes, the reconciliation result matches the current work hash, the report exists, and, with the spec stage on, every task owned by a built slice is ticked. The model SHALL NOT be able to declare the goal done.

#### Scenario: Report written, predicate unmet

- **WHEN** the report is written but a slice is still pending and not held
- **THEN** the run rests in `awaiting_human` with code `goal_incomplete` and the reasons listed
