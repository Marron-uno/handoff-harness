# Evals

Three tiers, three questions. `docs/evals.md` explains them; this folder holds the files.

- `tests/replay.test.mjs` (in `npm test`): the current code against the recorded runs in `docs/runs/`, driven by each run's `expect.json`. Free, in CI.
- `scripts/eval/bench.mjs` and `scripts/eval/compare.mjs`: N headless runs of the fixture goal per arm, compared metric by metric and against a proposal's hypotheses. Paid, manual. Results land in `evals/bench/<label>/`, ignored by git; copy a bench worth keeping under `docs/runs/`.
- `claude plugin eval . --case goal-intake --scaffold --allow-tools Bash Write Edit Read Glob Grep Skill --trust-plugin --no-publish`: Claude Code's own eval runner on the goal skill. Each run is a full session; results land in `evals/results/`, ignored by git. On macOS the runner's sandbox blocks the Xcode `git` shim, so the case fails at init there; run it on Linux or with a standalone git on the PATH.
