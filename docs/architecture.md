# Architecture

## One run, one state file

`.harness/state.json` is the single source of truth for a goal. It is written only by `scripts/cli.mjs` and by the hooks; the model never edits it. Its schema is `schemas/state.schema.json`, and every write validates against it. `.harness/events.jsonl` is the append-only log that every report, lesson and cost table is rendered from.

```
goal new ─▶ intake ─▶ awaiting_approval ─▶ planning ─▶ building ─▶ preflight ─▶ critic ─▶ review ─▶ record ─┐
                                                          ▲                                                  │
                                                          └──────────── next slice ◀─────────────────────────┤
                                                                                                             ▼
                                                   report ◀── reconcile (adds slices for missing items) ◀────┘
                                                     │
                                                     ▼
                                                   done
```

Resting stages, where the Stop hook lets the session end: `awaiting_approval`, `awaiting_human`, `budget_exceeded`, `halted`, `done`.

## One machine, two entry points

`scripts/lib/machine.mjs` reads the state, the profile and git, and returns allow or block. A block carries the next stage brief from `briefs/`, rendered with the slice variables. Each stage handler checks the evidence the previous step must have produced (a file, a commit, a verdict with the right work hash) and either advances or repeats the brief.

The machine runs from two places. CLI commands that produce evidence (`slice done`, `preflight`, `record`, `reconcile load`, `report`) and `harness next` after a verdict call it directly and print the next brief, so the model keeps working without a stop. The Stop hook calls the same function when the model stops instead, and is the enforcement of record: only its blocks count toward the runaway cap, and only it can let a session end. Recorded run 1 showed why both are needed: a stop-and-block cycle per stage cost 24 blocks for 17 transitions.

Guards run before dispatch: time and cost budgets, the runaway cap (blocks without a stage transition), and oscillation (the work hash alternates between two values).

Claude Code caps consecutive Stop-hook continuations at eight. The runaway cap sits at seven so the harness halts with a reason instead of being cut off. A judge running as a background subagent is not a stall: the hook lets the turn end while `background_tasks` are running in a judge stage and picks up the verdict on the next stop. `scripts/drive.mjs` restarts headless sessions for unattended runs, with `--chrome` for the reviewer's browser.

## Work hash

`workHash` is a hash of the committed tree minus `.harness/` plus the pending diff minus `.harness/`. Verdicts, preflight results and reconciliation results carry the work hash they judged. A result for a different hash is stale. Harness artifacts are excluded so writing a report cannot invalidate a verdict.

## Judges write verdicts

Agents in `agents/` are read-only by lane: the path guard allows them to write only under `.harness/verdicts/` and `.harness/evidence/`. A verdict follows `schemas/verdict.schema.json`. `scripts/lib/verdict.mjs` rejects a pass with a block finding or an unmet criterion, a wrong goal, slice or attempt, a stale hash, duplicate finding ids, and evidence paths that do not exist. SubagentStop refuses to let a judge finish without a valid verdict.

Verdict files are named `<slice>-a<attempt>-r<round>-<role>.json`, so every cycle has its own path and an old verdict never counts as stale by design.

## Routing

The critic runs on the cheap model first. After two rejections of the same slice (`slice.rejections`), the Stop hook names the strong variant in the brief. The same applies to the reviewer. Model names live in agent frontmatter; the profile's `models` table documents the mapping and sets the escalation threshold.

## Guards

`scripts/lib/guards/` holds pure functions with tests; `scripts/hooks/` wires them to events. `docs/rules.md` is the catalog. The language guard is a function-word count per paragraph with no model and no library; the secret scan is a conservative pattern list with an allow list of fixture values; the browser guard classifies hosts into fixture, preview, prod and unknown.

## Cost

`scripts/lib/usage.mjs` reads transcript JSONL, takes `message.usage` from assistant rows, and buckets them by the stage active at each timestamp using `stage` events. Prices come from `profile.pricing`. Subagent transcripts are summarized at SubagentStop into `usage` events and folded in. The Stop hook refreshes `.harness/usage.json` before deciding, so the cost budget is live.

## Jev

`scripts/lib/jev/` is optional and off by default. See `docs/jev.md`.

## Files a run produces

```
.harness/
  state.json           source of truth (ignored by git)
  events.jsonl         append-only log (ignored)
  profile.json         project settings (committed)
  inventory.json       items and criteria with stable ids
  plan.json            slices and open questions
  goal-card.md         what the human approved
  preflight.json       last preflight result
  verdicts/            one JSON per judge cycle, reconcile.json
  evidence/<slice>/    screenshots, gifs
  reconcile-input.json deterministic evidence per item, Jev buckets
  usage.json           cost per stage
  report.md            final report; copied to reports/<goal>.md (committed)
  lessons.md           cited lessons (committed)
  jev.jsonl            every Jev answer, for calibration
  proposals/           changes the run wants in the harness itself (committed)
```
