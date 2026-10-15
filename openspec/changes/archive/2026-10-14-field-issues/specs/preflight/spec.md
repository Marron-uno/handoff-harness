# Preflight

## MODIFIED Requirements

### Requirement: Checks before any model judges

`harness preflight` SHALL run, in the preflight stage, the branch check, the diff budget with binary files counted as zero lines, slice paths, protected paths, the language, secret and prose scans, the test-weakening and dependency checks, `openspec validate --all` when `openspec/` exists, and every project check from the profile, and SHALL write `preflight.json` with one line per check and the work hash it judged. A slice-paths failure SHALL name `harness slice amend` as the way a human widens the slice.

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

`harness preflight` SHALL write `.harness/packets/<slice>-a<attempt>.md` with the slice, the text of its criteria from the inventory, the declared paths, the defaults and human decisions that apply to the slice, the changed files with line counts, and the diff against HEAD capped at the diff budget with untracked files included as additions, so a slice that only adds files still shows its change. The critic and review briefs SHALL name it.

#### Scenario: New test file

- **WHEN** the slice adds an untracked test file
- **THEN** the packet's diff shows it as an addition against /dev/null

#### Scenario: Decision for the slice

- **WHEN** a human recorded a decision with `harness decide --slice S-n`
- **THEN** the packet for S-n lists it under defaults and decisions with its id
