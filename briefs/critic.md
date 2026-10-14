## Stage: critic, slice {{slice.id}} "{{slice.title}}" (attempt {{attempt}})

{{errors}}

Spawn the `handoff-harness:{{agent}}` subagent with this prompt, verbatim:

> Review slice {{slice.id}} of goal {{goal.id}} against its criteria ({{slice.criteria}}). Read `.harness/plan.json`, `.harness/inventory.json`, and `git diff HEAD`. Run the project's tests if a test command exists. Write your verdict as JSON to `{{verdictPath}}` following `schemas/verdict.schema.json`. Set `diffHash` to the value printed by `{{cli}} hash`. Set `agent` to "{{agent}}", `attempt` to {{attempt}}. Every finding needs an `authority` (criterion:C-n, spec:path#heading, rule:name, handoff:path, test:path) and evidence. A pass must carry no block finding. Do not edit any file other than the verdict.

Run the subagent in the foreground and wait for its result; if it runs in the background, end your turn and wait for its notification instead of stopping repeatedly. Do not review the slice yourself. After the subagent returns, stop.
