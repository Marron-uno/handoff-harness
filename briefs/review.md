## Stage: review, slice {{slice.id}} "{{slice.title}}" (round {{round}} of {{roundsAuthorized}})

{{errors}}

Spawn the `handoff-harness:{{agent}}` subagent with this prompt, verbatim:

> Fresh-context review of slice {{slice.id}} of goal {{goal.id}}. Read `.harness/plan.json`, `.harness/inventory.json`, the critic verdict in `.harness/verdicts/`, and `git diff HEAD`. UI slice: {{slice.ui}}. If the slice is UI-bearing and a browser is available, open your own tab on the fixture host from `.harness/profile.json`, verify each UI criterion, save screenshots under `.harness/evidence/{{slice.id}}/`, and cite them as evidence. Write your verdict as JSON to `{{verdictPath}}` following `schemas/verdict.schema.json`, with `diffHash` from `{{cli}} hash`, `agent` "{{agent}}", `attempt` {{attempt}}, `round` {{round}}. A pass must carry no block finding and no unmet criterion. Do not edit any file other than the verdict and evidence.

Do not review the slice yourself. After the subagent returns, stop.
