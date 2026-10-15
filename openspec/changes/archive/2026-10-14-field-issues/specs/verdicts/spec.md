# Verdicts

## MODIFIED Requirements

### Requirement: A verdict is consistent with its findings

The validator SHALL reject a verdict that says `pass` while carrying a finding of severity `block` or a criterion with status `unmet`, and a verdict that says `block` with no block finding. Every finding SHALL carry an authority of the form `criterion:`, `spec:`, `rule:`, `handoff:`, `test:` or `decision:` and at least one evidence entry; a `decision:` authority SHALL name a recorded decision.

#### Scenario: Pass with a block finding

- **WHEN** a judge writes `verdict: "pass"` with a finding of severity `block`
- **THEN** the validator rejects the file and names the finding

#### Scenario: Decision that was never made

- **WHEN** a finding cites `decision:D-7` and no default D-7 exists
- **THEN** the validator rejects the verdict naming the finding

### Requirement: The skeleton cannot pass unedited

`harness verdict template` SHALL print a skeleton with the active agent, goal, slice, attempt, round, work hash and one `unverified` entry per criterion, next to a `findingExample` carrying every finding key that validates, and that skeleton SHALL fail validation until the judge fills in the summary, the verdict and the criteria.

#### Scenario: Skeleton written as is

- **WHEN** a judge writes the skeleton to the verdict path unchanged
- **THEN** the validator rejects it for the empty summary

#### Scenario: Example copied

- **WHEN** a judge copies the example finding with an evidence path that exists
- **THEN** the finding validates

## ADDED Requirements

### Requirement: Validate names the verdict and what made it stale

`harness verdict validate` SHALL validate the verdict of the current judging stage when no path is given, SHALL resolve to the project root from any directory inside it, and SHALL print the current work hash, the verdict's hash and the changed files when the verdict is stale.

#### Scenario: Reviewer in a subfolder

- **WHEN** the reviewer runs `verdict validate` from a subdirectory with no path
- **THEN** the verdict for the current slice, attempt and round is validated against the same work hash `harness next` computes

#### Scenario: Stray file

- **WHEN** a file outside `.harness/` appeared after the verdict was written
- **THEN** the output lists it under changed files
