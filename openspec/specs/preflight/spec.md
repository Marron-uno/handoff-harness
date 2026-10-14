# Preflight

## Purpose

Deterministic checks between build and the judges, and the packet the judges read. Enforced by `scripts/lib/preflight.mjs` and `scripts/lib/packet.mjs` through `harness preflight`.

## Requirements

### Requirement: Checks before any model judges

`harness preflight` SHALL run, in the preflight stage, the branch check, the diff budget, slice paths, protected paths, the language, secret and prose scans, the test-weakening and dependency checks, `openspec validate --all` when `openspec/` exists, and every project check from the profile, and SHALL write `preflight.json` with one line per check and the work hash it judged.

#### Scenario: Diff over budget

- **WHEN** the slice changes more lines than `budgets.diffLinesPerSlice`
- **THEN** preflight fails with the count and the cap, and the build brief is repeated

#### Scenario: Stale preflight

- **WHEN** the work hash changes after preflight ran
- **THEN** the machine repeats the preflight brief

### Requirement: The judges' packet

`harness preflight` SHALL write `.harness/packets/<slice>-a<attempt>.md` with the slice, the text of its criteria from the inventory, the declared paths, the changed files with line counts, the diff against HEAD capped at the diff budget, and the content of new files the diff omits. The critic and review briefs SHALL name it.

#### Scenario: New test file

- **WHEN** the slice adds an untracked test file
- **THEN** the packet shows the file in full under "New files"
