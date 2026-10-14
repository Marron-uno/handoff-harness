## Stage: intake ({{goal.id}})

Goal sentence: "{{goal.sentence}}"

Still missing or invalid:
- {{missing}}

Produce, in this order, without editing source code:
1. `.harness/inventory.json` (schema: `schemas/inventory.schema.json` in the plugin). One item per screen, block, endpoint, string or acceptance criterion found in the sources. Stable ids `I-n`, criteria ids `C-n`. Mark `ui: true` for anything verified in a browser.
2. `.harness/plan.json` (schema: `schemas/plan.schema.json`). Slices `S-n` with `criteria` (C ids), `paths` (globs the slice may touch), `dependsOn`, `ui`. Open questions become `questions`: `kind: "default"` with `chosen` when a sensible default exists, `kind: "hold"` with `blocks` when only a human can answer. A hold blocks a slice only when that slice cannot be built or verified without the answer: a deployment URL or a production host never blocks building and verifying a page on the dev server, so such a hold has `blocks: []`.
3. `.harness/goal-card.md`: the sentence verbatim, sources, scope counts, slice list, estimate, defaults applied, holds. Print it to the user.
Then stop. The human approves with `{{cli}} goal approve`.
