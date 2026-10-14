## Stage: intake ({{goal.id}}), OpenSpec change `{{spec.change}}`

Goal sentence: "{{goal.sentence}}"
Sources: {{goal.sources}}

Still missing or invalid:
- {{missing}}

{{feedback}}

Produce, in this order, without editing source code and without touching `openspec/specs/**`:
1. `.harness/inventory.json` (schema: `schemas/inventory.schema.json` in the plugin). One item per screen, block, endpoint, string or acceptance criterion found in the sources. Stable ids `I-n`, criteria ids `C-n`. Mark `ui: true` for anything verified in a browser. The inventory is the authority for ids; the change cites them.
2. The change at `openspec/changes/{{spec.change}}/`. If the folder already exists, keep it and amend it; otherwise write it:
   - `proposal.md`: `## Why`, `## What Changes`, `## Impact` (affected specs and code).
   - `specs/<capability>/spec.md`: one file per capability under `openspec/specs/`. Delta headers only: `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`. Each `### Requirement: <name>` has one sentence with SHALL or MUST and at least one `#### Scenario: <name>` with `- **WHEN** ...` and `- **THEN** ...` bullets. Cite the criterion ids a scenario covers, for example `(C-3)`. A MODIFIED requirement repeats the full requirement as it will read afterwards.
   - `tasks.md`: `## 1. <Section>` headings and `- [ ] 1.1 <task> (I-n, C-n)` lines. Every task cites at least one inventory id. Leave every box unticked; `harness record` ticks them.
   If `openspec/config.yaml` does not exist, create it with the single line `schema: spec-driven`.
3. `{{cli}} spec check`. It validates the change (`openspec validate --strict`), confirms every in-scope criterion is cited somewhere in the change and every task cites an id, and lists the tasks. Fix what it reports and run it again until `ok` is true.
4. `.harness/plan.json` (schema: `schemas/plan.schema.json`). Slices `S-n` with `criteria` (C ids), `paths` (globs the slice may touch), `dependsOn`, `ui`, and `tasks`: the task ids from `tasks.md` the slice completes. Every task belongs to exactly one slice. Open questions become `questions`: `kind: "default"` with `chosen` when a sensible default exists, `kind: "hold"` with `blocks` when only a human can answer.
5. `.harness/goal-card.md`: the sentence verbatim, sources, the change path, scope counts, slice list with tasks, estimate, defaults applied, holds. Print it to the user.
Then run `{{cli}} next`. The spec reviewer judges the change before the human sees the card; approval commits the change to the goal branch.
