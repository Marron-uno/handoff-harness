# Preflight

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: The judges' packet

`harness preflight` SHALL write `.harness/packets/<slice>-a<attempt>.md` with the slice, the text of its criteria from the inventory, the declared paths, the defaults and human decisions that apply to the slice, the guard-bearing files and probe checklist when the slice is guard-bearing, the environment (OS, Node and git versions, and whether the filesystem folds letter case, probed by writing a file), the changed files with line counts, and the diff against HEAD capped at the diff budget with untracked files included as additions, so a slice that only adds files still shows its change. The critic and review briefs SHALL name it.

#### Scenario: New test file

- **WHEN** the slice adds an untracked test file
- **THEN** the packet's diff shows it as an addition against /dev/null

#### Scenario: Case-insensitive filesystem

- **WHEN** the packet is written on a filesystem where two spellings of a name open the same file
- **THEN** its environment section says so
