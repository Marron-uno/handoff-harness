## 1. Bash guard

- [ ] 1.1 Drop the body of a file-writing `cat` or `tee` heredoc from the text before the deny patterns, the push rule and the sensitive-path scan; any other heredoc stays (`tests/bash-prose.test.mjs`) (I-1, C-1, C-2)
- [ ] 1.2 Make the push deny pattern in `profiles/default.json` and the push rule in `git-guard.mjs` match within one line (`tests/bash-prose.test.mjs`) (I-2, C-3)

## 2. Tests

- [ ] 2.1 `tests/bash-prose.test.mjs`: cat heredoc, tee heredoc, heredoc fed to a shell, heredoc fed to an interpreter, push then prose on another line (`tests/bash-prose.test.mjs`) (I-3, C-4)

## 3. Docs

- [ ] 3.1 Row in `docs/rules.md`: the Bash guard judges command lines, not prose (I-4, C-5)
