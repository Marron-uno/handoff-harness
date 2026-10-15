# Verdicts

## Purpose

A judge's output is a JSON file with findings that cite an authority and evidence that exists. Enforced by `schemas/verdict.schema.json`, `scripts/lib/verdict.mjs`, the SubagentStop hook and `harness verdict template`.

## Requirements

### Requirement: A verdict is consistent with its findings

The validator SHALL reject a verdict that says `pass` while carrying a finding of severity `block` or a criterion with status `unmet`, and a verdict that says `block` with no block finding. Every finding SHALL carry an authority of the form `criterion:`, `spec:`, `rule:`, `handoff:`, `test:` or `decision:` and at least one evidence entry; a `decision:` authority SHALL name a recorded decision.

#### Scenario: Pass with a block finding

- **WHEN** a judge writes `verdict: "pass"` with a finding of severity `block`
- **THEN** the validator rejects the file and names the finding

#### Scenario: Decision that was never made

- **WHEN** a finding cites `decision:D-7` and no default D-7 exists
- **THEN** the validator rejects the verdict naming the finding

### Requirement: A verdict judges the current change set

Every verdict SHALL carry the work hash of the change set it judged. The validator SHALL reject a verdict whose hash differs from the current work hash as stale, and SHALL reject a verdict for a goal, slice or attempt other than the active one.

#### Scenario: Edit after the judge looked

- **WHEN** a source file changes after the verdict was written
- **THEN** the verdict is stale and the stage repeats with the reason

### Requirement: Evidence exists on disk

The validator SHALL reject evidence of type `file`, `test`, `diff`, `screenshot` or `gif` without a path, a path that does not exist, and a screenshot without the host it was captured on. A `met` criterion SHALL carry at least one evidence entry.

#### Scenario: Invented path

- **WHEN** a finding cites `tests/missing.test.mjs` and no such file exists
- **THEN** the validator rejects the verdict with the path in the message

### Requirement: A judge cannot finish without a valid verdict

At SubagentStop, a judge in a judging stage SHALL be sent back with the validator's errors when its verdict is missing or invalid, and a rejected verdict SHALL be kept under `.harness/verdicts/rejected/` before the judge rewrites it.

#### Scenario: Rejected then fixed

- **WHEN** a critic stops with a verdict whose evidence entries are strings
- **THEN** the hook blocks with the schema errors, keeps a copy of the rejected file, and accepts the rewritten verdict on the next stop

### Requirement: The skeleton cannot pass unedited

`harness verdict template` SHALL print a skeleton with the active agent, goal, slice, attempt, round, work hash and one `unverified` entry per criterion, next to a `findingExample` carrying every finding key that validates, and that skeleton SHALL fail validation until the judge fills in the summary, the verdict and the criteria.

#### Scenario: Skeleton written as is

- **WHEN** a judge writes the skeleton to the verdict path unchanged
- **THEN** the validator rejects it for the empty summary

#### Scenario: Example copied

- **WHEN** a judge copies the example finding with an evidence path that exists
- **THEN** the finding validates

### Requirement: Validate names the verdict and what made it stale

`harness verdict validate` SHALL validate the verdict of the current judging stage when no path is given, SHALL resolve to the project root from any directory inside it, and SHALL print the current work hash, the verdict's hash and the changed files when the verdict is stale.

#### Scenario: Reviewer in a subfolder

- **WHEN** the reviewer runs `verdict validate` from a subdirectory with no path
- **THEN** the verdict for the current slice, attempt and round is validated against the same work hash `harness next` computes

#### Scenario: Stray file

- **WHEN** a file outside `.harness/` appeared after the verdict was written
- **THEN** the output lists it under changed files

### Requirement: Guard claims rest on probes

On a guard-bearing slice, the validator SHALL reject a verdict in which a criterion with status `met` or a finding of severity `block` or `major` carries no evidence of type `command` or `test`. `harness verdict template` SHALL say so in its output for such a slice.

#### Scenario: Met on a file quote

- **WHEN** the critic marks a criterion met with evidence of type `file` only on a guard-bearing slice
- **THEN** the validator rejects the verdict naming the criterion

#### Scenario: Escape shown by a probe

- **WHEN** the reviewer writes a block finding with evidence of type `command` quoting the probe's output
- **THEN** the verdict validates
