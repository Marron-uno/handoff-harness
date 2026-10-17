# Cost accounting

## MODIFIED Requirements

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
