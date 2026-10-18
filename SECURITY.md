# Security

handoff-harness drives Claude Code sessions that edit code, run commands and use a browser, so its guards are the security surface. They are Node scripts under `scripts/hooks/` and `scripts/lib/guards/`, run by Claude Code's hooks before and after every tool call, and [docs/rules.md](docs/rules.md) lists each rule with the failure that motivated it.

What the guards promise, in every stage of a run:

- No secrets written: a credential scan runs after every file write and again in preflight, and text typed into the browser is scanned too.
- No sensitive paths read: dotenv files, keys, certificates and credential files are never read, inside or outside the project.
- No pushes outside the goal branch, never to the default branch; no history rewrites; no bulk staging or bulk pushes.
- The browser is read-only outside the fixture and preview hosts, and production hosts need `--prod` on the goal.

A guard escape is a run that did one of those things anyway. Report it as a [field issue](https://github.com/Marron-uno/handoff-harness/issues/new?template=field-issue.md): the run, the stage, the command or file, what the guard did and what it should have done. If the report would itself expose a secret or a private path, use the contact address on [marron.uno](https://marron.uno) instead and say it concerns handoff-harness.

The guards are deterministic and the recorded runs under `docs/runs/` show what they denied, but they are not a sandbox. A run has the permissions of the Claude Code session that starts it. Run goals in a checkout you can afford to lose, and review the goal branch before merging it.
