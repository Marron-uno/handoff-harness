# G-3: the Bash guard judges command lines, not prose: a heredoc body that a command only writes to a file (cat or tee with a redirect) is left out of the text before the deny patterns, the push rule and the sensitive-path scan run, a heredoc fed to a shell or an interpreter is still scanned, the push deny pattern and the push rule match within one line, with tests for each case and a rules.md row

Mode: feature. Branch: goal/G-3. Stage: report.

## Slices

| Slice | Title | Status | Attempts | Commit |
|---|---|---|---|---|
| S-1 | Bash guard judges command lines: heredoc stripping, one-line push match, tests, rules row | skipped | 6 |  |

## Spec

OpenSpec change: `openspec/changes/g-3-the-bash-guard-judges-command-lines-not-prose-a`. 1 requirement(s), 8 scenario(s), 4 task(s), 5/5 criteria cited, validate pass

Spec review: pass, pass over 1 attempt(s). Committed at approval: a23682c.

Tasks ticked: 3 of 3.

Archive by hand when the branch merges: `openspec archive g-3-the-bash-guard-judges-command-lines-not-prose-a --yes`.

## Criteria

| Criterion | Status |
|---|---|
| C-1 | met |
| C-2 | met |
| C-3 | met |
| C-4 | met |
| C-5 | met |

## Inventory coverage

done: 3, out_of_scope: 1

Missing after reconciliation: 0

## Cost per stage

| Stage | Calls | Input | Cache read | Output | USD |
|---|---|---|---|---|---|
| record | 14 | 420 | 1013294 | 13979 | 4.657 |
| reconcile | 11 | 250 | 1076073 | 8889 | 2.854 |
| spec_review | 2 | 14 | 51406 | 265 | 0.079 |
| critic | 14 | 244 | 4403468 | 13235 | 2.253 |
| review | 3 | 82 | 2086451 | 2291 | 1.366 |
| done | 1 | 354 | 1134218 | 97 | 6.822 |

Total from the price table: $18.031 (main session $7.256, subagents $10.775).
Reported by Claude Code: $23.787 over 4 headless session(s). This is the number of record; the table is an estimate.

## Defaults applied

- D-1: Which commands count as feeding a heredoc to a shell or interpreter? → Anything that is not cat or tee with a redirect keeps its heredoc scanned; only the file-writing shape is stripped, so an unknown command fails safe.
- D-2: Does a tee without a file argument count as writing to a file? → No; tee must name a file, and cat must redirect to a file, otherwise the body stays in the text.
- D-4 (S-1, human decision): Does C-3 (the push deny pattern and the push rule match within one line) stay in the goal after six attempts? → No. C-3 is cut; the push deny pattern and the push rule go back to the whole-text match, so a push followed by prose on a later line stays a known false positive. Each adversarial round found another shell mechanism carrying words across a newline into a push: open expansions and quotes (a4-r1), an unquoted heredoc rebuilt by xargs (a4-r2), git and push split across heredoc lines (a5), a global option value touching << (a6). The heredoc half (C-1, C-2) with tests (C-4) and the rules row (C-5) lands by hand on goal/G-3 as a pull request; the goal stays in awaiting_human.

## Run log

Stage transitions: 47. Stop-hook blocks: 0. Guard denials: 33. Halts: 4.

| Guard | Count |
|---|---|
| sensitive | 7 |
| git | 22 |
| lane | 3 |
| protected | 1 |

