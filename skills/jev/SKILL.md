---
name: jev
description: Jev decision-model helpers for handoff-harness: gate a verdict, prefilter the inventory, classify trace events into lessons, print the calibration table.
argument-hint: ping [--provider vercel] | gate <verdict.json> | prefilter | classify | calibrate | outcome --id <answerId> --actual true|false
---

The Jev layer is optional. It runs only when the goal was created with `--jev` and `.harness/profile.json` sets `jev.enabled: true` and the key named by `jev.keyEnv` is in the environment. Without those, every command reports `skipped` and the run continues on the full critic path.

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.mjs" jev $ARGUMENTS` and show the JSON summary. Rules you must keep:

- `jev ping` sends one documented question through the configured provider (or `--provider` for this call only) and prints the answer, the model, the latency and the billed cost; it is the check to run before enabling the layer. It never reads or prints the key.
- Jev routes, blocks or adds a question. It never grants a pass. A verdict the gate questions goes back to the judge; a verdict it accepts is still validated by the schema and consistency checks.
- Inventory buckets (`jev_done`, `jev_missing`, `jev_uncertain`) narrow what the reconciler reads. Nothing is marked done without deterministic evidence or a reconciler decision.
- Every answer is logged to `.harness/jev.jsonl` with the probabilities. Record outcomes with `jev outcome` when you learn whether an answer was right; `jev calibrate` turns those into the reliability table that sets the thresholds.
