# Holds

## Purpose

Questions only a human can answer block only the slices that need them, and never let a run call itself done. Enforced by `scripts/lib/machine.mjs`, `scripts/lib/goal-check.mjs` and `harness hold`.

## Requirements

### Requirement: A hold blocks only its slices

A plan question of kind `hold` SHALL block the slices named in `blocks` and no others; a blocked slice SHALL never be started while the hold is open.

#### Scenario: Other slices proceed

- **WHEN** H-1 blocks S-3 and S-1, S-2 are ready
- **THEN** S-1 and S-2 are built and S-3 stays pending

### Requirement: An open hold rests the run

When every unheld slice is done and a hold still blocks a pending slice, the run SHALL rest in `awaiting_human` with code `holds_open` after the report is written, and SHALL NOT transition to `done`.

#### Scenario: Last slice held

- **WHEN** the report is written and S-3 is pending behind H-1
- **THEN** the run rests in `awaiting_human` naming S-3 and H-1, with no `done` event

### Requirement: Answering a hold resumes the run

`harness hold answer --id H-n --answer "..."` SHALL remove the hold, record the answer as the next applied default, and, when the run was resting on the hold, start the held slice with its build brief. Hold ids SHALL never repeat within a goal.

#### Scenario: Answer and build

- **WHEN** a human answers H-1 while the run rests on it
- **THEN** the stage becomes building with S-3 active and the answer appears under defaults
