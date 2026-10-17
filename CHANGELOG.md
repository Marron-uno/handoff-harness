# Changelog

All notable changes to handoff-harness are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and stay below 1.0 while the rules are still moving.

Versions before 0.5.2 were never tagged. Each entry covers the work closed by the commit that set its version in `package.json`, its date is that commit's, and its link compares it with the version before. The plugin installs from `main` through the marketplace, so a version is released when its bump lands there. 0.5.2 is the first tagged version; its entry runs up to the tag.

## [Unreleased]

## [0.5.2] - 2026-10-16

### Added

- `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, issue and pull request templates, Dependabot for npm and GitHub Actions.
- A release workflow: a `v*` tag runs the check and the tests, then publishes a GitHub Release with the matching section of this file.
- `docs/demo/`: a vhs tape and the GIF it records, the CLI on a copy of the fixture replaying run 2's intake files.
- Self-run 3 recorded under `docs/runs/2026-10-16-self-run-3/` with its retro proposal, and the G-2 and G-3 reports; the G-3 change archived into the guards spec.

### Changed

- README: the badges, the recording, the run table and the install block sit above the fold; the version lives in Releases, not in the README; one sentence links the two self-runs.
- `engines.node` is `>=22`, tested in CI on Node 22 and 24. Node 20's test runner does not expand the glob in `npm test`.
- `plugin.json` author link points at marron.uno.
- The OpenSpec change `g3-retro-hand-fixes` archived into the state-machine and cost specs.

### Fixed

Retro findings R-2, R-4 and R-5 of self-run 3, closed by hand (pull request 11):

- `goal new` moves the previous goal's events log, usage summary and intake artifacts under `.harness/runs/<goal id>/` and numbers the new goal past every id it knows, so a new goal never inherits a stale cost halt.
- Usage attribution stops at the goal's done event, and subagent rows carry the time of their event.
- `slice skip` clears the halt when it moves the run to record, and the record stage with no active slice renders a brief that names `harness next` instead of a `record` that fails.
- One rule (`scripts/lib/criteria.mjs`) decides which verdicts count toward a criterion: active goal, unskipped slice, recorded attempt. The report and the reconcile input share it, and a skipped slice's criteria print as skipped.

## [0.5.1] - 2026-10-16

### Changed

- The Bash guard judges command lines, not prose: the body of a heredoc that `cat` or `tee` only writes to a file is left out of the text before the deny patterns, the push rule and the sensitive-path scan run, under the fail-safe shape described in `docs/rules.md`; a heredoc fed to a shell or an interpreter is still scanned. Built as goal G-3 on the harness's own checkout (self-run 3, pull request 7); the one-line push match was cut by a human decision after three adversarial rounds, and `docs/field-issues.md` records why.

### Added

- The first five OpenSpec changes archived into `openspec/specs/`.

## [0.5.0] - 2026-10-14

### Added

- Adversarial review for guard-bearing slices: `review.guardPaths` in the profile, the strong reviewer and the adversarial brief from round one, command or test evidence required for every met criterion and every block or major finding.
- Preflight runs the slice's changed tests against the tree before the slice and fails when they pass there (`tests_discriminate`).
- The judge packet carries the environment: OS, Node, git, and whether the filesystem folds letter case.
- Self-run: a checkout of the harness is a project like any other when a frozen installed copy enforces the run (`scripts/drive.mjs --plugin-root`).
- Bundle size budget in preflight (`budgets.bundleBytes`), built by the harness on its own checkout as goal G-1 (self-run 1, pull request 1).

### Fixed

- The fifteen field issues from the first real-project run, listed in `docs/field-issues.md`: binary files count as 0 diff lines, lanes stop at the project root, a done goal is dormant, the browser action counter resets per review, `harness decide` and `harness slice amend` for human decisions after approval, harness configuration committed apart from the slice, and the rest.
- Follow-ups from an independent review of those fixes: paths compared after case folding, Claude's configuration protected outside the project, bulk pushes denied, the project-root walk stops at the git top level, a push of `HEAD` is the current branch.

## [0.4.0] - 2026-10-14

### Added

- Run metrics (`scripts/lib/metrics.mjs`), `harness retro` and the retro skill; rejected verdicts kept as replay fixtures.
- Evals in three tiers (`docs/evals.md`): replay over the recorded runs, a paid bench with compare, a plugin eval case.
- The harness's own OpenSpec specs and changes under `openspec/`, validated by `npm run check`.
- README rewritten for readers.

## [0.3.3] - 2026-10-14

### Added

- Recorded run 3: the fixture with Jev through the Vercel AI Gateway.

### Fixed

- A held slice rests the run in `awaiting_human`; `hold answer` resumes it; the driver refreshes the report.

## [0.3.2] - 2026-10-14

### Added

- `harness jev ping`, the gateway's billed cost kept with every answer, and the Vercel AI Gateway setup in `docs/jev.md`.

## [0.3.1] - 2026-10-14

### Added

- Recorded run 2: the fixture with the spec stage on.
- `harness verdict template` and the judge packet written by preflight.
- The driver records Claude Code's session cost as the number of record; the report prints both figures.

### Fixed

- Usage counted once per message id and subagent usage once per stop; the price table carries cache and context tiers.
- The state guard denies only writes to state files; reconciliation slices land in `plan.json`.

## [0.3.0] - 2026-10-14

### Added

- The spec stage: the harness builds from an OpenSpec change (`--openspec`, `--change`), with `harness spec check` and the spec reviewer; `record` ticks tasks.
- `harness next` as the second entry point to the state machine beside the Stop hook.

## [0.2.0] - 2026-10-13

### Added

- Core library and contracts, the stop-hook state machine, the CLI, the stage briefs, the fixture and an end-to-end test.
- Deterministic guards, hooks, usage attribution, agent definitions.
- The Jev decision layer, the skills, the headless driver, a status line, `docs/rules.md` and `docs/jev.md`.
- OpenSpec in the fixture, `docs/architecture.md`, `harness analyze` and `harness snapshot`.
- Dev server URL and start command in the profile; driver flags for allowed tools, Chrome and a log.
- Recorded run 1 and the fixes it produced.

### Fixed

- The Stop hook yields to running background subagents; `retry` can resume at a stage.
- Reconciliation gaps must become slices or explicit decisions; an unsatisfied goal predicate at report rests for a human.
- Harness artifacts never change the work hash; the report stage commits its output.

## [0.1.0] - 2026-10-13

### Added

- Plugin shell, manifest, hooks wiring, CI, and the marketplace install line.

[Unreleased]: https://github.com/Marron-uno/handoff-harness/compare/v0.5.2...HEAD
[0.5.2]: https://github.com/Marron-uno/handoff-harness/compare/79fe290...v0.5.2
[0.5.1]: https://github.com/Marron-uno/handoff-harness/compare/1ae1312...79fe290
[0.5.0]: https://github.com/Marron-uno/handoff-harness/compare/1bf46eb...1ae1312
[0.4.0]: https://github.com/Marron-uno/handoff-harness/compare/7665860...1bf46eb
[0.3.3]: https://github.com/Marron-uno/handoff-harness/compare/30ca77d...7665860
[0.3.2]: https://github.com/Marron-uno/handoff-harness/compare/712c1ef...30ca77d
[0.3.1]: https://github.com/Marron-uno/handoff-harness/compare/ee20275...712c1ef
[0.3.0]: https://github.com/Marron-uno/handoff-harness/compare/87935a4...ee20275
[0.2.0]: https://github.com/Marron-uno/handoff-harness/compare/48e149b...87935a4
[0.1.0]: https://github.com/Marron-uno/handoff-harness/tree/48e149b
