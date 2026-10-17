import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const HARNESS_DIR = ".harness";

export function pluginRoot() {
  if (process.env.CLAUDE_PLUGIN_ROOT) return process.env.CLAUDE_PLUGIN_ROOT;
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

// The project root from any directory inside it: the nearest ancestor holding .harness/state.json,
// no further up than the git top level, else the top level itself, else the start. The CLI and the
// hooks resolve through it, so a command run from a subfolder sees the same work hash as one run at
// the root. Without it, `git diff HEAD`, `ls-files` and `ls-tree` all scope to the current directory
// and a reviewer that changed directory before `verdict validate` was told its verdict was stale.
// The walk never crosses a repository boundary: a fixture copy or a bench run nested under a harness
// project is its own project, not the parent's.
export function findProjectRoot(start = process.cwd()) {
  const from = resolve(start);
  // The common case, a command run at the project root, costs no git call.
  if (existsSync(join(from, HARNESS_DIR, "state.json"))) return from;
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: from, encoding: "utf8" });
  const top = r.status === 0 ? r.stdout.trim() : "";
  if (!top) return from;
  let cur = from;
  for (;;) {
    if (existsSync(join(cur, HARNESS_DIR, "state.json"))) return cur;
    if (samePath(cur, top)) break;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return samePath(top, from) ? from : top;
}

export function projectDir(input = {}) {
  return findProjectRoot(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

export function harnessPaths(cwd) {
  const dir = join(cwd, HARNESS_DIR);
  return {
    dir,
    state: join(dir, "state.json"),
    events: join(dir, "events.jsonl"),
    profile: join(dir, "profile.json"),
    plan: join(dir, "plan.json"),
    inventory: join(dir, "inventory.json"),
    goalCard: join(dir, "goal-card.md"),
    preflight: join(dir, "preflight.json"),
    reconcile: join(dir, "reconcile.json"),
    report: join(dir, "report.md"),
    lessons: join(dir, "lessons.md"),
    verdicts: join(dir, "verdicts"),
    evidence: join(dir, "evidence"),
    packets: join(dir, "packets"),
    usage: join(dir, "usage.json"),
    runs: join(dir, "runs"),
    jev: join(dir, "jev.jsonl"),
    pluginRoot: join(dir, "plugin-root"),
  };
}

// Same directory, through symlinks (macOS keeps /var and /private/var apart until resolved) and
// through letter case (the native call folds it on a case-insensitive filesystem).
export function samePath(a, b) {
  const real = (p) => { try { return realpathSync.native(resolve(p)); } catch { return resolve(p); } };
  return Boolean(a && b) && real(a) === real(b);
}

export function hasHarness(cwd) {
  return existsSync(join(cwd, HARNESS_DIR, "state.json"));
}
