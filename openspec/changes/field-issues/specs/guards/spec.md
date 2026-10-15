# Guards

## MODIFIED Requirements

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

The path guard SHALL deny source edits inside the project in the preflight, critic, review, spec_review, record, report and resting stages other than `done`, and SHALL allow a judge subagent to write inside the project only under `.harness/verdicts/` and `.harness/evidence/`. A path outside the project, such as the session scratchpad or another repository, SHALL NOT be denied by a lane. When the goal rests in `done`, source edits SHALL be allowed on any branch except the default branch and the goal branch.

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
