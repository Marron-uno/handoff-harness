# State machine

## ADDED Requirements

### Requirement: Guard-bearing slices are reviewed adversarially

For a guard-bearing slice the machine SHALL render the adversarial review brief in place of the standard one, in the Stop hook, in `harness next` and in `harness resume`, and SHALL name the strong reviewer from the first round regardless of the rejection count. The critic brief SHALL carry the guard note.

#### Scenario: First review of a guard change

- **WHEN** the critic passes a guard-bearing slice with no prior rejections
- **THEN** the review brief is the adversarial one and names `reviewer-strong`

#### Scenario: Ordinary slice

- **WHEN** the slice touches no guard path
- **THEN** the standard review brief and the escalation rule apply as before
