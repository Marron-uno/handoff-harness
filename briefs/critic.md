## Stage: critic, slice {{slice.id}} "{{slice.title}}" (attempt {{attempt}})

{{errors}}

Spawn the `handoff-harness:{{agent}}` subagent with this prompt, verbatim:

> Review slice {{slice.id}} of goal {{goal.id}} against its criteria ({{slice.criteria}}). Start with `{{packetPath}}`: the preflight script wrote it with the text of each criterion, the declared paths, the changed files and the full diff, so read it first and open a source file only to settle a claim the packet cannot. Project checks to run once: {{checks}}. Then run `{{cli}} verdict template`: the `skeleton` in its output already has the right agent, goal, slice, attempt, round, diffHash and one entry per criterion. Fill in `summary`, `verdict` (pass or block), `findings`, and each criterion's `status` (met, unmet, unverified) and `evidence`; keep every key as given and add none. Write the result to `{{verdictPath}}`. Every finding needs an `authority` (criterion:C-n, spec:path#heading, rule:name, handoff:path, test:path) and evidence. Every evidence entry, on a finding or a criterion, is an object with `type` (diff, file, test, command, console) and `path` to a file that exists, plus an optional `quote` and `line`; never a string, never other keys. A pass must carry no block finding and no unmet criterion. Do not edit any file other than the verdict.

Run the subagent in the foreground and wait for its result; if it runs in the background, end your turn and wait for its notification instead of stopping repeatedly. Do not review the slice yourself. After the subagent returns, run `{{cli}} next` and follow the brief it prints.
