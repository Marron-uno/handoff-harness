# Guards

## Purpose

Deterministic denials at the tool-call boundary. Enforced by the PreToolUse and PostToolUse hooks through `scripts/lib/guards/`; the catalog with the motivating failures is `docs/rules.md`.

## Requirements

### Requirement: No history rewrites and no bulk staging

The git guard SHALL deny `commit --amend`, `rebase`, `reset --hard`, force pushes, branch deletion and `filter-branch`, and SHALL deny `git add -A`, `git add .` and `git add --all`. It SHALL deny pushes to any branch other than the goal branch and discards such as `checkout -- .`.

#### Scenario: Force push

- **WHEN** the model runs `git push --force origin goal/G-1`
- **THEN** the hook denies the call and records a guard event naming the git guard

### Requirement: Protected and sensitive paths

The path guard SHALL deny writes to `openspec/specs/**`, `.claude/**`, `CLAUDE.md`, `AGENTS.md` and the harness state files, SHALL deny writes under the plugin root from inside a run, and SHALL deny reads of `.env*`, key and credential files.

#### Scenario: Harness file from inside a run

- **WHEN** the model edits a file under the plugin root during a goal
- **THEN** the hook denies it and points at `.harness/proposals/`

### Requirement: Lanes per stage and per judge

The path guard SHALL deny source edits in the preflight, critic, review, spec_review, record, report and resting stages, and SHALL allow a judge subagent to write only under `.harness/verdicts/` and `.harness/evidence/`.

#### Scenario: Judge edits source

- **WHEN** the critic subagent writes to `src/notes.mjs`
- **THEN** the hook denies the write

### Requirement: Browser lane

The browser guard SHALL allow typing and page scripts only on fixture and preview hosts, SHALL require `--prod` on the goal before a production host is opened, SHALL scan typed text for credentials, and SHALL cap browser actions per review.

#### Scenario: Form input on production

- **WHEN** the reviewer sends `form_input` to a host in the prod list
- **THEN** the hook denies it

### Requirement: English and no secrets in what agents write

PostToolUse SHALL reject a written file whose prose paragraphs are not English by function-word count, and SHALL reject a write that contains a credential pattern outside the fixture allow list. The reason SHALL go back to the model as feedback.

#### Scenario: Spanish paragraph

- **WHEN** a brief or spec is written with a paragraph in Spanish
- **THEN** the hook returns the language reason and the file is treated as not written
