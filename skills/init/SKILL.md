---
name: init
description: Prepare a repository for handoff-harness. Creates .harness/profile.json, adds the gitignore block, commits them, and explains what to fill in.
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.mjs" init`. It creates `.harness/` with a profile, adds the ignore block to `.gitignore`, and commits both.

Then open `.harness/profile.json` and help the user fill in, in English:

- `checks`: the project's deterministic commands, for example `{ "id": "test", "command": "npm test" }`, `{ "id": "lint", "command": "npm run lint" }`, `{ "id": "typecheck", "command": "npx tsc --noEmit" }`. Preflight runs them in order.
- `hosts.preview` and `hosts.prod`: hostnames the reviewer may open. Outside `fixture` hosts (localhost) the browser is read-only. Prod also needs `--prod` on the goal.
- `secrets.allow`: fixture credentials that are safe by construction, so the secret scan does not flag them.
- `language.exemptGlobs`: files that legitimately hold another language (non-English locale files, verbatim client copy).
- Optional overrides for `caps`, `budgets`, `models`, `jev`.

Every value merges over `${CLAUDE_PLUGIN_ROOT}/profiles/default.json`. Explain that `.harness/state.json` and `events.jsonl` are run artifacts and stay out of git, while `profile.json`, `lessons.md`, `proposals/` and `reports/` are committed.
