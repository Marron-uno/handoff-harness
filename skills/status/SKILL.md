---
name: status
description: Show the current handoff-harness goal, stage, slice, guards and holds.
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.mjs" goal status` and summarize the JSON for the user in a few lines: goal sentence, stage, active slice and attempt, slices done of total, review rounds, holds, and the halt reason if the run is resting. If `.harness/usage.json` exists, add the total cost so far. Do not change anything.
