# Guards

## ADDED Requirements

### Requirement: The harness edits its own repository only under a frozen enforcer

The path guard SHALL keep denying writes under the enforcing plugin root. When the project is a checkout of the harness and the enforcing copy is a different directory, writes to the checkout SHALL be allowed like any project's files; when the enforcing copy is the project itself, the denial SHALL say to drive the run with a frozen copy.

#### Scenario: Frozen copy enforces

- **WHEN** the project directory holds the harness's `.claude-plugin/plugin.json` and the plugin root is a different copy
- **THEN** a write to `scripts/lib/preflight.mjs` in the project is allowed

#### Scenario: Same copy

- **WHEN** the plugin root is the project directory
- **THEN** the write is denied and the reason names `--plugin-root`
