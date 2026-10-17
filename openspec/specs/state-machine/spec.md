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

### Requirement: Attempts count across retries

The attempt count SHALL be cumulative across `harness retry`: a retry starts the next attempt, keeps the history, and the cap counts the attempts since the retry. The attempt-cap reason SHALL name `harness retry` as the way to continue.

#### Scenario: Retry after the cap

- **WHEN** a slice failed three attempts and a human runs `harness retry`
- **THEN** the slice builds as attempt 4 with its own verdict paths, the report shows 4 attempts, and the cap trips again only after three more failures

### Requirement: Goal completion is a script predicate

The goal SHALL be done only when every slice that is not held or skipped is done, every reconciliation item is done or explicitly partial with no missing items left after the allowed passes, the reconciliation result matches the current work hash, the report exists, and, with the spec stage on, every task owned by a built slice is ticked. The model SHALL NOT be able to declare the goal done.

#### Scenario: Report written, predicate unmet

- **WHEN** the report is written but a slice is still pending and not held
- **THEN** the run rests in `awaiting_human` with code `goal_incomplete` and the reasons listed

### Requirement: Human amendments after approval

`harness slice amend` SHALL replace or extend a pending slice's paths in the state and in `plan.json` and log a `slice` event marked as a human action; a recorded slice SHALL NOT be amended. `harness decide` SHALL record a human decision as an applied default, scoped to a slice when one is named, in the state, in `plan.json` and in the events log, so the packet lists it and a judge can cite it.

#### Scenario: Planning miss

- **WHEN** preflight fails because the slice touched a file outside its paths and a human runs `slice amend --add`
- **THEN** the next preflight passes the slice-paths check and the plan shows the new path

#### Scenario: Spec conflict

- **WHEN** a human runs `harness decide --slice S-15 --text "..."`
- **THEN** D-n appears under the defaults with the slice, in the slice's packet, and `decision:D-n` validates as an authority

### Requirement: Record keeps harness configuration apart

`harness record` SHALL commit changes to `.harness/profile.json`, `.harness/lessons.md` and `.harness/proposals/` in a commit of their own before the slice commit, and SHALL list them in its output and in the record event.

#### Scenario: Budget raised mid-slice

- **WHEN** the profile changed while the slice was built
- **THEN** the slice commit holds the reviewed files only and a `chore` commit before it holds the profile

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

### Requirement: Guard-bearing slices are reviewed adversarially

For a guard-bearing slice the machine SHALL render the adversarial review brief in place of the standard one, in the Stop hook, in `harness next` and in `harness resume`, and SHALL name the strong reviewer from the first round regardless of the rejection count. The critic brief SHALL carry the guard note.

#### Scenario: First review of a guard change

- **WHEN** the critic passes a guard-bearing slice with no prior rejections
- **THEN** the review brief is the adversarial one and names `reviewer-strong`

#### Scenario: Ordinary slice

- **WHEN** the slice touches no guard path
- **THEN** the standard review brief and the escalation rule apply as before

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
