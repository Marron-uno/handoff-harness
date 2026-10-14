import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, realpathSync } from "node:fs";

export const HARNESS_DIR = ".harness";

export function pluginRoot() {
  if (process.env.CLAUDE_PLUGIN_ROOT) return process.env.CLAUDE_PLUGIN_ROOT;
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function projectDir(input = {}) {
  return input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
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
    jev: join(dir, "jev.jsonl"),
    pluginRoot: join(dir, "plugin-root"),
  };
}

// Same directory, through symlinks (macOS keeps /var and /private/var apart until resolved).
export function samePath(a, b) {
  const real = (p) => { try { return realpathSync(resolve(p)); } catch { return resolve(p); } };
  return Boolean(a && b) && real(a) === real(b);
}

export function hasHarness(cwd) {
  return existsSync(join(cwd, HARNESS_DIR, "state.json"));
}
