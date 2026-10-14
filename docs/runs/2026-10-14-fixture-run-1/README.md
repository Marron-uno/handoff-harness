# Recorded run 1: the fixture, end to end, with real judges and Chrome

Goal: `build all of the handoff` on the Lantern Notes fixture. Driven headless by `scripts/drive.mjs` with `--chrome`, main session on Sonnet, critic on Haiku, reviewer on Sonnet, reconciler on Opus. Auto-approved so the run was unattended. Artifacts in this folder are the raw outputs; `analysis.md` is `harness analyze` over the events log.

| Fact | Value |
|---|---|
| Outcome | done, 3 of 3 slices, every verdict a pass on the first attempt |
| Wall clock | 11.5 min, of which 3.3 min halted by a harness bug |
| Cost reported by Claude Code | $1.24 over two headless sessions |
| Cost from the harness price table | $2.27 (the default table overestimates by about 1.8x) |
| Stop-hook blocks | 24, of which 6 were the bug |
| Guard denials | 1, a false positive |
| Browser | the reviewer started the dev server, opened its own tab on `localhost:4173`, saved one screenshot as evidence, closed the tab and stopped the server |
| Intake estimate on the goal card | $4 and 33 minutes |

## Timeline

| Time | What happened |
|---|---|
| 05:13 | Goal created. Intake read the handoff and the OpenSpec change, wrote a 5-item inventory with 7 criteria, a 3-slice plan, one applied default (tags case-insensitive) and one hold (public URL), and the goal card. |
| 05:15 | S-1 built in about 15 seconds, preflight passed (branch, diff budget, slice paths, language, secrets, prose, test weakening, OpenSpec validate, `npm test`). |
| 05:15:26 | Critic spawned as a background subagent. The main turn ended; the Stop hook saw no verdict and blocked. Six blocks in twenty seconds, then the runaway cap halted the run. |
| 05:16:35 | The critic's verdict arrived: pass, 13 evidence entries, one note-level finding about `localeCompare` on ISO strings. Valid, but the run was already halted. |
| 05:17 | Fix shipped (the hook yields while a background task runs), `harness retry --stage critic`, driver restarted. |
| 05:19 | The existing verdict was accepted. Reviewer passed S-1. One Bash call was denied because the word `secrets` in a grep pattern matched the sensitive-path glob. |
| 05:20 | S-2 (markdown export): build 14 s, critic 45 s, review 22 s, recorded. |
| 05:22 | S-3 (note count on the page): build 18 s, critic 89 s. Reviewer checked `curl`, ran `npm start` in the background, opened the page in Chrome, screenshot to `evidence/S-3/count-page.jpg`, criterion C-7 met with the screenshot as evidence. |
| 05:24 | Reviewer finding F-1 (major, not blocking): the standalone server creates an empty store, so the page can never show a non-zero count. That is a real gap in the fixture's handoff, and the harness surfaced it without being asked. |
| 05:25 | Reconciliation: 5 of 5 items done, no new slices. Report written and committed. Goal predicate passed. |

## What worked

- The state machine drove 17 transitions across two sessions with no human input after the goal card.
- Every judge wrote a schema-valid JSON verdict on the first try. No pass carried a block finding; no verdict was stale.
- The browser lane did what it should: the reviewer's host change was logged as `localhost` (fixture), typing and form input would have been denied anywhere else, and the screenshot is cited as evidence with the host it came from.
- Preflight caught nothing because nothing was wrong, which is the right result; it ran `npm test` and OpenSpec validate on every slice in under ten seconds.
- `harness retry --stage critic` resumed after the halt without rebuilding, and the verdict written during the halt was reused.
- The reconciler agreed with the deterministic evidence and proposed no busywork.

## Findings, ranked

1. **Background subagents stalled the Stop hook.** The critic ran in the background; the hook counted every turn end as a stall and halted in twenty seconds. Fixed: a running background task in a judge stage lets the turn end without counting a block.
2. **Every stage cost a stop-and-block cycle.** 24 blocks for 17 transitions, each one a model turn that re-reads the brief, plus pressure on Claude Code's eight-continuation cap. Fixed: CLI commands that produce evidence (`slice done`, `preflight`, `record`, `reconcile load`, `report`) now advance the machine and print the next brief, and `harness next` does the same after a verdict. The Stop hook remains the enforcement of record.
3. **Sensitive-path guard false positive.** `grep -rn secrets src/` was denied because `secrets` matched `**/*secret*`. Fixed: only path-like tokens are tested.
4. **Evidence without a location.** Some critic and reviewer evidence entries had a type but no path (`test` with no file). The validator accepted them. Fixed: file, test, diff, screenshot and gif evidence need a path that exists; command, console and network evidence need a quote; a met criterion needs at least one evidence entry; screenshots need their host.
5. **Subagent usage landed in the wrong stage.** The first critic finished after the halt, so its cost was attributed to `halted`. Fixed: a SubagentStart hook records the spawning stage and SubagentStop uses it.
6. **The critic explores too much.** Haiku took 12 to 25 tool calls per slice and more wall time than the Sonnet reviewer. Partly fixed: the critic brief now lists the changed files and the project checks and tells it not to explore beyond them. Measure again on the next run.
7. **The dev server is the reviewer's problem.** It worked because the reviewer started and stopped it itself, but a stage-managed `harness serve` is the right design. Still open.
8. **The default price table overestimates.** Claude Code reported $1.24; the harness table said $2.27. The table is a profile value; the driver log now records Claude Code's number per session so both are visible. Still open: calibrate the defaults.
9. **The fixture's UI item is underspecified.** The reviewer's F-1 is right: C-7 says the page shows N notes, but nothing seeds the server's store. A good handoff would say where the notes come from. Left as is, because it is a realistic example of what the review loop should catch.

## What to run next

Rerun the same goal after the fixes and compare: block count, turns per session, critic calls, total cost. Then a feature-mode goal with no handoff document, and a run with Jev enabled against a gateway key.
