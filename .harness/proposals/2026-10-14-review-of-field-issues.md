# Proposal: adversarial review for guard-bearing changes

Source: the independent review of the `fix/field-issues` branch (version 0.5.0), 2026-10-14. Not a run; a review of the harness's own fixes, read-only, with probe scripts.

## What the review found

The branch closed fifteen field issues. Two of the fixes widened guards: lanes stopped applying to paths outside the project, and a goal resting in `done` became dormant. The author's review confirmed that each fix did what its issue asked, and the author's fourteen regression tests passed. The reviewer, starting with fresh context and the diff, probed the widened exemptions and found:

- block: a path spelled with different letter case resolved as outside the project on a case-insensitive filesystem and skipped every lane, since `realpathSync` does not fold case;
- major: any stage or judge could write under `~/.claude` or to a `CLAUDE.md` anywhere;
- major: a push of every branch carried the default branch along in the dormant stage;
- minor: a report-ranking regression test passed with its fix reverted, because directory order agreed with the intended ranking.

## Findings

### F-1 The review asks the wrong question of a guard change

Cause: `briefs/review.md` asks the reviewer to judge each criterion. For a change that widens a deny rule, the criteria describe what should now pass; nothing asks what else passes.
Change: a profile list of guard-bearing paths; a slice touching one gets `briefs/review-adversarial.md` and the strong reviewer from round one.
Hypothesis: `guardBearingSlices` reported; defects found by an independent review after a pass on such a slice, down, counted by hand until a review step is recorded in the events log.

### F-2 Judges may pass a guard claim by reading

Cause: the validator accepts a met criterion on a `file` quote.
Change: on a guard-bearing slice, a met criterion and a block or major finding need evidence of type `command` or `test`.
Hypothesis: `invalidVerdicts` up at first on guard-bearing slices, then down as the briefs take hold.

### F-3 A test that cannot fail is accepted as coverage

Cause: nothing runs the slice's tests against the tree before the slice.
Change: preflight check `tests_discriminate`, a detached worktree at the slice's start commit with the changed tests copied in.
Hypothesis: `discriminationFailures` reported; each one is a tautological test caught before a judge saw it.

### F-4 Environment facts are assumed

Cause: whether the filesystem folds case was discovered by a probe, not stated anywhere.
Change: the packet's environment section.
Hypothesis: none measurable; it removes one class of assumption.

### F-5 The harness's own guard changes bypassed the harness

Cause: the fixes were built directly because the installed copy's bugs made a self-run painful.
Change: a proposal rule in `openspec/config.yaml`: guard-bearing changes land through a goal, or the proposal says why not.
