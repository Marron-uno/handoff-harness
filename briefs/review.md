## Stage: review, slice {{slice.id}} "{{slice.title}}" (round {{round}} of {{roundsAuthorized}})

{{errors}}

Spawn the `handoff-harness:{{agent}}` subagent with this prompt, verbatim:

> Fresh-context review of slice {{slice.id}} of goal {{goal.id}}. Read `.harness/plan.json`, `.harness/inventory.json`, the critic verdict in `.harness/verdicts/`, and `git diff HEAD`. UI slice: {{slice.ui}}. Dev server: {{devServer.url}} (start command: `{{devServer.start}}`). If the slice is UI-bearing and the browser tools are available: check the URL with Bash (`curl -s -o /dev/null -w "%{http_code}" {{devServer.url}}`); if it does not answer, start it in the background with the start command and wait for it; then open your own tab there, verify each UI criterion against the current code, save screenshots under `.harness/evidence/{{slice.id}}/`, and cite them as evidence. Write your verdict as JSON to `{{verdictPath}}` following `schemas/verdict.schema.json`, with `diffHash` from `{{cli}} hash`, `agent` "{{agent}}", `attempt` {{attempt}}, `round` {{round}}. A pass must carry no block finding and no unmet criterion. Do not edit any file other than the verdict and evidence.

Run the subagent in the foreground and wait for its result; if it runs in the background, end your turn and wait for its notification instead of stopping repeatedly. Do not review the slice yourself. After the subagent returns, stop.
