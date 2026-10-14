# Change: Run the harness against its own repository

## Why

The path guard denies every write under the plugin root from inside a run, and when the project is the harness checkout that is every file, so the harness could not build its own changes. The rule is right: a run must not edit the hooks that judge it. The way through is not to loosen it but to separate the two roles: the checkout is the project, and a different, frozen copy of the plugin is the enforcer. Motivated by `docs/evals.md` ("what this loop does not do yet") and the 0.4.0 status note.

## What Changes

- `scripts/drive.mjs --plugin-root <dir>` names the enforcing copy and refuses to run when it is the project itself.
- The path guard's denial says what to do when the same copy would edit itself.
- `harness init` reports the self-run route when the project is the harness.
- The repository's own `.gitignore` keeps `.harness/profile.json`, `lessons.md`, `proposals/` and `reports/`, as `init` sets up everywhere else.
- A first recorded self-run: a feature goal on this checkout, enforced by the installed 0.4.0 copy, with the spec stage authoring the change.

## Hypothesis

`slicesDone: up` from 0 on this repository (no run was possible), measured by the recorded self-run; `blocks: down` is not expected to change. The authored-change path gets its first recorded run as a side effect.

## Out of scope

Editing the enforcing copy during a run, in any form. A self-run changes the checkout; the frozen copy stays as installed until the change is merged and the plugin updated.

## Impact

- Specs: `guards` (added requirement), `headless-driver` (new)
- Code: `scripts/drive.mjs`, `scripts/lib/guards/path-guard.mjs`, `scripts/cli.mjs`, `.gitignore`, `tests/self-run.test.mjs`
