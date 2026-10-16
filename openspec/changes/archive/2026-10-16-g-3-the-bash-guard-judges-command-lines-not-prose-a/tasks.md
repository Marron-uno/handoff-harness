## 1. Bash guard

- [x] 1.1 Drop the body of a file-writing `cat` or `tee` heredoc from the text before the deny patterns, the push rule and the sensitive-path scan; any other heredoc stays (`tests/bash-prose.test.mjs`) (I-1, C-1, C-2)
- Task 1.2, the push deny pattern and the push rule matching within one line (I-2, C-3), was cut by a human on 2026-10-16 (decision D-4); the proposal's Out of scope says why

## 2. Tests

- [x] 2.1 `tests/bash-prose.test.mjs`: cat heredoc, tee heredoc, heredoc fed to a shell, heredoc fed to an interpreter (`tests/bash-prose.test.mjs`) (I-3, C-4)

## 3. Docs

- [x] 3.1 Row in `docs/rules.md`: the Bash guard judges command lines, not prose (I-4, C-5)
