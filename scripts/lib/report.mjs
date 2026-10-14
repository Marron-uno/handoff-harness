import { existsSync, readdirSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "./io.mjs";
import { harnessPaths } from "./paths.mjs";
import { readEvents } from "./events.mjs";
import { taskStatus } from "./openspec.mjs";

export function renderReport(cwd, state) {
  const p = harnessPaths(cwd);
  const events = readEvents(cwd);
  const lines = [];
  lines.push(`# ${state.goal.id}: ${state.goal.sentence}`, "");
  lines.push(`Mode: ${state.goal.mode}. Branch: ${state.branch}. Stage: ${state.stage}.`, "");
  lines.push("## Slices", "", "| Slice | Title | Status | Attempts | Commit |", "|---|---|---|---|---|");
  for (const s of state.slices) lines.push(`| ${s.id} | ${s.title} | ${s.status} | ${s.attempts} | ${s.commit ? s.commit.slice(0, 7) : ""} |`);
  lines.push("");

  if (state.spec) {
    const tasks = taskStatus(cwd, state);
    const specVerdicts = events.filter((e) => e.type === "verdict" && e.role === "spec" && e.valid);
    lines.push("## Spec", "", `OpenSpec change: \`openspec/changes/${state.spec.change}\`. ${state.spec.summary ?? ""}`, "");
    lines.push(`Spec review: ${specVerdicts.map((e) => e.verdict).join(", ") || "none"} over ${state.spec.attempt} attempt(s). Committed at approval: ${state.spec.committed ? state.spec.committed.slice(0, 7) : "nothing to commit"}.`, "");
    lines.push(`Tasks ticked: ${tasks.done} of ${tasks.total}.${tasks.open.length ? ` Open: ${tasks.open.map((t) => t.id).join(", ")}.` : ""}`, "");
    lines.push(`Archive by hand when the branch merges: \`openspec archive ${state.spec.change} --yes\`.`, "");
  }

  const verdicts = existsSync(p.verdicts) ? readdirSync(p.verdicts).filter((n) => n.endsWith(".json")).map((n) => ({ name: n, v: readJson(join(p.verdicts, n), null) })).filter((x) => x.v) : [];
  const criteria = new Map();
  for (const { v } of verdicts) for (const c of v.criteria ?? []) criteria.set(c.id, c.status);
  if (criteria.size) {
    lines.push("## Criteria", "", "| Criterion | Status |", "|---|---|");
    for (const [id, status] of [...criteria.entries()].sort()) lines.push(`| ${id} | ${status} |`);
    lines.push("");
  }
  if (state.reconcile) {
    const r = readJson(state.reconcile.path, null);
    lines.push("## Inventory coverage", "");
    if (r) {
      const counts = {};
      for (const i of r.items) counts[i.status] = (counts[i.status] ?? 0) + 1;
      lines.push(Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", "), "");
    }
    lines.push(`Missing after reconciliation: ${state.reconcile.missing}`, "");
  }
  const usage = existsSync(p.usage) ? readJson(p.usage, null) : null;
  if (usage?.byStage) {
    lines.push("## Cost per stage", "", "| Stage | Calls | Input | Cache read | Output | USD |", "|---|---|---|---|---|---|");
    for (const [stage, u] of Object.entries(usage.byStage)) lines.push(`| ${stage} | ${u.calls} | ${u.input} | ${u.cacheRead} | ${u.output} | ${u.usd.toFixed(3)} |`);
    const sessions = events.filter((e) => e.type === "session" && typeof e.usd === "number");
    lines.push("", `Total from the price table: $${usage.totalUsd.toFixed(3)} (main session $${(usage.mainUsd ?? 0).toFixed(3)}, subagents $${(usage.subagentUsd ?? 0).toFixed(3)}).`);
    if (sessions.length) lines.push(`Reported by Claude Code: $${sessions.reduce((s, e) => s + e.usd, 0).toFixed(3)} over ${sessions.length} headless session(s). This is the number of record; the table is an estimate.`);
    lines.push("");
  }
  if (state.holds.length) {
    lines.push("## Holds (need a human)", "");
    for (const h of state.holds) lines.push(`- ${h.id}: ${h.question} (blocks ${h.blocks.join(", ") || "nothing"})`);
    lines.push("");
  }
  if (state.defaults.length) {
    lines.push("## Defaults applied", "");
    for (const d of state.defaults) lines.push(`- ${d.id}: ${d.question} → ${d.chosen}`);
    lines.push("");
  }
  const blocks = events.filter((e) => e.type === "block");
  const halts = events.filter((e) => e.type === "halt");
  const guards = events.filter((e) => e.type === "guard");
  lines.push("## Run log", "", `Stage transitions: ${events.filter((e) => e.type === "stage").length}. Stop-hook blocks: ${blocks.length}. Guard denials: ${guards.length}. Halts: ${halts.length}.`, "");
  if (guards.length) {
    lines.push("| Guard | Count |", "|---|---|");
    const counts = {};
    for (const g of guards) counts[g.guard] = (counts[g.guard] ?? 0) + 1;
    for (const [k, v] of Object.entries(counts)) lines.push(`| ${k} | ${v} |`);
    lines.push("");
  }
  const text = lines.join("\n") + "\n";
  writeFileSync(p.report, text);
  mkdirSync(join(p.dir, "reports"), { recursive: true });
  copyFileSync(p.report, join(p.dir, "reports", `${state.goal.id}.md`));
  return text;
}
