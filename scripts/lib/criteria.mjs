// Which verdicts set a criterion's status, for the report and the reconcile input alike.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "./io.mjs";
import { harnessPaths } from "./paths.mjs";

// A slice verdict counts when it belongs to the active goal and to the recorded attempt of a slice
// that was not skipped. A pass left by an attempt a human retried past, or by a slice a human
// skipped, no longer marks a criterion: self-run 3's report and reconcile input took C-3 as met
// from the passes of attempt 4 on a slice skipped at attempt 6 (its retro, R-5).
export function verdictCounts(state, v) {
  if (!v || v.goal !== state.goal.id || !v.slice) return false;
  const slice = state.slices.find((s) => s.id === v.slice);
  return Boolean(slice) && slice.status !== "skipped" && (v.attempt ?? 0) === (slice.attempts ?? 0);
}

export function countedVerdicts(cwd, state) {
  const dir = harnessPaths(cwd).verdicts;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json") && !n.startsWith("reconcile") && !n.startsWith("spec-"))
    .map((n) => readJson(join(dir, n), null))
    .filter((v) => verdictCounts(state, v));
}

// Each criterion's status: within the recorded attempt a later round wins over an earlier one and
// the reviewer over the critic. The criteria of a skipped slice read `skipped` unless another
// slice's verdict set them.
export function recordedCriteria(cwd, state) {
  const rank = (v) => [v.round ?? 0, /reviewer/.test(v.agent ?? "") ? 1 : 0];
  const verdicts = countedVerdicts(cwd, state).sort((a, b) => { const ra = rank(a), rb = rank(b); for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]; return 0; });
  const criteria = new Map();
  for (const v of verdicts) for (const c of v.criteria ?? []) criteria.set(c.id, c.status);
  for (const s of state.slices) if (s.status === "skipped") for (const id of s.criteria ?? []) if (!criteria.has(id)) criteria.set(id, "skipped");
  return criteria;
}
