# Preflight

## Purpose

Deterministic checks between build and the judges, and the packet the judges read. Enforced by `scripts/lib/preflight.mjs` and `scripts/lib/packet.mjs` through `harness preflight`.

## Requirements

### Requirement: Checks before any model judges

`harness preflight` SHALL run, in the preflight stage, the branch check, the diff budget with binaries counted as zero lines, slice paths, protected paths, the language, secret and prose scans, the test-weakening and dependency checks, `openspec validate --all` when `openspec/` exists, and every project check from the profile, and SHALL write `preflight.json` with one line per check and the work hash it judged. A slice-paths failure SHALL name `harness slice amend`.

#### Scenario: Diff over budget

- **WHEN** the slice changes more lines than `budgets.diffLinesPerSlice`
- **THEN** preflight fails with the count and the cap, and the build brief is repeated

#### Scenario: Stale preflight

- **WHEN** the work hash changes after preflight ran
- **THEN** the machine repeats the preflight brief

#### Scenario: Slice adds images

- **WHEN** the slice adds untracked binary files
- **THEN** they count as 0 lines in the diff budget and the packet names them as binary

### Requirement: The judges' packet

`harness preflight` SHALL write `.harness/packets/<slice>-a<attempt>.md` with the slice, its criteria text from the inventory, the declared paths, the defaults and decisions that apply, the guard-bearing files and probe checklist when the slice is guard-bearing, the environment facts (OS, Node, git, filesystem case folding), the changed files with counts, and the diff against HEAD capped at the diff budget with untracked files as additions. The critic and review briefs SHALL name it.

#### Scenario: New test file

- **WHEN** the slice adds an untracked test file
- **THEN** the packet's diff shows it as an addition against /dev/null

#### Scenario: Decision for the slice

- **WHEN** a human recorded a decision with `harness decide --slice S-n`
- **THEN** the packet for S-n lists it under defaults and decisions with its id

#### Scenario: Case-insensitive filesystem

- **WHEN** the packet is written on a filesystem where two spellings of a name open the same file
- **THEN** its environment section says so

### Requirement: Bundle size budget

Preflight SHALL run a `bundle_size` check that compares the size in bytes of each file named in `budgets.bundleBytes` to its cap, SHALL fail when any file is over its cap with details naming the file, its size and its cap, and SHALL skip when the map is empty or a named file does not exist (C-1, C-2, C-3, C-4).

#### Scenario: File over its cap

- **WHEN** `budgets.bundleBytes` maps `dist/app.js` to 1000 and the file is 1001 bytes
- **THEN** the `bundle_size` check fails and its details name `dist/app.js`, 1001 and 1000 (C-2)

#### Scenario: File at its cap

- **WHEN** every file named in `budgets.bundleBytes` is at or under its cap
- **THEN** the `bundle_size` check passes (C-3)

#### Scenario: No budget set

- **WHEN** `budgets.bundleBytes` is empty or absent
- **THEN** the `bundle_size` check is skipped (C-1, C-3)

#### Scenario: Named file missing

- **WHEN** a file named in `budgets.bundleBytes` does not exist
- **THEN** the check does not fail for that file and its details list it as missing (C-4)

### Requirement: Bundle size rule is documented and tested

The repository SHALL list the bundle size budget in `docs/rules.md` and SHALL cover the check with a test under `tests/` (C-5, C-6).

#### Scenario: Rules row present

- **WHEN** `docs/rules.md` is read
- **THEN** it holds a row naming the bundle size budget and the preflight stage (C-6)

#### Scenario: Test covers the cases

- **WHEN** `npm test` runs
- **THEN** the bundle size test exercises the over-cap, at-cap, empty-map and missing-file cases (C-5)

### Requirement: Changed tests fail without the change

`harness preflight` SHALL run the slice's changed test files against a detached worktree at the slice's start commit, with the project's `node_modules` linked and the project check named by `review.testCheck`, and SHALL fail the slice when the tests pass there, naming the files. It SHALL skip when no test file changed, when only test files changed, when no such project check exists, when the test command does not finish, or when `review.discriminatingTests` is false.

#### Scenario: Tautological test

- **WHEN** a slice changes source and adds a test that passes on the old code
- **THEN** preflight fails with the test file named and the slice goes back to build

#### Scenario: Test that needs the change

- **WHEN** the slice's test imports a module the slice adds
- **THEN** the check passes, since the test fails on the old tree

### Requirement: Guard-bearing slices are marked

`harness preflight` SHALL mark a slice guard-bearing when a changed file matches a glob in `review.guardPaths`, SHALL record the matching files in the preflight result and the preflight event, and the packet SHALL carry a guard-bearing section with those files and the probe checklist.

#### Scenario: Guard file touched

- **WHEN** a slice changes a file that matches `review.guardPaths`
- **THEN** the preflight result has `guardBearing` true with the file listed, and the packet has a guard-bearing section
