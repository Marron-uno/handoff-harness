# State machine

## MODIFIED Requirements

### Requirement: The report reads the recorded attempt of the active goal

The report SHALL take each criterion's status from the verdicts of the active goal's slices that were not skipped, at each slice's recorded attempt only, with a later round winning over an earlier one and the reviewer over the critic; the criteria of a skipped slice SHALL read `skipped` unless another slice's verdict set them. Reconciliation SHALL count a criterion as met from the same verdicts and no others.

#### Scenario: Verdicts left by an earlier goal

- **WHEN** `.harness/verdicts/` holds a pass from a previous goal and a pre-retry block for the current slice
- **THEN** the report lists the criteria of the recorded attempt and none of the earlier goal's

#### Scenario: Skipped slice with earlier passes

- **WHEN** a slice passed both judges at attempt 4, blocked at attempt 6, and a human skipped it
- **THEN** the report lists its criteria as `skipped` and the reconcile input leaves its items for the model to judge

#### Scenario: Pass before a retry

- **WHEN** a slice passed at attempt 1, was retried, and its recorded attempt 2 holds a block
- **THEN** the report and the reconcile input read attempt 2, and the pass of attempt 1 marks nothing met

## ADDED Requirements

### Requirement: Each goal has its own log

`harness goal new` SHALL move the previous goal's events log, cost summary and intake artifacts under `.harness/runs/<previous goal id>/` before it writes the new state, so that the new goal's events, metrics and budget start with nothing of the old one, and SHALL number the new goal one past the highest id that the previous state, the log and the kept runs know.

#### Scenario: Third goal

- **WHEN** two goals have run and a third is created
- **THEN** its id is `G-3`, `.harness/runs/G-2/events.jsonl` holds the second goal's log, and the current log starts with the third goal's `new` event

### Requirement: A skipped slice leaves no halt behind

`harness slice skip` SHALL clear the halt with the slice. With the stage at `record` and no active slice, the brief SHALL say the slice was skipped and name `harness next`, and `harness record` SHALL fail naming `harness next`.

#### Scenario: Skip after the attempt cap

- **WHEN** a slice rests in `awaiting_human` with code `attempt_cap` and a human runs `harness slice skip`
- **THEN** `harness resume` shows no halt and a brief naming `harness next`, and `harness next` starts the next ready slice or reconciliation
