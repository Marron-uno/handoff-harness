---
name: retro
description: Retrospective on a finished handoff-harness run. Computes the run's metrics and signals, then writes ranked findings with a proposed harness change and a testable hypothesis each, into .harness/proposals/. Never edits the harness.
argument-hint: [--log <drive log>] [--force]
---

A retro runs after a goal rests (done, awaiting a human, halted, over budget). It produces one file, a proposal under `.harness/proposals/`, that the harness repo can take as the source of a change. You never edit harness files; the path guard denies it anyway.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.mjs" retro $ARGUMENTS`. It writes the proposal skeleton (metrics, mechanical signals, empty findings) and prints its path and the signals. If it refuses because the run is not resting, stop and say so; do not pass `--force` unless the user asks.
2. Read, in this order: the proposal skeleton, `.harness/report.md`, the output of `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.mjs" analyze`, the `verdict` events with `valid: false` (`... events --type verdict`), the `guard` and `halt` events, and any file a signal names. Read `.harness/verdicts/rejected/` when it exists: those are the verdicts the validator sent back.
3. Replace the findings template with real findings, most expensive failure first. A finding is a cause, not a symptom: "the critic brief does not say evidence entries are objects" is a finding; "two verdicts were invalid" is a signal. Each finding has exactly these lines: Evidence (event timestamps, file names, quoted lines; nothing you did not see), Cause (the brief, agent definition, rule or code path by file name under the plugin root), Proposed change (the smallest change to that file), Hypothesis (one metric name from the Metrics block and a direction, with the current value). A signal that is not worth a change goes under "Not changed" with one line of reason.
4. Keep the ids R-1, R-2, ... stable and the file in English. Do not edit any other file. Commit the proposal with the project if the user wants it tracked; `.harness/proposals/` is already committed by the init.
5. Print the proposal path and the finding titles. If the user wants the change made, tell them it belongs in the harness repository as an OpenSpec change with this proposal as `--source`; the evals there (`docs/evals.md` in the plugin) say how to check the hypotheses.
