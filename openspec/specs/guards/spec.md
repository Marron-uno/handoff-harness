# Guards

## Purpose

Deterministic denials at the tool-call boundary. Enforced by the PreToolUse and PostToolUse hooks through `scripts/lib/guards/`; the catalog with the motivating failures is `docs/rules.md`.

## Requirements

### Requirement: No history rewrites and no bulk staging

The git guard SHALL deny `commit --amend`, `rebase`, `reset --hard`, force pushes, branch deletion and `filter-branch`, and SHALL deny `git add -A`, `git add .` and `git add --all`. During a goal it SHALL deny pushes to any branch other than the goal branch, switches to the default branch, and discards such as `checkout -- .`. When the goal rests in `done`, branches other than the default branch MAY be switched to and pushed; the default branch SHALL never be pushed from a session.

#### Scenario: Force push

- **WHEN** the model runs `git push --force origin goal/G-1`
- **THEN** the hook denies the call and records a guard event naming the git guard

#### Scenario: Push after done

- **WHEN** the goal is done and the session pushes a new branch
- **THEN** the hook allows it, and a push of the default branch is still denied

### Requirement: Protected and sensitive paths

The path guard SHALL deny writes to `openspec/specs/**`, `.claude/**`, `CLAUDE.md`, `AGENTS.md` and the harness state files, SHALL deny writes under the plugin root from inside a run, and SHALL deny reads of `.env*`, key and credential files inside or outside the project. A test file (`*.test.*`, `*.spec.*`) SHALL NOT match a sensitive-path glob by name.

#### Scenario: Harness file from inside a run

- **WHEN** the model edits a file under the plugin root during a goal
- **THEN** the hook denies it and points at `.harness/proposals/`

#### Scenario: Test named after the guard it tests

- **WHEN** the model reads `tests/browser-secret.test.mjs`
- **THEN** the read is allowed, while a read of `config/secrets.json` is still denied

### Requirement: Lanes per stage and per judge

The path guard SHALL deny source edits inside the project in the preflight, critic, review, spec_review, record, report and resting stages other than `done`, and SHALL let a judge subagent write inside the project only under `.harness/verdicts/` and `.harness/evidence/`. A path outside the project SHALL NOT be denied by a lane. In `done`, source edits SHALL be allowed on any branch except the default branch and the goal branch.

#### Scenario: Judge edits source

- **WHEN** the critic subagent writes to `src/notes.mjs`
- **THEN** the hook denies the write

#### Scenario: Notes outside the project during review

- **WHEN** the main session writes a file under the session scratchpad while the stage is review
- **THEN** the write is allowed

#### Scenario: Follow-up after done

- **WHEN** the goal is done and the session edits a source file on a new branch
- **THEN** the edit is allowed, while the same edit on the default branch or the goal branch is denied with the reason

### Requirement: Browser lane

The browser guard SHALL allow typing and page scripts only on fixture and preview hosts, SHALL require `--prod` on the goal before a production host is opened, SHALL scan typed text for credentials, and SHALL cap browser actions per review, with the counter reset each time the review stage starts.

#### Scenario: Form input on production

- **WHEN** the reviewer sends `form_input` to a host in the prod list
- **THEN** the hook denies it

#### Scenario: Second review

- **WHEN** a review used its whole action budget and the slice comes back for another round
- **THEN** the next review starts with the counter at zero

### Requirement: English and no secrets in what agents write

PostToolUse SHALL reject a written file whose prose paragraphs are not English by function-word count, and SHALL reject a write that contains a credential pattern outside the fixture allow list. The reason SHALL go back to the model as feedback.

#### Scenario: Spanish paragraph

- **WHEN** a brief or spec is written with a paragraph in Spanish
- **THEN** the hook returns the language reason and the file is treated as not written

### Requirement: The harness edits its own repository only under a frozen enforcer

The path guard SHALL keep denying writes under the enforcing plugin root. When the project is a checkout of the harness and the enforcing copy is a different directory, writes to the checkout SHALL be allowed like any project's files; when the enforcing copy is the project itself, the denial SHALL say to drive the run with a frozen copy.

#### Scenario: Frozen copy enforces

- **WHEN** the project directory holds the harness's `.claude-plugin/plugin.json` and the plugin root is a different copy
- **THEN** a write to `scripts/lib/preflight.mjs` in the project is allowed

#### Scenario: Same copy

- **WHEN** the plugin root is the project directory
- **THEN** the write is denied and the reason names `--plugin-root`

### Requirement: The Bash guard judges command lines, not prose

The Bash guard SHALL leave out of the judged text the body of a heredoc that its command only writes to a file (`cat` with a redirect, `tee` with a file argument), and SHALL keep scanning in full a heredoc fed to a shell, an interpreter or any other command.

#### Scenario: Prose in a cat heredoc

- **WHEN** the model runs `cat > notes.md <<'EOF'` with a body that mentions a forced push and `config/secrets.json`
- **THEN** the hook allows the call (C-1)

#### Scenario: Prose in a tee heredoc

- **WHEN** the model runs `tee notes.md <<'EOF'` with a body that mentions `git reset --hard`
- **THEN** the hook allows the call (C-1)

#### Scenario: Heredoc fed to a shell

- **WHEN** the model runs `bash <<'EOF'` with a body that runs `git reset --hard`
- **THEN** the hook denies the call and names the git guard (C-2)

#### Scenario: Heredoc fed to an interpreter

- **WHEN** the model runs `node <<'EOF'` or `python3 <<'EOF'` with a body that runs a denied command
- **THEN** the hook denies the call (C-2)

#### Scenario: Each case has a test

- **WHEN** `npm test` runs
- **THEN** `tests/bash-prose.test.mjs` exercises the cat, tee, shell and interpreter cases (C-4)

#### Scenario: Rules catalog

- **WHEN** a reader opens `docs/rules.md`
- **THEN** it has a row stating that the Bash guard judges command lines, not prose, with the failure that motivated it (C-5)
