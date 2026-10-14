# Recorded run 2: the fixture with the spec stage on

Goal: `build all of the handoff` on the Lantern Notes fixture, with the spec stage on (`--openspec --change lantern-v0-2`), adopting the fixture's hand-written OpenSpec change instead of authoring one. Driven headless by `scripts/drive.mjs --chrome`, main session on Sonnet, spec reviewer on Sonnet, critic on Haiku, reviewer on Sonnet, reconciler on Opus. Auto-approved so the run was unattended. The artifacts in this folder are the raw outputs; `analysis.md` is `harness analyze` over the events log. [Run 1](../2026-10-14-fixture-run-1/README.md) is the baseline.

| Fact | Run 2 | Run 1 |
|---|---|---|
| Outcome | done, 4 of 4 slices (3 planned, 1 added by reconciliation), every verdict a pass on the first attempt | done, 3 of 3 slices |
| Wall clock | 11.5 min, no halt | 11.5 min, of which 3.3 min halted by a harness bug |
| Headless sessions | 1 (53 turns) | 2 |
| Stop-hook blocks | 0 | 24 |
| Cost reported by Claude Code | $1.74 | $1.24 |
| Cost from the harness price table | $5.48 (3.2x) | $2.27 (1.8x) |
| Guard denials | 2, one false positive hit twice | 1, a false positive |
| Invalid verdict attempts caught by the validator | 5 of 14 writes, all corrected by the judge after the SubagentStop reminder | 0 |
| Browser | the reviewer opened `localhost:4173` twice, two screenshots as evidence | once, one screenshot |
| Spec stage | change amended by intake, 3 requirements, 5 scenarios, 4 tasks, 5 of 5 criteria cited, spec reviewer passed with 4 minor findings, change committed at approval, 4 of 4 tasks ticked by record | not available |

## Timeline (UTC)

| Time | What happened |
|---|---|
| 14:28:08 | Goal created with the spec stage on, adopting `lantern-v0-2`. |
| 14:29:15 | Intake wrote the inventory (5 items, 7 criteria; I-1 marked out of scope as already implemented and already in `openspec/specs/notes`), amended the change (a new `Note count on the page` requirement, criterion ids on every scenario), ran `harness spec check` (pass: 3 requirements, 5 scenarios, 4 tasks, 5 of 5 in-scope criteria cited, `openspec validate --strict` pass), wrote the plan with a task list per slice and the goal card. `harness next` moved the run to `spec_review`. |
| 14:29:54 | The spec reviewer's first verdict used `title` and `detail` keys instead of `id` and `issue`. The validator rejected it; SubagentStop sent the errors back. |
| 14:30:03 | Valid spec verdict: pass, four findings, none blocking. Auto-approve committed the change (`spec: lantern-v0-2 (G-1)`, one file, 13 lines added) and started S-1. |
| 14:30:21 to 14:31:26 | S-1 (listing: newest first, copy, tag filter): build 18 s, preflight 3 s, critic 35 s, reviewer 24 s, recorded with tasks 1.1 and 1.2 ticked in the same commit. |
| 14:31:32 to 14:32:32 | S-2 (markdown export): build 6 s, critic 33 s, reviewer 24 s, recorded with task 2.1 ticked. |
| 14:32:43 to 14:34:36 | S-3 (note count on the page): critic's first verdict had a malformed authority, corrected in 10 s. Reviewer started the dev server, opened the page in its own Chrome tab, screenshot `evidence/S-3/count.jpg` showing "0 notes", closed the tab, stopped the server. Pass, with F-1 major: the server's store is always empty, so the count can never be non-zero. Recorded with task 3.1 ticked. |
| 14:34:44 to 14:35:40 | Reconciliation, pass 1. The deterministic evidence marked I-5 done (criterion met in two verdicts), but the reconciler read the reviewer's F-1 and overrode it to `partial`, proposing S-4 "Note count: verifiable with a seeded store". One Bash command of the reconciler was denied by the state guard (a read of `state.json` that redirected elsewhere). |
| 14:35:40 to 14:38:37 | S-4: `startServer(store, port)` exported, a `LANTERN_SEED` dev seed, a server test, the hard-coded "0 notes" replaced by a neutral placeholder. The critic's first verdict copied slice S-3 and cited `npm test` as a path; corrected. The reviewer's first two verdicts had a malformed authority and a test evidence without a path; corrected. Reviewer verified in Chrome with `LANTERN_SEED=3`: `evidence/S-4/count-3.jpg` shows "3 notes". Recorded. |
| 14:38:48 to 14:39:36 | Reconciliation, pass 2: 5 of 5 items done, no new slices. Report written and committed. Goal predicate passed, including every task ticked. |

