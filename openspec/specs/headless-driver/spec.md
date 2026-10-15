# headless-driver Specification

## Purpose

Unattended runs. Claude Code stops a session after eight consecutive Stop-hook continuations, so `scripts/drive.mjs` loops headless sessions until the run rests, records each session's cost as the number of record, refreshes the committed report with it, and names the copy of the plugin that enforces the run, so a checkout of the harness can be driven by a frozen copy of itself.

## Requirements

### Requirement: The driver names its enforcer

`scripts/drive.mjs` SHALL accept `--plugin-root <dir>` for the copy of the harness that enforces the run, defaulting to its own checkout, SHALL pass that directory as the session's plugin and in the resume command, and SHALL refuse to start when the enforcing copy is the project directory or holds no `scripts/cli.mjs`.

#### Scenario: Project is the harness

- **WHEN** the driver is started with `--cwd` equal to its own checkout and no `--plugin-root`
- **THEN** it exits with a message naming `--plugin-root` and starts no session

#### Scenario: Frozen copy

- **WHEN** the driver is started with `--plugin-root` pointing at an installed copy
- **THEN** every session loads that copy and the log line names it
