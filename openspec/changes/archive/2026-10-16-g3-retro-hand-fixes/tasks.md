## 1. State machine

- [x] 1.1 `goal new` keeps the previous goal under `.harness/runs/<id>/` and numbers past every known id; `slice skip` clears the halt; the empty record brief and `record` name `harness next` (`scripts/cli.mjs`, `scripts/lib/paths.mjs`, `scripts/lib/machine.mjs`, `briefs/record-advance.md`; `tests/g3-retro.test.mjs`: R-2, R-4; `tests/e2e-machine.test.mjs`)

## 2. Criteria

- [x] 2.1 One module decides which verdicts count; the report prints `skipped`; the reconcile input reads the same verdicts (`scripts/lib/criteria.mjs`, `scripts/lib/report.mjs`, `scripts/lib/reconcile.mjs`; `tests/g3-retro.test.mjs`: R-5; `tests/field-issues.test.mjs`: issue 12)

## 3. Cost

- [x] 3.1 Rows count between the goal's `new` and `done` events, subagent rows by the time of their event (`scripts/lib/usage.mjs`; `tests/usage.test.mjs`)

## 4. Docs

- [x] 4.1 `docs/rules.md` rows, `docs/architecture.md`, version 0.5.2 in `package.json`, `package-lock.json` and `.claude-plugin/plugin.json`
