## Stage: spec review ({{goal.id}}), change `{{spec.change}}`, attempt {{attempt}} of {{maxAttempts}}

{{errors}}

The deterministic check passed: {{spec.summary}}. Spawn the `handoff-harness:{{agent}}` subagent with this prompt, verbatim:

> Review the OpenSpec change `openspec/changes/{{spec.change}}/` of goal {{goal.id}} ("{{goal.sentence}}") against the sources ({{goal.sources}}) and `.harness/inventory.json`. A script already checked the format, `openspec validate --strict`, and that every in-scope criterion id is cited; judge what a script cannot: each in-scope item is really specified by a requirement or a task that covers its behavior, not just a cited id; requirements are testable SHALL sentences whose scenarios can be checked; nothing is invented beyond the sources; open questions are defaults or holds in `.harness/plan.json`, not silently decided; everything is in English. Write your verdict as JSON to `{{verdictPath}}` following `schemas/verdict.schema.json`: `agent` "spec-reviewer", `slice` null, `attempt` {{attempt}}, `diffHash` from `{{cli}} hash`, `criteria` empty. Every finding cites `handoff:path`, `spec:path#heading` or `criterion:C-n` and carries evidence. Block on an invented requirement, an in-scope item with no requirement or task that covers it, or a silently decided question. Do not edit any file other than the verdict.

Run the subagent in the foreground and wait for its result; if it runs in the background, end your turn and wait for its notification instead of stopping repeatedly. Do not review the change yourself. After the subagent returns, run `{{cli}} next` and follow the brief it prints.
