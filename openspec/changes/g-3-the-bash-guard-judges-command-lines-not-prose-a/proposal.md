# Change: The Bash guard judges command lines, not prose

## Why

The Bash guard runs its deny patterns, the push rule and the sensitive-path scan over the whole command string. A command that only writes prose to a file, such as `cat > notes.md` with a heredoc whose body mentions a forced push or `config/secrets.json`, is therefore denied for words that no shell will ever execute. The push deny pattern and the push rule also use `[^|;&]*`, which crosses newlines, so a push on one line followed by prose on the next is read as a push with those words as arguments. The motivating shape is the field issues in `docs/field-issues.md` (the angar run): notes and commit messages written through heredocs were denied as commands. This very intake hit it: writing the change files through a heredoc was denied.

## What Changes

- `checkBashCommand` removes the body and terminator of a heredoc whose command only writes to a file (`cat` with a redirect, `tee` with a file argument) before the deny patterns, the push rule and the sensitive-path scan run. Any other command keeps its heredoc in the text, so a heredoc fed to `bash`, `sh`, `zsh`, `node`, `python` or an unknown command is still scanned in full.
- The push deny pattern in `profiles/default.json` and the push rule in the git guard match within a single line.
- `tests/bash-prose.test.mjs` covers a `cat` heredoc, a `tee` heredoc, a heredoc fed to a shell, a heredoc fed to an interpreter, and a push followed by prose on another line.
- `docs/rules.md` gains a row for the rule.

## Hypothesis

`guardDenials: down`: fewer denials on runs that write notes through heredocs. The replay tier cannot measure this change; the regressions are in `tests/bash-prose.test.mjs`. The risk is the opposite direction, a command smuggled inside a stripped body, which the tests for the shell and interpreter cases and the adversarial review cover.

## Landing

The change touches guard-bearing paths (`scripts/lib/guards`, `profiles`). It lands through goal G-3 on this checkout under the installed copy, so the adversarial review applies.

## Out of scope

Parsing shell grammar beyond heredocs (here-strings, command substitution, quoted newlines). Changing any other deny pattern.

## Impact

- Specs: `guards` (added requirement)
- Code: `scripts/lib/guards/git-guard.mjs`, `profiles/default.json`, `tests/bash-prose.test.mjs`
- Docs: `docs/rules.md`
