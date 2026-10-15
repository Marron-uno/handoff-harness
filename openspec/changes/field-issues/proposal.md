# Change: Field issues from the first real-project run

## Why

The first run on a real project (the angar run, goals G-1 to G-5, 2026-10-14) left `docs/field-issues.md`: fourteen defects, each with where it bit, the workaround it cost and a proposed fix, plus one more found while fixing them (the sensitive-path glob denied reading `tests/browser-secret.test.mjs`). None needs a new idea. Each is a rule that bit where it was not meant to, a counter that never reset, a reader that did not filter, or a message that named the wrong command. This change closes all fifteen.

## What Changes

- Guards: lanes apply to paths inside the project only (issue 2); a goal resting in `done` is dormant, with the default branch and the reviewed goal branch still protected (14); a test file named after what it tests is not a credential (15); the browser action counter resets when a review starts (5).
- Preflight and the packet: untracked binaries count as 0 lines (1); new files appear in the packet's diff as additions against /dev/null (9); the slice-paths failure names `harness slice amend` (3).
- Verdict tooling: the judge briefs spell out the finding shape and `verdict template` prints a `findingExample` (4); `verdict validate` defaults to the current verdict and names the files that made one stale (7, 8); the CLI and the hooks resolve to the project root, since `git diff HEAD`, `ls-files` and `ls-tree` all scope to the current directory and a reviewer that changed directory got a different hash (8).
- State machine: attempts count across `harness retry`, the cap counting from the retry, and the cap message names `retry` (10); the report and reconciliation read the active goal's verdicts only, the recorded attempt winning (12); `record` commits harness configuration apart from the slice (6).
- Human amendments: `harness slice amend` widens a pending slice's paths in the state and the plan (3); `harness decide` records a decision as a default scoped to a slice, listed in its packet and citable as `decision:D-n` (11).
- Reviewer brief and agent: the Chrome window's minimum width is documented, and a criterion that names a narrower viewport is marked unverified rather than inferred from a wide window (13).

## Hypothesis

Measured by `harness retro` on the next real-project run against the angar run's events: `guardDenials: down`, since the lane and sensitive denials on scratchpad files and test files are gone; `invalidVerdicts: down`, since the finding shape is spelled out and shown; `judgeStopsExtra: down`, since fewer judges are sent back for a shape fumble or a hash that differed by directory. Not expected to move: `slicesDone`. The replay tier cannot measure this change, because the angar run was not recorded under `docs/runs/`; each fix has a regression in `tests/field-issues.test.mjs` instead, named by issue.

## Out of scope

The three requested features listed in the same document: the open-items ledger, a quickfix mode, and the progress bar. A headless viewport audit shipped with the plugin, which would add a browser dependency to a plugin that has none; the reviewer brief documents the window limit, and a project that needs responsive checks adds its own audit to the profile's `checks`.

## Impact

- Specs: `guards`, `preflight`, `verdicts`, `state-machine` (modified and added requirements)
- Code: `scripts/lib/guards/path-guard.mjs`, `scripts/lib/guards/git-guard.mjs`, `scripts/lib/state.mjs`, `scripts/lib/git.mjs`, `scripts/lib/packet.mjs`, `scripts/lib/paths.mjs`, `scripts/lib/machine.mjs`, `scripts/lib/report.mjs`, `scripts/lib/reconcile.mjs`, `scripts/lib/verdict.mjs`, `scripts/lib/preflight.mjs`, `scripts/cli.mjs`, `schemas/state.schema.json`, `schemas/plan.schema.json`, `schemas/verdict.schema.json`, `briefs/critic.md`, `briefs/review.md`, `agents/critic.md`, `agents/reviewer.md`, `tests/field-issues.test.mjs`, `tests/judge-aids.test.mjs`
- Docs: `docs/rules.md`, `docs/field-issues.md`, `docs/architecture.md`, `README.md`, `skills/resume/SKILL.md`
