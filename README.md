# Handoff Harness

A Claude Code plugin that takes a handoff, anything from a full design package to one sentence like "implement the tag filter", and turns it into reviewed, committed code, one slice at a time. Scripts decide, models judge.

[![ci](https://github.com/Marron-uno/handoff-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/Marron-uno/handoff-harness/actions/workflows/ci.yml)

```
/plugin install handoff-harness --marketplace Marron-uno/handoff-harness
```

Then, in any git repository:

```
/handoff-harness:init
/handoff-harness:goal "build all of the handoff" --source docs/HANDOFF.md
```

The run prints a goal card and waits for you to approve it. After that it drives itself until the goal is met or a cap hands control back to you.

In this README, `harness` is short for `node <plugin-root>/scripts/cli.mjs`. The skills and the stage briefs always spell out the full path.

## The idea

Agent runs fail in the same few ways. The model declares itself done. A reviewer writes "LGTM" above a list of defects. A fix loop reverts its own work. A bulk `git add` sweeps real customer names into a commit. The spec drifts into another language. Nobody knows what the run cost.

Each of those has a deterministic answer, and this plugin is the collection of them. The model builds the code and judges it. Scripts decide which stage the run is in, whether a verdict counts, whether the goal is met, and when to stop. The rules came from running agents on real projects and keeping the failures; [docs/rules.md](docs/rules.md) lists every one with the failure that motivated it.

## What a run looks like

```
goal sentence
  intake       the model reads the handoff and writes an inventory, a plan of slices, a goal card
  goal card    you approve, or the goal was created with --auto-approve
  per slice
    build      the model edits code and runs the tests
    preflight  scripts check branch, diff size, paths, secrets, language, your project checks
    critic     a cheap judge writes a JSON verdict
    review     a second judge with a fresh context, Chrome for UI criteria
    record     one commit with the slice id, pushed to the goal branch
  reconcile    every inventory item is done, partial or missing; gaps become new slices
  report       cost per stage, verdicts, open holds, then the goal predicate
```

A slice is one unit of work with its own criteria and the files it may touch. A verdict is a JSON file a judge writes: pass or block, findings with a severity and an authority (the criterion, spec heading, rule or test it rests on), and evidence that exists on disk. A validator rejects a pass that carries a block finding, a verdict for a diff that changed after the judge looked, and evidence that points at a file that is not there. [docs/architecture.md](docs/architecture.md) has the full state machine.

## What it has done so far

Three recorded runs on the fixture, a small notes app with a deliberately incomplete handoff. Every artifact is in `docs/runs/`, including the verdicts and the screenshots.

| | [Run 1](docs/runs/2026-10-14-fixture-run-1/README.md) | [Run 2](docs/runs/2026-10-14-fixture-run-2/README.md) | [Run 3](docs/runs/2026-10-14-fixture-run-3/README.md) |
|---|---|---|---|
| What changed | baseline | spec stage on | Jev on, judge packet, verdict skeleton |
| Slices built | 3 of 3 | 4 of 4, one added by reconciliation | 2 of 3, one waiting on a human |
| Wall clock | 11.5 min | 11.5 min | 5.5 min |
| Cost by Claude Code | $1.24 | $1.74 | $0.88 |
| Stop-hook blocks | 24 | 0 | 0 |
| Invalid verdict writes | 0 | 5 of 14 | 2 of 7 |

Each run produced ranked findings, and most of them became fixes before the next run. One example of the loop working: run 2's reviewer passed the UI slice and still wrote this finding on it.

> The module-level store is an empty array with no write path, so the count is always 0 and the fetch-driven update is never exercised with N > 0.

Severity major, authority `criterion:C-7`, evidence `src/server.mjs` line 7, quote `const store = [];`. The reconciler read that finding, overrode the script's "done" on the item, and proposed a fourth slice that seeded the store. The reviewer then opened the page and verified "3 notes"; [the screenshot](docs/runs/2026-10-14-fixture-run-2/evidence/S-4/count-3.jpg) is in the run folder. And this is how run 3's report ends, both cost figures side by side:

```
Total from the price table: $0.774 (main session $0.541, subagents $0.233).
Reported by Claude Code: $0.884 over 1 headless session(s). This is the number of record; the table is an estimate.
```

## Four rules

1. **Scripts decide, models judge.** Stage transitions, goal completion, verdict validity, budgets and caps are computed from `state.json`, the events log and git. The model never declares a stage complete.
2. **Verdicts are JSON with authority and evidence.** A pass that carries a block finding, or evidence that does not exist on disk, is rejected before anyone reads it.
3. **Nothing irreversible, nothing hidden.** No history rewrites, no bulk staging, no pushes outside the goal branch, no edits on the default branch, no secrets written, no sensitive files read. The browser is read-only outside the fixture and preview hosts.
4. **Every run ends with a bill and a reason.** Token usage is attributed per stage from the transcript. Every block, guard denial and halt is an event with a code.

## Using it on your project

Install, run `/handoff-harness:init`, then fill in `.harness/profile.json`:

- `checks`: the test command, lint, typecheck. Preflight runs them before any model judges a slice. Without them the judges only have the diff.
- `devServer`: URL and start command, so the reviewer can open the page for UI criteria.
- `hosts`: preview and production hosts. Production browsing needs `--prod` on the goal and is always read-only.
- `lanes.protectedPaths` when the defaults (`openspec/specs`, `.claude`, `CLAUDE.md`, `AGENTS.md`) are not enough.

For the first goal, run it in a session rather than headless, approve the goal card by hand, and leave Jev off. That first run will show what the profile is missing, which is what it is for. The diff budget is 1,200 lines per slice, so plan small slices.

Goals are sentences. `--mode handoff`, the default, walks the sources you name into an inventory with stable ids. `--mode feature` lets intake propose the criteria from the sentence alone. Open questions become defaults (chosen, applied, logged) or holds. A hold blocks only the slices that need the answer, and once everything else is done the run waits for you: `harness hold answer --id H-1 --answer "..."` records the answer and builds the held slice.

Everything the harness writes lives in `.harness/`. The state and the events log are run artifacts and stay out of git. The profile, lessons, proposals and reports are committed.

## The guards

Hooks are the enforcement surface. Each is a Node script with no dependencies; input arrives on stdin and decisions leave as JSON.

Before a tool call: the git guard (no amend, rebase, force push or bulk add), a shell deny list, file lanes per stage and per judge, protected and sensitive paths, the browser lane, tool-call and browser-action budgets. After a write: an English-only check by function-word counts, a secret scan, a prose lint. A judge that stops without a valid verdict is sent back to write one. When the main session stops, the state machine decides whether it may. Session start and compaction inject only the brief for the current stage, never the whole protocol.

Caps that hand control to a human: three attempts per slice, three review rounds (raisable), seven Stop-hook blocks without progress (Claude Code cuts a session off at eight), the diff oscillating between two states, time and cost budgets, and an open hold once everything else is done.

## The review loop

Two judges per slice, both read-only subagents that write JSON. Preflight writes them a packet with the text of each criterion, the declared paths, the changed files and the diff, so the critic reads one file instead of exploring the tree. `harness verdict template` prints a skeleton with the right ids, round and work hash and one entry per criterion; it does not validate until the judge fills it in. The critic is cheap and runs first. The reviewer starts with a fresh context and reads the diff as a stranger. For UI criteria it opens its own browser tab, verifies, and cites screenshots.

A rejection sends the slice back to build with the findings quoted. After two rejections the strong model takes over for both judges. After the caps, a human decides: fix by hand, raise the cap, or skip the slice with a reason. Rounds past the cap have found real bugs before, so the cap asks a human instead of ending the run.

Verdicts carry a hash of the change set they judged. An edit after the judge looked makes the verdict stale, and the validator says so.

Default models: the critic on Haiku, the reviewer and the spec reviewer on Sonnet, the reconciler and both strong judges on Opus, set in `agents/*.md`. The main session runs whatever model your session runs.

## The spec stage

[OpenSpec](https://www.npmjs.com/package/@fission-ai/openspec) is the spec layer, in two tiers. Always on: `openspec/specs` is read-only to the run, and `openspec validate --all` runs in preflight when the folder exists. Opt-in with `--openspec` on the goal: intake writes an OpenSpec change (proposal, delta specs with SHALL requirements and WHEN/THEN scenarios, tasks) or adopts one with `--change <name>`, and cites the inventory ids in it. `harness spec check` is deterministic: delta format, `openspec validate --strict`, every in-scope criterion cited, every task citing an id, every task owned by exactly one slice. A spec reviewer then judges meaning before you see the goal card. Approval commits the change, `record` ticks the slice's tasks inside the slice commit, and the goal needs every task ticked. Archiving the change into the specs stays a human step.

## Cost

The Claude Code transcript carries token counts per message. The harness counts each message once (Claude Code writes one row per content block), buckets by the stage active at that moment, and prices from a table in the profile. Subagent usage is attributed when the judge stops, as the delta since its previous stop. The default table is the published price list with the one-hour cache tier; on the recorded runs it lands within 1 to 13 percent of Claude Code's own figure, which the headless driver stores per session and the report prints as the number of record. Budgets on the goal (`--budget-usd`, `--budget-minutes`, `--max-slices`) stop the run when exceeded.

## Jev, optional

[Jev](https://typesafe.ai) is a decision model that answers typed questions with calibrated probabilities and generates no text. With `--jev` on the goal and `jev.enabled` in the profile, it gates verdict plausibility, prefilters reconciliation and classifies trace events into lessons. It can send a verdict back to its judge or add a question; it never grants a pass. On run 3 it answered eleven questions for $0.00034 and changed nothing, since every decision was accept. Calibration needs more outcomes than three runs provide, so it is off by default. [docs/jev.md](docs/jev.md) has the Vercel AI Gateway setup and `harness jev ping`.

## Retro and evals

After a run rests, `/handoff-harness:retro` writes a proposal under `.harness/proposals/`: the run's metrics, the signals a script can see (held slices, rejected verdicts by pattern, denials with the denied command, judges that stopped twice, a critic that explored, Jev answers within reach of a threshold), and findings the model fills in with a cause by file, the smallest change, and a hypothesis as a metric and a direction. The retro never edits the harness; the proposal is the handoff to this repository, where the change goes through the harness's own `openspec/`.

Whether a change helped is measured in three tiers, written up in [docs/evals.md](docs/evals.md): replay evals in CI run the current code over the recorded runs and their rejected verdicts; a paid bench drives N headless runs per version and compares them metric by metric, marking each hypothesis supported, weak or not supported from the ranges; and a `claude plugin eval` case checks that the goal skill steers the model as intended. The honest summary is that the bench sees large effects on one fixture, the replay proves a fix addressed a recorded failure, and neither proves the harness is better in general.

## Headless runs

Claude Code stops a session after eight consecutive Stop-hook continuations. `node scripts/drive.mjs --cwd <project>` loops headless sessions until the run rests, records each session's cost, and refreshes the report with it. All three recorded runs used it.

## Tests

`npm test` runs 64 tests in a few seconds with no network and no key: the state machine end to end on the fixture with synthetic verdicts, every guard and cap, the parsers, the cost attribution, the spec stage, the hold path.

## Layout

```
.claude-plugin/   plugin.json, marketplace.json
hooks/hooks.json  event wiring
scripts/          cli.mjs, drive.mjs, status-line.mjs, hooks/, lib/ (machine, guards, jev, usage)
schemas/          state, verdict, plan, inventory, reconcile, event
profiles/         default.json, jev-questions.v1.json
briefs/           one markdown brief per stage
agents/           critic, critic-strong, reviewer, reviewer-strong, spec-reviewer, reconciler
skills/           goal, status, resume, init, jev, retro
fixture/          synthetic project with a handoff and an OpenSpec change
tests/            node:test, no network, no key
docs/             rules.md, jev.md, architecture.md, evals.md, runs/
openspec/         the harness's own specs and changes
evals/            plugin eval cases; bench results land here, ignored by git
```

## Status

Version 0.4.0. Built with Claude Code in small commits, with every run recorded and every finding either fixed or listed here. The harness now carries its own `openspec/` with baseline specs derived from the rule catalog, and the retro and evals work is its first change, `openspec/changes/add-retro-and-evals`, left for a human to archive. Open: a bench of the current version against the recorded runs, a recorded run of the authored-change path (a feature goal with no document), running the harness against its own repository (the path guard forbids it today), a stage-managed dev server, git-side hooks for commit messages, and the bundle-size check. Proposals go in `.harness/proposals/` of any project that runs it, or in issues here.

License: MIT.
