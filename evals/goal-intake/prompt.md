---
name: goal-intake
tags: [skills, intake]
runs: 2
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

This repository is a small notes app with a handoff document at `handoff/HANDOFF.md`. Start a handoff-harness goal for it: run `/handoff-harness:init`, then `/handoff-harness:goal "build all of the handoff" --source handoff/HANDOFF.md`. Stop when the goal card is printed and the run is waiting for approval; do not approve it.
