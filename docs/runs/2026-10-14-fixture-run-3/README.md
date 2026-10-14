# Recorded run 3: the fixture with Jev through the Vercel AI Gateway

Goal: `build all of the handoff` on the Lantern Notes fixture, the same command as [run 2](../2026-10-14-fixture-run-2/README.md) plus `--jev`, with `jev.provider: vercel` in the profile and an AI Gateway key in the environment. Driven headless by `scripts/drive.mjs --chrome`, main session on Sonnet, spec reviewer on Sonnet, critic on Haiku, reviewer on Sonnet, reconciler on Opus, auto-approved. First run on 0.3.2, so it also measures the three fixes from run 2: usage counted once, the verdict skeleton, the critic packet. The artifacts in this folder are the raw outputs; `report.md` was refreshed by the driver after the session so it carries Claude Code's figure; `analysis.md` is `harness analyze` over the events log.

| Fact | Run 3 | Run 2 |
|---|---|---|
| Outcome | 2 of 3 slices built; S-3 (the UI slice) left pending behind a hold and the run called itself done, which is the bug this run found | 4 of 4 slices |
| Wall clock | 5.5 min, one session, 16 turns | 11.5 min, one session, 53 turns |
| Cost reported by Claude Code | $0.88 | $1.74 |
| Cost from the harness price table | $0.77 (0.88x; main $0.54, subagents $0.23) | $5.48 as recorded (3.2x, two counting bugs); $1.52 recomputed (0.87x) |
| Stop-hook blocks, guard denials, halts | 0, 0, 0 | 0, 2, 0 |
| Invalid verdict writes | 2 of 7 (one critic, twice on the same file) | 5 of 14 |
| Critic tool calls per slice | 4 then 2 then 2 across the retries, and 10 | 17, 18, 20, 27 |
| Reviewer tool calls per slice | 2 and 3, no browser (the UI slice was never built) | 3 to 17, two screenshots |
| Jev | 11 answers over 18 events, all 5 gate decisions `accept`, 2 inventory items prefiltered, 2 outcomes recorded, $0.00034 billed by the gateway, 253 to 595 ms per call | off |

## Timeline (UTC)

| Time | What happened |
|---|---|
| 17:59:07 | Goal created with the spec stage and Jev on, adopting `lantern-v0-2`. |
| 18:00:03 | Intake: inventory of 5 items, change amended, `harness spec check` pass (3 requirements, 5 scenarios, 5 tasks, 5 of 5 criteria cited). The plan put the fixture's hold H-1 ("What is the public URL of the deployed page?") on S-3, the note-count page. Run 2's intake had left that hold blocking nothing. |
| 18:00:33 | Spec reviewer: pass, three findings. Jev gate on the verdict: evidence support 0.86, 0.59 and 0.42 (threshold 0.4), severity consistent 0.74, 0.78, 0.58, summary consistent 0.79, route `accept`. Auto-approve committed the change. |
| 18:01:26 to 18:01:54 | S-1 (listing: sort, copy, tag filter). The critic's first verdict put strings where evidence objects go; the second added a `note` key inside evidence; the third was valid: pass. Four, two and two tool calls across the three stops, 8 in total. Jev: summary consistent 0.85, accept. |
| 18:02:15 | Reviewer S-1: pass in 2 tool calls. Jev accept (0.85). Recorded. |
| 18:03:09 to 18:03:39 | S-2 (markdown export): critic pass in 10 tool calls, one `style` finding (Jev: evidence 0.69, severity 0.86); reviewer pass in 3 calls. Recorded. |
| 18:03:49 | Reconciliation: two items without deterministic evidence went to Jev: I-1 implemented 0.28, I-5 implemented 0.25, both in the uncertain bucket, so the reconciler read both. It marked I-1 out of scope (already shipped) and I-5 `held` behind H-1, proposed no slice. The two outcomes were recorded for calibration. |
| 18:04:29 | Report written and committed. Goal predicate passed because held slices do not count against it, and the machine moved to `done`. The session's own closing message said the goal was only partly done. |
| 18:04:37 | Driver recorded the session: $0.884, 16 turns, 310 s. |

## What Jev did

Every call went through `https://ai-gateway.vercel.sh/typesafe/v1/systemone` with the model `typesafe-ai/jev`, the request and response shapes of the direct API, and the gateway's own cost in the response. Eleven answers cost $0.00034 in total and took a quarter to half a second each, so the layer added about four seconds and nothing to the bill. All five gate decisions (the spec verdict, two critics, two reviewers) were `accept`; the closest call was the spec reviewer's third finding at 0.42 against a 0.4 threshold for evidence support. The inventory prefilter put both undecided items in the uncertain bucket, which is the honest answer for an out-of-scope item and a held one. With two outcomes, `harness jev calibrate` has one bin and nothing to say yet; calibration needs tens of outcomes, which means more runs.

## What the run-2 fixes did

- Verdict writes rejected by the validator fell from 5 of 14 to 2 of 7, both by the same Haiku critic on the same file: evidence entries as strings, then an extra key inside an evidence entry. The skeleton fixed ids, hash, round and criteria; it did not spell out the evidence object. Fixed after the run: the critic and review briefs and the skeleton's note now state the evidence shape.
- The critic read the packet instead of exploring: 4 and 10 tool calls on the first stop against 17 to 27 in run 2.
- The price table landed at 0.88x of Claude Code's figure, computed by the shipped code, and the report prints both.

## Findings, ranked

1. **A held slice ended the run as done.** Intake blocked S-3 on the deployed-URL hold, the goal predicate skips held slices by design, and the machine transitioned to `done` with the UI item unbuilt and unverified. The model noticed; the script did not. Fixed in 0.3.3: when every unheld slice is done but a hold still blocks a pending slice, the run rests in `awaiting_human` with code `holds_open` and the report written. `harness hold answer --id H-n --answer "..."` records the answer as an applied default and starts the held slice. Hold ids never repeat.
2. **The report could not carry Claude Code's figure.** The driver records the session cost after the session, and the report is written inside it. Fixed in 0.3.3: once the run rests, the driver runs `harness report --refresh`, which re-renders and re-commits the report without advancing the machine; this run's `report.md` is the first with both numbers.
3. **The hold itself was misplaced.** A public URL is not needed to build or verify the page on the dev server; run 2's intake knew that and this one did not. Model judgment, so only the intake briefs changed: a hold blocks a slice only when the slice cannot be built or verified without the answer, and a deployment URL never blocks dev-server verification.
4. **Evidence shape fumbles** are the remaining verdict failures. Fixed in the briefs and the skeleton note; to be measured on the next run.
5. **Jev accepted everything.** Five gate decisions, no re-review, no block. Either the judges were right or the thresholds are low; two outcomes cannot tell. The layer is cheap enough to leave on and let calibration accumulate.

## What to run next

The same goal again, to confirm zero invalid verdicts with the evidence shape spelled out and to watch the hold rest and the answer path on a real run. Then the authored-change run (no `--change`) on a feature-mode goal.
