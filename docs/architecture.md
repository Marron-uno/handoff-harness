# Architecture

## One run, one state file

`.harness/state.json` is the single source of truth for a goal. It is written only by `scripts/cli.mjs` and by the hooks; the model never edits it. Its schema is `schemas/state.schema.json`, and every write validates against it. `.harness/events.jsonl` is the append-only log that every report, lesson and cost table is rendered from.

```
goal new ─▶ intake ─▶ [spec_review] ─▶ awaiting_approval ─▶ planning ─▶ building ─▶ preflight ─▶ critic ─▶ review ─▶ record ─┐
              ▲             │                                                 ▲                                                  │
              └── block ────┘                                                 └──────────── next slice ◀─────────────────────────┤
                                                                                                                                ▼
                                                                      report ◀── reconcile (adds slices for missing items) ◀────┘
                                                                        │
                                                                        ▼
                                                                      done
```

`spec_review` exists only when the spec stage is on (`openspec.author` in the profile or `--openspec` on the goal). Resting stages, where the Stop hook lets the session end: `awaiting_approval`, `awaiting_human`, `budget_exceeded`, `halted`, `done`.

## Spec stage

With the spec stage on, the goal builds from an OpenSpec change under `openspec/changes/<change>/`, named after the goal or adopted with `--change`. The inventory stays the authority for ids: intake writes it from the sources as always, then writes or amends the change so that it cites those ids. `scripts/lib/openspec.mjs` holds the deterministic side: a parser for delta specs (`## ADDED Requirements`, `### Requirement:`, `#### Scenario:` with WHEN and THEN) and for `tasks.md`, the pinned validator run as `openspec validate <change> --strict --json`, and the coverage check: every in-scope criterion id appears in the change, every task cites an id, every task is owned by exactly one slice of the plan. `harness spec check` prints the result; the intake handler runs the same check, so the stage cannot end on an unchecked change.

The `spec-reviewer` judges what the script cannot: whether each item's behavior is really specified, whether requirements are testable, whether anything is invented, whether open questions became defaults or holds. Its verdict uses the same schema as the other judges, with `slice` null, `attempt` equal to `state.spec.attempt`, and empty `criteria`; the file is `verdicts/spec-a<n>-spec-reviewer.json`. A block sends the run back to intake with the findings; after `caps.maxAttempts` blocks the spec is a human's problem.

Approval (`goal approve` or `--auto-approve`) commits the change folder as `spec: <change> (<goal>)`, so the first slice starts from a clean tree and preflight's slice-paths check never sees spec files as stray edits. `record` ticks the slice's tasks in `tasks.md` after the judges and before the commit, so the tick lands in the slice commit and never in a reviewed diff. The goal predicate requires every task ticked, except tasks owned by a slice a human skipped or held. Archiving (`openspec archive <change> --yes`) merges the delta into `openspec/specs`, which is protected during a run; it is a human step, printed in the report.

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

`scripts/lib/usage.mjs` reads transcript JSONL, takes `message.usage` from assistant rows, counts each `message.id` once (Claude Code writes one row per content block with the same usage), and buckets the rows by the stage active at each timestamp using `stage` events. Prices come from `profile.pricing`: per model family, five-minute and one-hour cache writes priced apart when the transcript reports the TTL, and an optional long-context tier. Subagent transcripts are summarized at SubagentStop into `usage` events carrying the agent id; each event is the delta since that agent's previous stop, so the events add up even when a blocked judge stops twice. `usage.json` carries the total and the main-session and subagent shares. The headless driver records Claude Code's own `total_cost_usd` per session as a `session` event; the report and `harness analyze` print it next to the table as the number of record. The Stop hook refreshes `.harness/usage.json` before deciding, so the cost budget is live.

## Judge aids

`harness preflight` writes `.harness/packets/<slice>-a<attempt>.md` (`scripts/lib/packet.mjs`): the slice, the text of its criteria from the inventory, declared paths, changed files with line counts, the diff against HEAD capped at the slice diff budget, and the content of new files, which the diff omits. The critic and review briefs name it. `harness verdict template` (`verdictTemplate` in `machine.mjs`) prints a skeleton for the current stage: agent from the escalation rule, goal, slice, attempt, round, work hash and one `unverified` entry per criterion, with an empty summary and a block verdict with no block finding so it fails validation until filled. Both are run artifacts under `.harness/` and never count as work.

## Holds

A plan question of kind `hold` blocks the slices named in `blocks`; `nextReadySlice` never starts a blocked slice and the goal predicate does not count it as missing. When every unheld slice is done and a hold still blocks a pending one, `decideReport` rests the run in `awaiting_human` with code `holds_open` after the report is written, instead of moving to `done`. `harness hold answer --id H-n --answer "..."` (`answerHold` in `machine.mjs`) removes the hold, records the answer as the next applied default, and, when the run was resting on it, calls `advance` so the held slice starts with the build brief. Hold ids are numbered past every hold ever raised. The headless driver, once a run rests, runs `harness report --refresh` so the committed report carries the session cost it just recorded.

## Self-run

The path guard denies writes under the enforcing plugin root, so a goal on the harness's own checkout needs two copies: the checkout is the project, and a frozen copy (the installed one under `~/.claude/plugins/cache/`) is the enforcer. `scripts/drive.mjs --plugin-root <copy>` loads that copy as the session's plugin and refuses to run when the copy is the project itself; `harness init` says so when the project is the harness. The checkout's `scripts/`, `briefs/` and `agents/` are then ordinary project files, while `openspec/specs/` stays protected and the change goes under `openspec/changes/`. The enforcing copy stays as installed until the change merges and the plugin is updated.

## Retro and metrics

`scripts/lib/metrics.mjs` is the one definition of a run's numbers over a `.harness/` directory or a snapshot; `analyze`, `retro`, the replay evals and the bench share it. `harness retro` (`scripts/lib/retro.mjs`) refuses mid-goal, computes the metrics and the mechanical signals, and writes a proposal skeleton with stable finding ids under `.harness/proposals/`; the `retro` skill fills in the findings. SubagentStop copies every rejected verdict to `.harness/verdicts/rejected/` so a replay eval has inputs. The evals are in `docs/evals.md`; the harness's own specs live in `openspec/` and `npm run check` validates them.

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
  verdicts/            one JSON per judge cycle, spec-a<n>-spec-reviewer.json, reconcile.json
  evidence/<slice>/    screenshots, gifs
  reconcile-input.json deterministic evidence per item, Jev buckets
  usage.json           cost per stage
  report.md            final report; copied to reports/<goal>.md (committed)
  lessons.md           cited lessons (committed)
  jev.jsonl            every Jev answer, for calibration
  proposals/           changes the run wants in the harness itself (committed)
```
