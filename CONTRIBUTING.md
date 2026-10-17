# Contributing

handoff-harness is a Claude Code plugin: Node scripts with no runtime dependencies, tested with `node:test`. Every change lands through a branch and a pull request. `main` is never edited directly, and the harness's own guards enforce that in any checkout that runs it, this one included.

## Run the tests

```
npm ci
npm run check   # syntax-checks every script and test, then openspec validate --all --strict
npm test        # node --test over tests/, no network, no key, under a minute
```

Node 22 or later; CI runs both commands on Node 22 and 24.

## Add a field issue

A field issue is a harness defect met while running a real goal. It takes two things, in one pull request:

1. A row in the Open table of `docs/field-issues.md`: the issue, where it bites (file and function), the workaround used in the run, and the proposed fix. Name the run, the goal and the harness version.
2. One regression test in `tests/field-issues.test.mjs` that fails on `main` and passes with the fix. Preflight's `tests_discriminate` check asks the same of every slice: a test that passes without the change covers nothing.

When the fix lands, move the row to Fixed with the commit that closes it. Without a fix in hand, open an issue with the field-issue template; it asks for the same fields.

## Change the harness

What the scripts enforce is specified under `openspec/`, and a change to it goes through the harness's own change folder before the code:

- `openspec/specs/` is the contract and is read-only during a run. Write the change under `openspec/changes/<name>/` with `proposal.md`, delta specs and `tasks.md`. `openspec/config.yaml` says what the proposal must name: the recorded run or retro proposal that motivates it, and the hypothesis as a metric from `scripts/lib/metrics.mjs` with a direction.
- `npm run check` validates the change. The pull request carries the change folder and the code. Archiving the change into the specs (`openspec archive <name> --yes`) is its own commit after the merge.
- Every new rule gets a row in `docs/rules.md` with the failure that motivated it.

### Guard-bearing paths

`scripts/lib/guards/`, `scripts/hooks/`, `profiles/` and `schemas/` are guard-bearing: a change there widens or narrows what the harness allows. Such a change lands through a goal run on this checkout under the installed copy (`scripts/drive.mjs --plugin-root`), where the adversarial review brief and the strong reviewer apply from round one and every met criterion needs command or test evidence. If it cannot run that way, the proposal says why. Self-run 3 under `docs/runs/2026-10-16-self-run-3/` is the recorded example, including the part where the judges won.

## Style

English in everything, no em dashes, short declarative sentences; the PostToolUse hook and preflight check all three. Commit subjects take a type prefix (`fix:`, `feat:`, `docs:`, `spec:`, `chore:`) and say what is true after the commit, in lower case. Bump the version in `package.json`, `package-lock.json` and `.claude-plugin/plugin.json` together, since the plugin cache is keyed by version, and add a section to `CHANGELOG.md`.
