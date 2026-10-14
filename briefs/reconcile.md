## Stage: reconcile ({{goal.id}})

Every slice is recorded. Walk the inventory against the tree:
1. `{{cli}} reconcile prepare` writes `.harness/reconcile-input.json` with deterministic evidence per item (and Jev buckets when enabled).
2. Spawn `handoff-harness:reconciler` with: "Read `.harness/reconcile-input.json`. For every item not already decided deterministically, decide done, partial or missing with evidence. Write `.harness/verdicts/reconcile.json` following `schemas/reconcile.schema.json`, `diffHash` from `{{cli}} hash`. Propose `newSlices` for missing or partial items."
3. `{{cli}} reconcile load` validates the result, adds slices, and prints the next brief. Follow it.
