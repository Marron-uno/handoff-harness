# Goal card: G-1

**Goal:** "add a bundle size preflight check: budgets.bundleBytes in the profile maps file paths to a byte cap, preflight fails when a file is over its cap, with a test and a rules.md row"

**Sources:** none; the goal sentence is the source
**Change:** `openspec/changes/g-1-add-a-bundle-size-preflight-check-budgets-bundle/` (proposal, `specs/preflight/spec.md` with 2 added requirements and 6 scenarios, `tasks.md` with 4 tasks)

## Scope
- 4 inventory items (I-1 to I-4), 6 criteria (C-1 to C-6), no UI

## Slices
- **S-1** Bundle size budget: profile key, preflight check, test, rules row. Criteria C-1..C-6. Tasks 1.1, 1.2, 1.3, 1.4. Paths: `profiles/default.json`, `scripts/lib/preflight.mjs`, `tests/bundle-size.test.mjs`, `docs/rules.md`

## Estimate
About 1 USD and 10 minutes, one slice (goal budget: 6 USD, 40 minutes).

## Defaults applied
- D-1: keys are exact project-relative paths, not globs
- D-2: a named file that does not exist is skipped and listed
- D-3: size is raw bytes on disk, not gzipped

## Holds
None.
