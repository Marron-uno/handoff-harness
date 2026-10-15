# Change: Adversarial review for guard-bearing slices

## Why

The review of the `field-issues` change (`.harness/proposals/2026-10-14-review-of-field-issues.md`) found one blocking and two major guard escapes that the author's own review and fourteen regression tests had missed, plus a regression test that passed with its fix reverted. The loop as it stood asked the reviewer to confirm criteria, accepted a guard claim on a file quote, never ran a new test against the old code, and told judges nothing about the machine. Each of those is a script's job.

## What Changes

- `review.guardPaths` in the profile names the files whose change widens or narrows enforcement; `harness init` seeds the harness's own for a checkout of the harness. Preflight marks a slice touching one as guard-bearing in the result and the event.
- A guard-bearing slice gets `briefs/review-adversarial.md`, whose first instruction is to get through, and the strong reviewer from round one; the critic brief carries a guard note; the packet carries a guard-bearing section with the files and the probe checklist.
- The validator rejects, on a guard-bearing slice, a met criterion or a block or major finding without evidence of type `command` or `test`.
- Preflight gains `tests_discriminate`: the slice's changed tests, copied into a detached worktree at the slice's start commit, must fail there; `review.discriminatingTests` and `review.testCheck` configure it.
- The packet gains an environment section: OS, Node, git, and whether the filesystem folds letter case, probed.
- The metrics gain `guardBearingSlices` and `discriminationFailures`. `openspec/config.yaml` gains the rule that guard-bearing changes land through a goal run.

## Hypothesis

`discriminationFailures` and `guardBearingSlices` are reported without a direction; the first counts tautological tests caught before a judge saw them. `invalidVerdicts: up` at first on guard-bearing slices, as verdicts resting on file quotes are rejected, then down as the briefs take hold. The metric that matters, defects of severity block or major found by an independent review after a slice passed, has no counter yet and is counted by hand per goal until a review step is recorded in the events log. The replay tier cannot measure this change; the regressions are in `tests/adversarial-review.test.mjs`.

## Out of scope

Treating a git worktree of the project as inside the project in the path guard. A browser-based probe for UI guards. Recording independent reviews as events.

## Impact

- Specs: `preflight` (added and modified requirements), `verdicts` (added), `state-machine` (added)
- Code: `scripts/lib/preflight.mjs`, `scripts/lib/packet.mjs`, `scripts/lib/environment.mjs`, `scripts/lib/machine.mjs`, `scripts/lib/verdict.mjs`, `scripts/lib/metrics.mjs`, `scripts/cli.mjs`, `profiles/default.json`, `schemas/state.schema.json`, `briefs/review-adversarial.md`, `briefs/critic.md`, `.harness/profile.json`, `tests/adversarial-review.test.mjs`
- Docs: `docs/rules.md`, `docs/architecture.md`, `README.md`, `openspec/config.yaml`
