## 1. Metrics and retro

- [x] 1.1 `scripts/lib/metrics.mjs` with `tests/metrics.test.mjs` pinned to runs 1 to 3
- [x] 1.2 `harness retro`, `scripts/lib/retro.mjs`, `skills/retro/SKILL.md`, `tests/retro.test.mjs`
- [x] 1.3 Rejected verdicts kept under `.harness/verdicts/rejected/` (`tests/hooks.test.mjs`)

## 2. Evals

- [x] 2.1 `tests/replay.test.mjs` and `expect.json` for the three recorded runs
- [x] 2.2 `scripts/eval/bench.mjs` and `scripts/eval/compare.mjs` with `tests/evals.test.mjs`
- [x] 2.3 `evals/goal-intake` plugin eval case
- [x] 2.4 `docs/evals.md`

## 3. OpenSpec for the harness

- [x] 3.1 Baseline specs: state-machine, verdicts, guards, preflight, spec-stage, cost, holds
- [x] 3.2 `openspec validate --all --strict` in `npm run check`
