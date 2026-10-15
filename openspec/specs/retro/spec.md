# retro Specification

## Purpose

After a run rests, `harness retro` turns its artifacts into a proposal for the harness itself: the run's metrics, the signals a script can see, and findings the model fills in with a cause by file, the smallest change, and a hypothesis as a metric and a direction. Enforced by `scripts/lib/retro.mjs`, `scripts/lib/metrics.mjs` and the retro skill; the proposal is the handoff to this repository's `openspec/`, and the retro never edits the harness.

## Requirements

### Requirement: A retro reads a resting run and writes a proposal

`harness retro` SHALL refuse to run while the goal is not in a resting stage unless `--force` is given. It SHALL compute the run's metrics and signals and write a proposal under `.harness/proposals/` with frontmatter, the metrics, the signals and a findings template with stable ids. It SHALL write no event and SHALL edit no other file.

#### Scenario: Run 3

- **WHEN** `harness retro` runs over the recorded run 3
- **THEN** the signals name the held slice S-3, the 2 of 7 rejected writes with the "expected object, got string" pattern, the critic's 8 and 10 tool calls and the 0.42 Jev near miss

#### Scenario: Mid-run

- **WHEN** `harness retro` runs while the stage is building
- **THEN** it refuses and names the stage

### Requirement: Signals are what a script can see

The retro SHALL list as signals: held slices, halts, Stop-hook blocks by code, guard denials with the denied command, rejected verdicts grouped by normalized error, judges that stopped more than once, critic tool calls at or over the threshold, a price ratio outside the accepted band, UI slices recorded without a screenshot, slices added by reconciliation, Jev answers within reach of a threshold, and skipped Jev calls.

#### Scenario: Clean run

- **WHEN** a run ends done with no blocks, denials, rejections or holds
- **THEN** the proposal says there are no signals and leaves the findings to the reader

### Requirement: Findings are causes with a hypothesis

The retro skill SHALL fill each finding with evidence it saw, a cause named by harness file, the smallest change to that file, and a hypothesis as a metric name from the metrics module and a direction. The harness's own files SHALL stay unedited by the retro.

#### Scenario: Rejected verdicts

- **WHEN** the signals show two rejected writes with evidence entries as strings
- **THEN** the finding names the critic brief as the cause and `invalidVerdicts: down` as the hypothesis
