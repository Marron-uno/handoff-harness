# Evals: does a change to the harness make it better?

A retro produces a proposal with a hypothesis per finding, written as a metric and a direction. Evals are how the hypothesis gets checked. There are three tiers because there are three different questions, and none of them answers the other two.

## The metrics

`scripts/lib/metrics.mjs` turns a run into one flat set of numbers: final stage, slices done and held, minutes, Claude Code's reported cost and the price-table figure with their ratio, Stop-hook blocks, guard denials, halts, verdict writes and how many the validator rejected (grouped by the error pattern), judges that stopped more than once, the critic's and the reviewer's tool calls per slice, screenshots, reconciliation passes and added slices, spec attempts and findings, Jev answers, routes and cost. It reads a project's `.harness/` or a recorded snapshot; `harness analyze`, `harness retro`, the replay evals and the bench all use it, so a number means the same thing everywhere.

`METRIC_DIRECTIONS` in the same file says which way is better for each metric. Some have no direction (the number of screenshots, the slices reconciliation added); those are reported, never judged.

## Tier 1: replay, free, in CI

`tests/replay.test.mjs` runs the current code over every recorded run in `docs/runs/` that has an `expect.json`. It checks the metrics the expectation names, the held slices the goal predicate reports for the recorded state, that every recorded valid verdict still passes the schema, and that every file under `verdicts/rejected/` still fails it.

This tier answers one question: would the code as it is now have prevented the recorded failure, and does it still accept what was right. Run 3 is the example. Its state ended `done` with S-3 pending behind a hold; the expectation says the predicate must report S-3 as held pending, which is what the fix rests on. If someone loosens that rule, this test fails against real artifacts, not a synthetic case.

The cost is zero and it runs on every push. The limit is that it only knows about failures that have already happened and were recorded. Every retro finding that becomes a fix should add a line to an `expect.json`, and every rejected verdict a run keeps becomes a fixture for the validator.

## Tier 2: the bench, paid, manual

```
node scripts/eval/bench.mjs --label v0.3.3 --runs 3 --chrome
node scripts/eval/bench.mjs --label v0.4.0 --runs 3 --chrome
node scripts/eval/compare.mjs evals/bench/v0.3.3 evals/bench/v0.4.0 --proposal .harness/proposals/2026-10-14-G-1-retro.md
```

The bench drives N fresh headless runs of the fixture goal (same sentence, same adopted change, auto-approved, same budgets), snapshots each with its metrics, and writes `summary.json`. The comparison prints every metric as min..max with the mean for both arms and a verdict: supported when the candidate moved the hypothesized way and the ranges do not overlap, weak when it moved but the ranges overlap, not supported otherwise. With `--proposal` it checks each `Hypothesis:` line in a retro proposal the same way.

What it costs: a run is five to twelve minutes and one to two dollars with Sonnet as the main model, so three runs per arm is about five dollars and half an hour per arm. `--jev` adds a few tenths of a cent. Keys come from the environment; the bench refuses to start while the marketplace copy of the plugin is enabled, because hooks would run twice.

What it can tell you: large effects. Run 1 to run 2 went from 24 blocks to 0 and run 2 to run 3 from 17 to 27 critic tool calls to 4 and 10; three runs per arm see that. It cannot see a 10 percent change in cost, because model runs vary more than that on their own. The ranges are the honesty: when they overlap, the verdict is weak, and the right move is more runs or a bigger change, not a claim.

What it cannot tell you: anything about workloads other than the fixture. The fixture is a five-item handoff on a small notes app. A change that helps there may not help on a real repository, which is why the retro from real projects feeds the next round.

## Tier 3: skill evals with Claude Code's runner

`evals/goal-intake/` is a case for `claude plugin eval`: a prompt that asks for the goal skill on a scaffolded copy of the fixture, and graders that check the skill fired (`tool_used: Skill`), the inventory and plan were written (`file_exists`), and the goal card has the sentence, the slices, a default and a hold, with the run left waiting for approval (an LLM grader). Each run is a full headless session, so it costs about what one intake costs.

```
claude plugin eval . --case goal-intake --scaffold --allow-tools Bash Write Edit Read Glob Grep Skill --trust-plugin --no-publish
```

This tier answers a question the other two cannot: does the skill text steer the model the way it is meant to, independent of the machine. A change to `skills/goal/SKILL.md` or to an intake brief is tested here, and the runner's ablation arm (the same prompt without the plugin) shows what the plugin adds. It says nothing about guards or judges; those are deterministic and belong in `npm test`.

## The loop

1. A run on a real project rests. `/handoff-harness:retro` writes `.harness/proposals/<date>-<goal>-retro.md`: metrics, signals, findings with a cause by file, a change, and a hypothesis.
2. The proposal goes to the harness repository as the source of an OpenSpec change under `openspec/changes/`; the proposal's own `rules` in `openspec/config.yaml` ask for the run that motivates it and the hypothesis as a metric and a direction.
3. The change is built. Every fix adds a replay expectation (tier 1) so the recorded failure stays caught.
4. If the hypothesis is about run behaviour, a bench arm with the new version is compared to the last recorded arm (tier 2). If it is about a skill, the plugin eval case runs (tier 3).
5. The numbers go in the change's proposal before it is archived. A hypothesis that came back weak or not supported is written down as such; the change can still ship if it fixes a recorded failure, because tier 1 is the stronger evidence for that.

What this loop does not do yet: run the harness against its own repository. The path guard denies every write under the plugin root, which in this repository is every file. Lifting that for the harness repo only is a change that should itself go through the spec stage, with the first run of the harness on itself as its bench.
