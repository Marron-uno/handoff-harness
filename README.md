# Handoff Harness

A Claude Code plugin that turns a handoff (a design package, a prose spec, or a feature request) into reviewed, committed code through fixed stages, under deterministic guards.

Work in progress. The design is settled; the code is landing commit by commit.

What it will do:

- **Stages, not vibes.** Intake, spec, plan, human gate, build, preflight, critic, review, record, reconcile, report. Each transition is decided by a script that reads `state.json`, never by the model declaring itself done.
- **Verdicts as JSON.** Critics and reviewers are read-only subagents that write a verdict file with findings, authority, and evidence. A validator rejects a pass that lists a defect.
- **Deterministic guards in hooks.** Git history is never rewritten, secrets never get written, prose stays in English, browsers stay read-only outside the fixture, budgets stop runaway loops.
- **Cost per stage.** Token usage is attributed from the transcript so every run ends with a bill per stage.
- **Optional Jev layer.** A calibrated decision model routes verdicts and prefilters reconciliation. It never grants a pass.

Install (Claude Code 2.1.275 or later):

```
/plugin install handoff-harness --marketplace Marron-uno/handoff-harness
```

License: MIT.
