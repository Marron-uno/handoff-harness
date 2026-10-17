# Cost accounting

## Purpose

Every run ends with a bill. Enforced by `scripts/lib/usage.mjs`, the Stop and SubagentStop hooks, the headless driver and the report.

## Requirements

### Requirement: Each message counts once

Usage SHALL be read from assistant rows of the transcript with each `message.id` counted once, since Claude Code writes one row per content block with the same usage. Subagent usage SHALL be recorded at SubagentStop as the delta since that agent's previous stop. Rows SHALL count only between the goal's `new` event and its `done` event, subagent rows by the time of their usage event, so that a previous goal's work and a session's work in the dormant project after `done` are not the goal's cost.

#### Scenario: Three rows, one message

- **WHEN** a response with three tool calls appears as three transcript rows sharing one id
- **THEN** the attribution counts its tokens once

#### Scenario: Judge stops twice

- **WHEN** a judge is sent back by the hook and stops again
- **THEN** the second usage event carries only the calls and tokens since the first stop

#### Scenario: Work after done

- **WHEN** the transcript holds rows after the goal's `done` event and the log holds a subagent usage event after it
- **THEN** neither counts toward the goal's total or its budget

### Requirement: Priced from the profile, with the reported figure as the number of record

Costs SHALL be priced per model family from `pricing.perMillion`, with one-hour and five-minute cache writes priced apart when the transcript reports the TTL and an optional long-context tier. The headless driver SHALL record Claude Code's own session cost as a `session` event, and the report SHALL print it next to the table, refreshed after the run rests.

#### Scenario: Report after the session

- **WHEN** the driver records the session cost and the run is resting
- **THEN** `harness report --refresh` re-renders the committed report with the reported figure and does not advance the machine

### Requirement: Budgets stop the run

The Stop hook SHALL rest the run in `budget_exceeded` when the attributed cost exceeds `--budget-usd` or the elapsed time since approval exceeds `--budget-minutes`.

#### Scenario: Over budget

- **WHEN** the usage summary exceeds the goal's dollar budget
- **THEN** the run rests with code `budget_usd` and the command that raises it
