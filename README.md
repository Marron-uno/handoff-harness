# Handoff Harness

A Claude Code plugin that turns a handoff into reviewed, committed code through fixed stages, under deterministic guards. A handoff can be a design package, a prose spec, or a sentence like "implement the tag filter". The model builds and judges; scripts decide.

[![ci](https://github.com/Marron-uno/handoff-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/Marron-uno/handoff-harness/actions/workflows/ci.yml)

```
/plugin install handoff-harness --marketplace Marron-uno/handoff-harness
```

Then, in any git repository:

```
/handoff-harness:init
/handoff-harness:goal "build all of the handoff" --source docs/HANDOFF.md
```

The run prints a goal card and waits. `harness goal approve` starts it. Throughout this README, `harness` stands for `node <plugin-root>/scripts/cli.mjs`; the skills and stage briefs always spell out the full path. Commands that produce evidence (`slice done`, `preflight`, `record`, `reconcile load`, `report`, and `next` after a verdict) advance the run and print the next brief; the Stop hook enforces the same machine when the model stops instead. From there the Stop hook drives every stage until the goal predicate is satisfied or a cap hands control back to you.

## Why this exists

Agent runs fail in the same few ways: the model declares itself done, a reviewer says "LGTM" above a list of defects, a fix loop reverts its own work, a bulk `git add` sweeps real customer names into a commit, specs drift into another language, and nobody knows what the run cost. Every one of those has a deterministic answer. This plugin is the collection of those answers, built from running agents on real projects and keeping the failures.

## Micro-constitution

Four rules that everything else serves.

1. **Scripts decide, models judge.** Stage transitions, goal completion, verdict validity, budgets and caps are computed from `state.json`, the events log and git. The model never declares a stage complete.
2. **Verdicts are JSON with authority and evidence.** A critic or reviewer writes a verdict file with findings that cite a criterion, spec heading, rule or test, and evidence that exists on disk. A pass that carries a block finding is rejected by a validator.
3. **Nothing irreversible, nothing hidden.** No history rewrites, no bulk staging, no pushes outside the goal branch, no edits on the default branch, no secrets written, no sensitive files read, a read-only browser outside the fixture.
4. **Every run ends with a bill and a reason.** Token usage is attributed per stage from the transcript; every block, guard denial and halt is an event with a code.

## Agent guide

The run is a state machine. Each stage has a brief the Stop hook injects when the previous stage is verified complete.

| Stage | Who | Output verified by script |
|---|---|---|
| intake | main session | `inventory.json`, `plan.json`, `goal-card.md` valid against schemas |
| awaiting_approval | human | `harness goal approve` |
| building | main session | `harness slice done` after tests pass locally |
| preflight | script | branch, diff budget, slice paths, protected paths, language, secrets, prose, test weakening, dependencies, OpenSpec validate, project checks |
| critic | `critic` subagent (haiku), `critic-strong` after two rejections | valid verdict file with the current work hash |
| review | `reviewer` subagent (sonnet, fresh context, Chrome for UI criteria), `reviewer-strong` after two rejections | valid verdict file |
| record | script | commit with the slice id, pushed to the goal branch |
| reconcile | script + `reconciler` subagent (opus) | every inventory item done, partial or missing, with new slices for the gaps |
| report | script | `report.md` from events, verdicts, reconciliation and usage; then the goal predicate |

Caps that hand control to a human: attempts per slice (3), review rounds (3, raisable with `harness authorize-rounds N`), consecutive Stop-hook blocks without progress (7, under Claude Code's limit of 8 continuations), oscillation of the work hash, time and cost budgets.

Goals are sentences. `harness goal new --sentence "..."` with `--mode handoff` (default) walks named sources into an inventory with stable ids; `--mode feature` lets intake propose the criteria. Open questions split into pre-approved defaults, applied and logged, and holds that block only the slices that need them.

Everything the harness writes lives in `.harness/`. `state.json` and `events.jsonl` are run artifacts and stay out of git; `profile.json`, `lessons.md`, `proposals/` and `reports/` are committed.

## Mechanical feedback

Hooks are the enforcement surface. Each is a Node script with no dependencies; all input arrives on stdin and all decisions leave as JSON.

- **PreToolUse**: git guard, shell deny list, file lanes per stage and per judge, protected and sensitive paths, browser lane with prod opt-in and typed-secret scan, tool-call and browser-action budgets.
- **PostToolUse**: English-only check by function-word counts, secret scan, prose lint on the file just written. The reason goes back to the model as feedback.
- **SubagentStop**: a judge cannot finish without a valid verdict; its transcript usage is attributed to the stage; the optional Jev gate runs.
- **Stop**: the state machine. Allows the session to end only in a resting stage.
- **SessionStart** and **PreCompact**: inject only the current brief, never the whole protocol; log the compaction.

Preflight runs before any model judges a slice: `harness preflight` writes `preflight.json` with one line per check and the work hash it judged. `docs/rules.md` lists every rule with where it is enforced and the failure that motivated it.

OpenSpec is the spec layer. `openspec/specs` is read-only to the run; the pipeline owns its change folder; `openspec validate --all` is a preflight check when the folder exists. The CLI is pinned as a dev dependency.

## Review loop

Two judges per slice, both read-only subagents that write JSON. The critic is cheap and runs first; the reviewer starts with a fresh context and reads the diff as a stranger. For UI criteria the reviewer opens its own browser tab on the fixture host, verifies, and cites screenshots as evidence; outside fixture and preview hosts the browser is read-only, and production needs `--prod` on the goal.

A rejection sends the slice back to build with the findings quoted. After two rejections the strong model takes over. After the caps, a human decides: fix by hand, raise the cap, or skip the slice with a reason. Rounds beyond the cap have found real bugs before, which is why the cap is a gate and not a wall.

Verdicts carry the work hash of the change set they judged. An edit after the judge looked makes the verdict stale, and the validator says so.

## Cost and evaluation

Every assistant message in the transcript carries token counts. The Stop hook buckets them by the stage active at that moment and prices them from a table in the profile; subagent transcripts are attributed to their stage at SubagentStop. The report ends with a table of calls, tokens and dollars per stage. The price table is a profile value and the default is approximate; set `pricing.perMillion` to your contract. Budgets in the goal (`--budget-usd`, `--budget-minutes`, `--max-slices`) stop the run when exceeded.

The harness is tested on a synthetic fixture (`fixture/`, a deliberately incomplete notes library with its own handoff and OpenSpec change). The end-to-end test drives a two-slice goal through every stage with synthetic verdicts, and the guard tests exercise every cap. `npm test` runs them in a few seconds with no API key.

## Optional: the Jev layer

[Jev](https://typesafe.ai) is a decision model that answers typed questions with calibrated probabilities and generates no text. Enabled per goal with `--jev` and `jev.enabled` in the profile, it gates verdict plausibility, prefilters reconciliation and classifies trace events into lessons. It routes, blocks, or adds a question; it never grants a pass. Every answer is logged and `harness jev calibrate` prints observed rates against predicted probabilities. See `docs/jev.md`.

## Headless runs

Claude Code stops a session after eight consecutive Stop-hook continuations. `node scripts/drive.mjs --cwd <project>` loops headless sessions until the run rests, which is the path for unattended goals. Each spawned session runs with the advisor model off.

## Layout

```
.claude-plugin/   plugin.json, marketplace.json
hooks/hooks.json  event wiring
scripts/          cli.mjs, drive.mjs, status-line.mjs, hooks/, lib/ (machine, guards, jev, usage)
schemas/          state, verdict, plan, inventory, reconcile, event
profiles/         default.json, jev-questions.v1.json
briefs/           one markdown brief per stage
agents/           critic, critic-strong, reviewer, reviewer-strong, spec-reviewer, reconciler
skills/           goal, status, resume, init, jev
fixture/          synthetic project with a handoff and an OpenSpec change
tests/            node:test, no network, no key
docs/             rules.md, jev.md, architecture.md
```

## Status

Version 0.1.0. The state machine, guards, judges, Jev layer and fixture are built and tested. The plugin installs through the marketplace path above.

**Recorded runs** live in `docs/runs/`. [Run 1](docs/runs/2026-10-14-fixture-run-1/README.md) drove the fixture end to end, headless, with real judges and the reviewer on Chrome: three slices, six passing verdicts, one screenshot as evidence, $1.24 by Claude Code's accounting, 11.5 minutes including a 3-minute halt caused by a harness bug. The run produced nine ranked findings; six are fixed (the Stop hook now yields to background subagents, CLI commands advance the machine and print the next brief so stages no longer cost a stop-and-block cycle, the sensitive-path guard only tests path-like tokens, evidence needs a real location, subagent usage lands in its spawning stage, the critic brief lists the changed files). Three are open: a stage-managed dev server, calibrating the default price table, and re-measuring the critic's tool-call count. Not yet done: a stage step that starts the project's dev server before the reviewer opens it (today the reviewer starts it from the brief's command), git-side hooks for commit messages, the bundle-size budget check, and a run with Jev enabled. Proposals go in `.harness/proposals/` of any project that runs it, or in issues here.

License: MIT.
