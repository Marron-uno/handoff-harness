// The goal predicate. Script-computed, never model-declared.
import { existsSync } from "node:fs";
import { harnessPaths } from "./paths.mjs";
import { workHash } from "./git.mjs";

export function goalCheck(cwd, state, profile) {
  const reasons = [];
  const held = new Set(state.holds.flatMap((h) => h.blocks));
  for (const s of state.slices) {
    if (s.status === "done" || s.status === "skipped") continue;
    if (held.has(s.id)) continue;
    reasons.push(`slice ${s.id} is ${s.status}`);
  }
  if (!state.reconcile) reasons.push("no reconciliation result");
  else {
    if (state.reconcile.diffHash !== workHash(cwd)) reasons.push("reconciliation result is stale");
    if (state.reconcile.missing > 0 && (state.reconcilePasses ?? 0) < 3) reasons.push(`${state.reconcile.missing} inventory items still missing`);
  }
  if (!existsSync(harnessPaths(cwd).report)) reasons.push("no report");
  return { done: reasons.length === 0, reasons, holds: state.holds.length };
}
