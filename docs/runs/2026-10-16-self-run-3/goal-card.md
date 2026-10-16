# Goal card: G-3

**Goal:** "the Bash guard judges command lines, not prose: a heredoc body that a command only writes to a file (cat or tee with a redirect) is left out of the text before the deny patterns, the push rule and the sensitive-path scan run, a heredoc fed to a shell or an interpreter is still scanned, the push deny pattern and the push rule match within one line, with tests for each case and a rules.md row"

**Sources:** none; the goal sentence is the source
**Change:** `openspec/changes/g-3-the-bash-guard-judges-command-lines-not-prose-a/` (proposal, `specs/guards/spec.md` with 1 added requirement and 8 scenarios, `tasks.md` with 4 tasks)

## Scope
- 4 inventory items (I-1 to I-4), 5 criteria (C-1 to C-5), no UI

## Slices
- **S-1** Bash guard judges command lines: heredoc stripping, one-line push match, tests, rules row. Criteria C-1..C-5. Tasks 1.1, 1.2, 2.1, 3.1. Paths: `scripts/lib/guards/git-guard.mjs`, `profiles/default.json`, `tests/bash-prose.test.mjs`, `docs/rules.md`

## Estimate
About 2 USD and 15 minutes, one slice. The slice touches guard-bearing paths, so the adversarial review applies.

## Defaults applied
- D-1: only a file-writing `cat` or `tee` heredoc is stripped; any other command keeps its heredoc scanned
- D-2: `tee` must name a file and `cat` must redirect to one, otherwise the body stays in the text

## Holds
None.
