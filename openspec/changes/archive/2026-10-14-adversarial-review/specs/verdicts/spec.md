# Verdicts

## ADDED Requirements

### Requirement: Guard claims rest on probes

On a guard-bearing slice, the validator SHALL reject a verdict in which a criterion with status `met` or a finding of severity `block` or `major` carries no evidence of type `command` or `test`. `harness verdict template` SHALL say so in its output for such a slice.

#### Scenario: Met on a file quote

- **WHEN** the critic marks a criterion met with evidence of type `file` only on a guard-bearing slice
- **THEN** the validator rejects the verdict naming the criterion

#### Scenario: Escape shown by a probe

- **WHEN** the reviewer writes a block finding with evidence of type `command` quoting the probe's output
- **THEN** the verdict validates
