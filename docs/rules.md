# Deterministic rules

Every rule below is enforced by a script, not by a prompt. The column "where" names the hook or stage that enforces it; "evidence" names the kind of failure in real projects that motivated it.

| Rule | Where | Evidence |
|---|---|---|
| No history rewrites: amend, rebase, reset --hard, force push, branch -D, filter-branch | PreToolUse git guard | Rewrites hide what the agent did; the events log would lie |
| No bulk staging: `git add -A`, `git add .`, `git add --all` | PreToolUse git guard | A bulk add swept untracked screenshots with real names into a commit |
| Push only the goal branch; never the default branch | PreToolUse git guard | Goal work must stay reviewable as one branch |
| No edits on the default branch during a goal | PreToolUse path guard | Same |
| No discard commands: `checkout -- .`, `restore .` | PreToolUse git guard | Discards destroy evidence of an oscillation |
| Destructive shell patterns denied (`rm -rf /`, `curl \| sh`, `dd if=`) | PreToolUse shell guard | Project deny lists |
| State files written only through the CLI | PreToolUse git and path guards | state.json is the single source of truth |
| Protected paths: `openspec/specs/**`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, harness state | PreToolUse path guard | The spec is the contract; the pipeline owns only its change folder |
| Harness files read-only from inside a run; changes go to `.harness/proposals/` | PreToolUse path guard | The harness must not rewrite its own rules mid-run |
| Sensitive paths never read: `.env*`, keys, credentials | PreToolUse git and path guards | Nothing real may leak into a transcript |
| Judges (critic, reviewer, reconciler) write only verdicts and evidence | PreToolUse path guard | A judge that fixes is no longer a judge |
| Stage lanes: no source edits in preflight, critic, review, record, report, resting stages | PreToolUse path guard | Edits between judge and record make verdicts stale |
| Tool-call budget per stage | PreToolUse | A stage that runs long is a stall, not diligence |
| Browser read-only outside fixture and preview hosts | PreToolUse browser guard | The reviewer uses the owner's logged-in browser |
| Prod hosts need `--prod` on the goal | PreToolUse browser guard | Explicit opt-in per goal |
| Typed text is scanned for credentials | PreToolUse browser guard | Fixture values only |
| Browser action budget per review | PreToolUse browser guard | Browser steps are slow |
| English everywhere agents write, by function-word count | PostToolUse, preflight, verdict validator | Specs drifted into Spanish within weeks |
| No secrets written | PostToolUse, preflight | Seed passwords found in committed hooks |
| No em dashes, no banned phrases in prose | PostToolUse, preflight | Prose quality rule |
| Diff budget per slice | preflight | Big diffs hide behavior changes |
| Slice edits stay inside declared paths | preflight | Undeclared scope creep |
| Dependency manifests change only when declared | preflight | Undeclared dependencies |
| Tests never weakened: no deleted test files, no skips, no net removal | preflight | Agents delete failing tests |
| OpenSpec validate when `openspec/` exists | preflight | Spec and change folders stay consistent |
| Project checks (`npm test`, lint, typecheck) from the profile | preflight | Mechanical feedback before any model judges |
| Verdict schema; pass cannot carry a block finding or an unmet criterion | verdict validator | Prose verdicts said "LGTM" with defects listed below |
| Verdict work hash must match the current change set | verdict validator | Judging a different diff |
| Evidence paths must exist | verdict validator | Invented evidence |
| Attempt cap per slice, then a human | Stop hook | Infinite fix loops |
| Review rounds cap, raisable by a human (`authorize-rounds`) | Stop hook | Rounds 4 to 6 caught real bugs once; the cap is a gate, not a wall |
| Runaway cap below Claude Code's 8 continuations | Stop hook | A hook that blocks forever gets cut off anyway |
| Oscillation on the work hash (A B A B) | Stop hook | Revert loops |
| Time and cost budgets per goal | Stop hook | Spend is attributed, so it can be capped |
| Goal completion is a script predicate | `goal check` | The model never declares itself done |
| Harness artifacts never count as work | work hash | Writing a report must not make a verdict stale |
