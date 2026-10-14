## Stage: build, slice {{slice.id}} "{{slice.title}}" (attempt {{attempt}} of {{maxAttempts}})

Criteria: {{slice.criteria}}
Allowed paths: {{slice.paths}}
UI slice: {{slice.ui}}

{{feedback}}

Rules: work only on the goal branch; stage files explicitly (never `git add -A`); write a failing test before the fix where a test is possible; never weaken an existing test; English only in everything you write; no secrets, no real names, obviously fake placeholders only.
When the slice is implemented and its tests pass locally, run:
`{{cli}} slice done`
then stop. Do not commit; the record stage commits.
