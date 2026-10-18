---
name: Field issue
about: A harness defect met while running a real goal
title: "field issue: "
labels: field-issue
---

<!-- One defect per issue. The same fields make a row in docs/field-issues.md, and a fix comes with one regression test in tests/field-issues.test.mjs. -->

**Run and goal:** <!-- the project or recorded run, the goal id, the harness version from .claude-plugin/plugin.json -->

**Stage:** <!-- intake, spec_review, building, preflight, critic, review, record, reconcile, report, or the resting stage -->

**Command or file:** <!-- the tool call the guard judged, or the file the stage wrote or read -->

**What the guard did:** <!-- the denial, block or halt as logged in .harness/events.jsonl, with its code -->

**What it should have done:**

**Workaround used in the run:**

**Proposed fix:** <!-- file and function if known -->
