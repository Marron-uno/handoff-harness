# Preflight

## ADDED Requirements

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
