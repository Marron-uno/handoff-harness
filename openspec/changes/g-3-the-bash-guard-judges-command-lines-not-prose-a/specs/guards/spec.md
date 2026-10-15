## ADDED Requirements

### Requirement: The Bash guard judges command lines, not prose

The Bash guard SHALL leave out of the judged text the body of a heredoc that its command only writes to a file (`cat` with a redirect, `tee` with a file argument), SHALL keep scanning in full a heredoc fed to a shell, an interpreter or any other command, and SHALL match the push deny pattern and the push rule within a single line.

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

#### Scenario: Push followed by prose

- **WHEN** the model pushes the goal branch and a later line of the same command contains words such as `fix:` or `--all`
- **THEN** the deny pattern and the push rule judge only the push line, and the call is allowed (C-3)

#### Scenario: Push on a later line still denied

- **WHEN** a command has a force push of the goal branch on its second line
- **THEN** the hook denies the call (C-3)

#### Scenario: Each case has a test

- **WHEN** `npm test` runs
- **THEN** `tests/bash-prose.test.mjs` exercises the cat, tee, shell, interpreter and push-then-prose cases (C-4)

#### Scenario: Rules catalog

- **WHEN** a reader opens `docs/rules.md`
- **THEN** it has a row stating that the Bash guard judges command lines, not prose, with the failure that motivated it (C-5)