## What the spec stage did

- Intake treated the adopted change as a draft to complete, not a document to copy: it found that the handoff's UI item had no requirement in the delta, added one, and put criterion ids on every scenario so the coverage check could tie the spec to the inventory.
- The deterministic check cost nothing a model has to do: format, `openspec validate --strict`, 5 of 5 criteria cited, every task citing an id, every task owned by exactly one slice.
- The spec reviewer caught two things worth having before any code existed: the export scenario only counts headings and never checks the body the criterion demands (F-1), and "in store order" is wording the handoff never states (F-2). Both minor, both recorded in the verdict, both visible to the critic later.
- The committed change is a readable record of what the run built against, in a format other tools understand, and `tasks.md` ends with four ticked boxes that a script ticked after two judges passed each slice. Archiving into `openspec/specs` is left to the human, as designed; the report prints the command.

## What the run-1 fixes did

- Zero Stop-hook blocks against 24. CLI commands advancing the machine and `harness next` after each verdict removed the stop-and-block cycle completely; the single session never hit Claude Code's continuation cap.
- No halt. The judges all ran as foreground subagents, and the background yield was never needed.
- Evidence rules bit three times and were right each time: a `test` evidence without a path and a `npm test` path that does not exist were rejected, so no verdict in this run cites a location that is not on disk.

## Findings, ranked

1. **State guard false positive.** The reconciler's Bash command read `state.json` and redirected output elsewhere; the rule denied any command that named a state file and contained a redirect or copy verb. Fixed: only a write whose target is a state file is denied (redirect target, `tee`, `sed -i`, `rm`, or the last argument of `cp` and `mv`), and the guard event now records the denied command so the next false positive can be diagnosed from the log.
2. **Reconciliation slices were missing from `plan.json`.** The reviewer for S-4 noted that the plan listed only S-1 to S-3 and judged against the inventory instead. Fixed: `reconcile load` appends the new slices to `plan.json` with `origin: "reconcile"`.
3. **Judges fumble the verdict schema on the first write.** Five of fourteen verdict writes were invalid: wrong finding keys, an authority without the `kind:` prefix, a copied slice id, a path that does not exist. The validator and the SubagentStop reminder corrected every one within 10 to 60 seconds, which is the mechanism working, but each costs a model turn. Partly fixed: the spec-review brief and agent now list the exact finding keys. Still open: a `harness verdict template` that prints a skeleton with the right goal, slice, attempt and hash.
4. **The default price table overestimates by 3.2x** on this run against Claude Code's own accounting ($5.48 against $1.74), worse than run 1's 1.8x, with cache reads dominating. Still open: calibrate `pricing.perMillion`, and consider reading Claude Code's per-session total from the driver as the number of record.
5. **The critic still explores.** Haiku took 17, 18, 20 and 27 tool calls per slice, no better than run 1 despite the brief listing the changed files. Still open: cap the critic's tool calls in its agent definition or give it the diff inline.
6. **Reconciliation overrode deterministic evidence, correctly.** I-5 had met criteria in two verdicts, so the prefilter marked it done; the reconciler read the reviewer's major finding and said partial. The deterministic bucket is advisory and the model may dissent, which is what happened. No change.
7. **The fixture gap from run 1 is now closed by the harness itself.** Run 1's reviewer flagged that the page could never show a non-zero count; run 2's reconciliation turned that into S-4, which seeded the store, added a server test and verified "3 notes" in the browser.
8. **An invented detail passed as minor.** The spec reviewer's F-2 is exactly what the stage exists for; with the default severities it did not block. A stricter profile could treat invented wording as `major`. No change; the finding is on record.

## What to run next

The spec stage with an authored change (no `--change`) on a feature-mode goal with no handoff document, so intake writes the proposal from scratch. A run with Jev enabled against a gateway key. And the same goal after the three fixes above, to confirm zero guard denials and zero invalid verdicts from the schema keys.
