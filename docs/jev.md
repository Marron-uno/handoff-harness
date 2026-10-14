# The Jev layer

[Jev](https://typesafe.ai) is TypeSafe AI's decision model: it answers typed questions (yes/no probability, choice, score) about a state, with calibrated probabilities, and generates no text. In this harness it is an optional classifier layer between the deterministic scripts and the model judges. It can route, block, or add a question. It never grants a pass.

## Three uses

1. **Verdict plausibility gate** (`SubagentStop`). After a judge writes a verdict and the schema validator accepts it, Jev answers per finding: does the evidence support the issue, does the severity match the impact, what kind of finding is it; and per verdict: does the summary agree with the findings. Probabilities under the thresholds in `profile.jev.thresholds` send the verdict back to the judge with the questioned findings named.
2. **Reconciliation prefilter** (`harness reconcile prepare`). For each inventory item without deterministic evidence, one question: are its criteria satisfied by the changes described. Items land in `jev_done`, `jev_missing` or `jev_uncertain` buckets that tell the reconciler where to spend reading time. Nothing is marked done by Jev alone.
3. **Trace classification** (`harness jev classify`). Guard denials, stop-hook blocks, halts and invalid verdicts get a category and a reusable score. Reusable ones become cited stubs in `.harness/lessons.md`.

## Request shape

```json
POST /v1/systemone
Authorization: Bearer $TYPESAFE_API_KEY

{ "model": "jev-latest", "state": { "finding": { "...": "..." } },
  "questions": { "evidence_supports": { "type": "noul", "instructions": "The quoted evidence demonstrates the described issue." } } }
```

Answers come back as `{ "answers": { "evidence_supports": { "type": "noul", "noul": 0.91 } }, "usage": { "input_tokens": 212, "output_tokens": 0 } }`. Choice answers carry `choice`, `probabilities` and `confidence`; score answers carry `score`, `legend`, `probabilities` and `confidence`. The versioned questions live in `profiles/jev-questions.v1.json`.

## Providers and access

Direct signup was paused in late September 2026; existing accounts work, and gateways serve the model without a waitlist. `profile.jev.provider` selects a preset: `typesafe` (direct, `TYPESAFE_API_KEY`), `openrouter` (`typesafe/jev-1.13`, `OPENROUTER_API_KEY`), `vercel` (`typesafe-ai/jev`, `AI_GATEWAY_API_KEY`), or `custom` with an explicit `endpoint` and `model`. `harness jev ping [--provider name]` sends the one documented question through the resolved endpoint and prints the answer, the model, the latency and what the gateway billed; run it before enabling the layer.

### Vercel AI Gateway, step by step

Checked against the Vercel docs on 2026-10-14. The gateway exposes TypeSafe's own request and response shapes at `https://ai-gateway.vercel.sh/typesafe/v1/systemone`, model `typesafe-ai/jev`, bearer auth with an AI Gateway key; the `vercel` preset is exactly that. Question types are `noul`, `choice` and `score` as in the direct API. Jev is listed at $0.042 per million input tokens, no output charge, 32k context; the response carries `provider_metadata.gateway.cost`, which the harness keeps in `.harness/jev.jsonl` and the `jev` events.

1. A Vercel account; the key belongs to a team, and a Hobby account's personal team works. Add a payment method to the team to unlock the free AI Gateway credit, or buy credits; a goal run is about one cent.
2. Dashboard, AI Gateway, API Keys, Create API Key. Copy it at once; Vercel does not show it again. Set a budget on the key if the dialog offers one.
3. `export AI_GATEWAY_API_KEY=...` in the shell that will start Claude Code or `drive.mjs`. Hooks inherit the environment of the session, so the key must be set before the session starts; never write it into a file the run can read.
4. In the project: `harness jev ping --provider vercel`. Expect `ok: true`, an `answer` near 1 for the refund question, `modelReported` `typesafe-ai/jev` and a `cost` of about a hundred-thousandth of a dollar. `skipped` with `no key` means step 3; `auth 401` means the key; `http 402` means credits.
5. `.harness/profile.json`: `"jev": { "enabled": true, "provider": "vercel" }`. Create the goal with `--jev`.
6. After the run, `harness jev calibrate --markdown` is the measure of what the layer was worth.

Measured on [run 3](runs/2026-10-14-fixture-run-3/README.md): eleven answers through the gateway for $0.00034, 253 to 595 ms each, every gate decision `accept`, two inventory items prefiltered into the uncertain bucket and both outcomes recorded.

## Failure policy

429 retries once after `retry-after`, then skips. 529, timeouts and auth errors skip. 400 with `guardrail_uninspectable` skips and logs it. 422 fails loudly because it means the questions file is wrong. A skip always falls back to the full judge path, so a vendor outage never blocks a run.

## Data policy

Off by default. The goal must be created with `--jev` and the profile must set `jev.enabled: true`. Redaction patterns in `jev.redact` run locally before anything is sent, states are capped at `jev.maxStateChars`, and every request logs the SHA of what left the machine to `.harness/jev.jsonl`.

## Calibration

Every answer is logged with its probabilities. Outcomes are recorded with `harness jev outcome --id <answerId> --actual true|false` (the reconcile loader records inventory outcomes automatically). `harness jev calibrate` prints observed rate against predicted probability per question and bin. That table sets the thresholds and is the honest measure of what the layer is worth on your runs.

Cost: $0.042 per million input tokens, output free. A goal run with a few hundred decisions costs about one cent.
