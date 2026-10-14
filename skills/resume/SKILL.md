---
name: resume
description: Resume a handoff-harness goal after a pause, a halt, a compaction, or a new session. Prints the current stage brief and continues.
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.mjs" resume`. The JSON carries `stage`, `halt` and `brief`.

- If `halt` is set, the run is resting for a human reason (attempt cap, review rounds cap, spec attempt cap, budget, runaway, oscillation, stale verdicts). Show the reason and the command that lifts it (`harness retry`, `harness retry --stage spec_review` after fixing a change by hand, `harness authorize-rounds N`, `harness goal budget --usd N --minutes N`, `harness slice skip --reason "..."`). Do not lift it yourself unless the user asks.
- Otherwise follow the `brief` literally: run the command it names or spawn the agent it names. Commands print the next brief; after a judge returns, run `harness next` for it. Stopping also works, since the Stop hook runs the same machine.
