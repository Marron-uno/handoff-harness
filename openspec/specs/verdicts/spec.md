# Verdicts

## Purpose

A judge's output is a JSON file with findings that cite an authority and evidence that exists. Enforced by `schemas/verdict.schema.json`, `scripts/lib/verdict.mjs`, the SubagentStop hook and `harness verdict template`.

## Requirements

### Requirement: A verdict is consistent with its findings

The validator SHALL reject a verdict that says `pass` while carrying a finding of severity `block` or a criterion with status `unmet`, and a verdict that says `block` with no block finding. Every finding SHALL carry an authority of the form `criterion:`, `spec:`, `rule:`, `handoff:` or `test:` and at least one evidence entry.

#### Scenario: Pass with a block finding

- **WHEN** a judge writes `verdict: "pass"` with a finding of severity `block`
- **THEN** the validator rejects the file and names the finding

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

`harness verdict template` SHALL print a skeleton with the active agent, goal, slice, attempt, round, work hash and one `unverified` entry per criterion, and that skeleton SHALL fail validation until the judge fills in the summary, the verdict and the criteria.

#### Scenario: Skeleton written as is

- **WHEN** a judge writes the skeleton to the verdict path unchanged
- **THEN** the validator rejects it for the empty summary
