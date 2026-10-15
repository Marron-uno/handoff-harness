# State machine

## MODIFIED Requirements

### Requirement: Caps hand control to a human

The machine SHALL rest in `awaiting_human` or `halted` with a coded reason when a slice fails its attempt cap, a review passes its round cap, the Stop hook has blocked `maxConsecutiveBlocks` times without a stage transition, the work hash oscillates between two values, or a time or cost budget is exceeded. The attempt count SHALL be cumulative across `harness retry`: a retry starts the next attempt, keeps the history, and the cap counts the attempts since the retry. The attempt-cap reason SHALL name `harness retry` as the way to continue. The runaway cap SHALL stay below Claude Code's limit of eight continuations.

#### Scenario: Runaway

- **WHEN** the Stop hook has blocked seven times in one stage with no transition between them
- **THEN** the run rests in `halted` with code `runaway` and the reason names the stage

#### Scenario: Retry after the cap

- **WHEN** a slice failed three attempts and a human runs `harness retry`
- **THEN** the slice builds as attempt 4 with its own verdict paths, the report shows 4 attempts, and the cap trips again only after three more failures

## ADDED Requirements

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

The report SHALL take each criterion's status from the active goal's slice verdicts only, with a later attempt winning over an earlier one, a later round over an earlier one, and the reviewer over the critic. Reconciliation SHALL count met criteria from the active goal's verdicts only.

#### Scenario: Verdicts left by an earlier goal

- **WHEN** `.harness/verdicts/` holds a pass from a previous goal and a pre-retry block for the current slice
- **THEN** the report lists the criteria of the recorded attempt and none of the earlier goal's
