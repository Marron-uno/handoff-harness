---
name: Proposal
about: A change to the harness, in the shape of a .harness/proposals/ file
title: "proposal: "
labels: proposal
---

<!-- The same shape as a proposal that /handoff-harness:retro writes under .harness/proposals/: a source, what it showed, then findings with stable ids, each with evidence, a cause, the smallest change, and a hypothesis that a replay eval or the bench can check (docs/evals.md). -->

**Source:** <!-- the recorded run, retro proposal or review that motivates it, with the harness version -->

**What it showed:** <!-- two or three sentences; cite the run folder, the events log or the verdict -->

## Findings

### F-1 <title>

- Evidence: <!-- the event, verdict or denial, quoted -->
- Cause: <!-- file and function -->
- Change: <!-- the smallest change that removes the cause; a guard-bearing path (scripts/lib/guards, scripts/hooks, profiles, schemas) lands through a goal run on this checkout -->
- Hypothesis: <!-- a metric from scripts/lib/metrics.mjs and a direction, for example invalidVerdicts down -->
