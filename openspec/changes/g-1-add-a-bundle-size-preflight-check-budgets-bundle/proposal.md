# Change: Bundle size preflight check

## Why

Preflight bounds the diff in lines but not the size of what a slice ships, so a slice can pass every check and still push a built file past the size a project allows. A per-file byte cap in the profile lets a project state that limit and have a script enforce it. This is a small feature goal (G-1) used to exercise the authored-change path; no recorded run or retro proposal motivates it beyond the goal sentence.

## What Changes

- The profile gains `budgets.bundleBytes`, a map from project-relative file path to a byte cap. The default is an empty map.
- Preflight gains a `bundle_size` check that compares each named file's size on disk to its cap and fails when one is over.
- `docs/rules.md` gains a row for the rule.
- A test covers the check.

## Hypothesis

`blocks: down` is not expected to move on this repository; the check only reports when a project sets a cap. Measured by the unit test, not by an eval tier.

## Impact

- Specs: `preflight` (added requirement)
- Code: `scripts/lib/preflight.mjs`, `profiles/default.json`, `docs/rules.md`, `tests/bundle-size.test.mjs`
