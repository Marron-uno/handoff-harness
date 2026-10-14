// The goal predicate. Script-computed, never model-declared.
import { existsSync } from "node:fs";
import { harnessPaths } from "./paths.mjs";
import { workHash } from "./git.mjs";
import { taskStatus } from "./openspec.mjs";

export function goalCheck(cwd, state, profile) {
  const reasons = [];
  const held = new Set(state.holds.flatMap((h) => h.blocks));
  const heldPending = [];
  for (const s of state.slices) {
    if (s.status === "done" || s.status === "skipped") continue;
    if (held.has(s.id)) { const h = state.holds.find((x) => x.blocks.includes(s.id)); heldPending.push({ slice: s.id, hold: h.id, question: h.question }); continue; }
    reasons.push(`slice ${s.id} is ${s.status}`);
  }
  // With the spec stage on, the change's tasks.md is part of the contract: every task is ticked
  // by record, except tasks owned by a slice a human skipped or held.
  if (state.spec) {
    const tasks = taskStatus(cwd, state);
    if (!tasks.exists) reasons.push(`no tasks.md in openspec/changes/${state.spec.change}`);
    const open = tasks.open.filter((t) => !(t.sliceStatus === "skipped" || held.has(t.slice)));
    if (open.length) reasons.push(`OpenSpec tasks still open: ${open.map((t) => `${t.id}${t.slice ? ` (${t.slice})` : ""}`).join(", ")}`);
  }
  if (!state.reconcile) reasons.push("no reconciliation result");
  else {
    if (state.reconcile.diffHash !== workHash(cwd)) reasons.push("reconciliation result is stale");
    if (state.reconcile.missing > 0 && (state.reconcilePasses ?? 0) < 3) reasons.push(`${state.reconcile.missing} inventory items still missing`);
  }
  if (!existsSync(harnessPaths(cwd).report)) reasons.push("no report");
  // Held slices do not fail the predicate; the machine rests on them instead of calling the run done.
  return { done: reasons.length === 0, reasons, holds: state.holds.length, heldPending };
}
