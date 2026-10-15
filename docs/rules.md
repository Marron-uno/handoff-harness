# Deterministic rules

Every rule below is enforced by a script, not by a prompt. The column "where" names the hook or stage that enforces it; "evidence" names the kind of failure in real projects that motivated it.

| Rule | Where | Evidence |
|---|---|---|
| No history rewrites: amend, rebase, reset --hard, force push, branch -D, filter-branch | PreToolUse git guard | Rewrites hide what the agent did; the events log would lie |
| No bulk staging: `git add -A`, `git add .`, `git add --all` | PreToolUse git guard | A bulk add swept untracked screenshots with real names into a commit |
| Push only the goal branch; never the default branch | PreToolUse git guard | Goal work must stay reviewable as one branch |
| No edits on the default branch during a goal | PreToolUse path guard | Same |
| No discard commands: `checkout -- .`, `restore .` | PreToolUse git guard | Discards destroy evidence of an oscillation |
| Destructive shell patterns denied (`rm -rf /`, `curl \| sh`, `dd if=`) | PreToolUse shell guard | Project deny lists |
| State files written only through the CLI | PreToolUse git and path guards | state.json is the single source of truth |
| Protected paths: `openspec/specs/**`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, harness state | PreToolUse path guard | The spec is the contract; the pipeline owns only its change folder |
| Harness files read-only from inside a run; changes go to `.harness/proposals/` | PreToolUse path guard | The harness must not rewrite its own rules mid-run |
| A checkout of the harness is a project like any other when a different, frozen copy enforces the run (`drive.mjs --plugin-root`); the same copy never edits itself | PreToolUse path guard, headless driver | The harness could not build its own changes; loosening the rule would let a run edit the hooks judging it |
| Sensitive paths never read: `.env*`, keys, credentials, inside or outside the project; a test file named after what it tests is not one | PreToolUse git and path guards | Nothing real may leak into a transcript; the angar run could not read `tests/browser-secret.test.mjs` (field issue 15) |
| Judges (critic, reviewer, reconciler) write only verdicts and evidence | PreToolUse path guard | A judge that fixes is no longer a judge |
| Stage lanes: no source edits inside the project in preflight, critic, review, record, report and resting stages other than `done`; paths outside the project are never denied by a lane | PreToolUse path guard | Edits between judge and record make verdicts stale; the angar run was denied notes in another repository during review (field issue 2) |
| A goal resting in `done` is dormant: edits, branch switches and pushes work on any branch except the default branch and the reviewed goal branch | PreToolUse path and git guards | The angar run needed a full new goal, intake and approval for a few lines of client feedback (field issue 14) |
| Tool-call budget per stage | PreToolUse | A stage that runs long is a stall, not diligence |
| Browser read-only outside fixture and preview hosts | PreToolUse browser guard | The reviewer uses the owner's logged-in browser |
| Prod hosts need `--prod` on the goal | PreToolUse browser guard | Explicit opt-in per goal |
| Typed text is scanned for credentials | PreToolUse browser guard | Fixture values only |
| Browser action budget per review; the counter resets when a review starts | PreToolUse browser guard | Browser steps are slow; the angar run never reset the counter and its sixth review was locked out of the browser (field issue 5) |
| English everywhere agents write, by function-word count | PostToolUse, preflight, verdict validator | Specs drifted into Spanish within weeks |
| No secrets written | PostToolUse, preflight | Seed passwords found in committed hooks |
| No em dashes, no banned phrases in prose | PostToolUse, preflight | Prose quality rule |
| Diff budget per slice; binary files count as 0 lines | preflight | Big diffs hide behavior changes; the angar run counted images as text and blew the cap (field issue 1) |
| Slice edits stay inside declared paths; only a human widens them, with `harness slice amend`, logged as an event | preflight, `slice amend` | Undeclared scope creep; the angar run aborted a goal over a planning miss (field issue 3) |
| A human decision after approval is a default scoped to a slice: `harness decide`, listed in the packet, cited as `decision:D-n`, checked against the state | `decide`, packet, verdict validator | The angar run kept a spec conflict's resolution in a scratchpad file the judges could only hear about (field issue 11) |
| Harness configuration changed during a slice is committed apart from the slice | `record` | Profile changes landed inside the angar run's slice commits (field issue 6) |
| Dependency manifests change only when declared | preflight | Undeclared dependencies |
| Tests never weakened: no deleted test files, no skips, no net removal | preflight | Agents delete failing tests |
| OpenSpec validate when `openspec/` exists | preflight | Spec and change folders stay consistent |
| Spec stage: the change passes `openspec validate --strict` and the delta format check | intake handler, `spec check` | A model that fumbles the format gets a retry, not a pass |
| Spec stage: every in-scope criterion id is cited in the change; every task cites an id | intake handler, `spec check` | Run 1's reviewer found an item the change never specified; the spec reviewer must see it first |
| Spec stage: every task belongs to exactly one slice | intake handler, `spec check` | A task nobody owns can never be ticked, so the goal could never be done |
| Spec stage: a spec verdict has slice null, the active attempt, empty criteria, the current work hash | verdict validator | Criteria are judged after the code exists, not before |
| Spec stage: no source edits while the spec reviewer judges | PreToolUse path guard | Same lane rule as the other judge stages |
| Spec stage: approval commits the change; record ticks tasks; nobody else ticks | `goal approve`, `record` | A ticked box is evidence only when a script ticked it after the judges |
| Spec stage: the goal is done only when every task is ticked (skipped and held slices excepted) | `goal check` | The spec's own task list is part of the contract |
| Archiving a change into `openspec/specs` is a human step | protected paths, report | The pipeline never edits the contract it builds against |
| Project checks (`npm test`, lint, typecheck) from the profile | preflight | Mechanical feedback before any model judges |
| Verdict schema; pass cannot carry a block finding or an unmet criterion | verdict validator | Prose verdicts said "LGTM" with defects listed below |
| Verdict work hash must match the current change set; every command resolves to the project root, and `verdict validate` defaults to the current verdict and names the files that made it stale | verdict validator, CLI | Judging a different diff; the angar run's reviewer validated from a subfolder and was told its verdict was stale (field issues 7 and 8) |
| Evidence paths must exist | verdict validator | Invented evidence |
| Attempt cap per slice, then a human; attempts count across `harness retry` and the cap counts from the retry | Stop hook, `retry` | Infinite fix loops; the angar run's retry reset the count and its report showed 3 attempts for 4 builds (field issue 10) |
| Review rounds cap, raisable by a human (`authorize-rounds`) | Stop hook | Rounds 4 to 6 caught real bugs once; the cap is a gate, not a wall |
| Runaway cap below Claude Code's 8 continuations | Stop hook | A hook that blocks forever gets cut off anyway |
| Oscillation on the work hash (A B A B) | Stop hook | Revert loops |
| Time and cost budgets per goal | Stop hook | Spend is attributed, so it can be capped |
| Goal completion is a script predicate | `goal check` | The model never declares itself done |
| A slice still blocked by a hold rests the run in `awaiting_human`, never `done` | Stop hook, report stage | Run 3 ended "done" with the UI slice unbuilt behind a hold; the model noticed, the script did not |
| Hold ids never repeat, and an answer becomes an applied default | `hold answer` | The events log must name one question per id |
| The driver refreshes the committed report with Claude Code's session cost | headless driver, `report --refresh` | The report is written inside the session, before the figure exists |
| Harness artifacts never count as work | work hash | Writing a report must not make a verdict stale |
| Transcript usage counted once per message id | usage attribution | Run 2's table read 3.2x Claude Code's figure: one row per content block, each summed |
| Subagent usage recorded as the delta since the agent's last stop | SubagentStop | A judge sent back by the hook stopped twice and its whole transcript was billed twice |
| Claude Code's own session cost recorded as the number of record | headless driver, report | A price table is an estimate; the figure Claude Code reports is what the user sees |
| Judges start from a script-written verdict skeleton that cannot pass unedited, next to an example finding, with the finding shape spelled out in the briefs | `verdict template`, briefs | 5 of 14 verdict writes in run 2 fumbled keys, ids or the hash; the angar run's judges wrote `summary` for `issue`, severity `nit` and spaced authorities (field issue 4) |
| The critic reads a packet written by preflight, with new files in its diff | preflight, critic brief | Haiku spent 17 to 27 tool calls exploring the tree per slice; the angar run's packet diff was empty for a slice that only added files (field issue 9) |
| The report and reconciliation read the active goal's verdicts only, the recorded attempt winning | report, `reconcile prepare` | The angar run's G-3 report listed G-2 criteria as unmet from a pre-retry verdict (field issue 12) |
| A retro reads a resting run and edits nothing but its proposal | `harness retro`, path guard | Three retros done by hand; the harness must not rewrite itself from inside a run |
| Rejected verdicts are kept as replay fixtures | SubagentStop | Invalid attempts left only an error message in the log, so the validator had no inputs to replay |
| A change to the harness states a hypothesis as a metric and a direction | `openspec/config.yaml` rules, bench | Fixes were asserted, not measured |
