---
name: goal
description: Start a handoff-harness goal from a sentence such as "build all of the handoff" or "implement the tag filter". Runs intake, prints the goal card, and waits for approval.
argument-hint: "<goal sentence>" [--source path]... [--mode handoff|feature] [--openspec [--change name]] [--prod] [--jev] [--auto-approve]
---

# /handoff-harness:goal

You are starting a goal run. The harness CLI is `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.mjs"`; call it `harness` below.

## 1. Create the goal

Run `harness init` if `.harness/profile.json` does not exist yet. Then:

```
harness goal new --sentence "$ARGUMENTS" [--source <path>]... [--mode feature] [--openspec [--change <name>]] [--prod] [--jev]
```

Pass the sentence exactly as the user wrote it. Pass every handoff document the user named with `--source`. Use `--mode feature` when the sentence describes a feature without a handoff document. Pass `--openspec` when the user wants the run to build from an OpenSpec change (the profile's `openspec.author` makes it the default; `--no-openspec` turns it off for one goal), and `--change <name>` when a change folder under `openspec/changes/` already exists for this work. The command creates the branch `goal/G-n` and the state file. From now on every state change goes through `harness`; never edit `.harness/state.json` by hand.

## 2. Intake

Produce three files, then stop. Do not touch source code in this stage.

1. `.harness/inventory.json` (schema `${CLAUDE_PLUGIN_ROOT}/schemas/inventory.schema.json`). Walk the sources and list every screen, block, endpoint, string and acceptance criterion as an item `I-n` with criteria `C-n`. Mark `ui: true` for anything that must be verified in a browser. In feature mode with no document, propose the criteria yourself and mark the inventory `sources: []`.
2. `.harness/plan.json` (schema `${CLAUDE_PLUGIN_ROOT}/schemas/plan.schema.json`). Slices `S-n` of one to a few items each, with `criteria` ids, `paths` globs, `dependsOn`, `ui`. Open questions go in `questions`: `kind: "default"` with a `chosen` value when a sensible default exists, `kind: "hold"` with `blocks` when only the human can answer. Holds block only the slices that need them.
3. `.harness/goal-card.md`: one card. The sentence verbatim, the goal id, sources, scope counts (items, criteria), the slice list with estimates, the defaults you will apply, the holds, the budget. Print the card to the user and ask them to approve, edit, or abort.

Then stop. The Stop hook verifies the three files and moves the run to `awaiting_approval`.

### With the spec stage on

The command's output says so, and the intake brief changes. Between the inventory and the plan you write (or amend) the OpenSpec change at `openspec/changes/<change>/`: `proposal.md`, one delta spec per capability under `specs/<capability>/spec.md` (`## ADDED Requirements` and friends, `### Requirement:` with a SHALL sentence, `#### Scenario:` with WHEN and THEN bullets), and `tasks.md` with `- [ ] 1.1 text (I-n, C-n)` lines. Cite the inventory ids; never touch `openspec/specs/**`. Run `harness spec check` until it says `ok`. Each slice in the plan lists the task ids it completes under `tasks`, and every task belongs to exactly one slice. Finish with `harness next`: the `spec-reviewer` subagent judges the change (spawn it by the name in the brief, foreground), and only a pass reaches the goal card. Approval commits the change; `harness record` ticks tasks; the goal is done when every task is ticked. Archiving the change is the human's step after the branch merges.

## 3. After approval

The human runs `harness goal approve` (or says "approve", in which case you run it). From then on, follow each brief literally. Commands that produce evidence (`harness slice done`, `harness preflight`, `harness record`, `harness reconcile load`, `harness report`) advance the run and print the next brief; after a judge returns, `harness next` does the same. Judges (critic, reviewer, reconciler) are subagents you spawn by the name in the brief, in the foreground when possible; never judge a slice yourself. If you stop instead, the Stop hook runs the same machine and injects the brief you would have been given.

Claude Code allows at most eight consecutive Stop-hook continuations, so a run that relies on stopping will pause; following the printed briefs avoids that. For an unattended run use `node "${CLAUDE_PLUGIN_ROOT}/scripts/drive.mjs"`, with `--chrome` when the reviewer needs a browser.

## What the harness guarantees

- A verdict that says pass while listing a defect is rejected by a script, not by you.
- Work hashes make stale verdicts and stale reconciliation visible.
- No history rewrites, no bulk staging, no pushes outside the goal branch, no edits on the default branch.
- English everywhere agents write; secrets never written; browser read-only outside fixture and preview hosts.
- Attempt caps, review-round caps, runaway and oscillation guards, time and cost budgets. When a cap trips, the run rests and waits for a human.
