// Run analysis from the events log: time and cost per stage, blocks, guard denials, verdicts,
// evidence, halts. Rendered as markdown by `harness analyze`.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readJson, readLines } from "./io.mjs";
import { harnessPaths } from "./paths.mjs";
import { readEvents } from "./events.mjs";
import { runMetrics } from "./metrics.mjs";

function fmtMin(ms) { return `${(ms / 60000).toFixed(1)} min`; }

export function analyzeRun(cwd, { driveLog = null } = {}) {
  const p = harnessPaths(cwd);
  const events = readEvents(cwd);
  const state = existsSync(p.state) ? readJson(p.state) : null;
  const usage = existsSync(p.usage) ? readJson(p.usage) : null;

  // Stage timeline: each `stage` event opens a window closed by the next one.
  const stages = events.filter((e) => e.type === "stage" && e.to && e.from !== e.to);
  const windows = stages.map((e, i) => ({ stage: e.to, slice: e.slice ?? null, from: Date.parse(e.ts), to: i + 1 < stages.length ? Date.parse(stages[i + 1].ts) : Date.parse(events[events.length - 1]?.ts ?? e.ts), reason: e.reason }));
  const perStage = {};
  for (const w of windows) {
    perStage[w.stage] ??= { visits: 0, ms: 0 };
    perStage[w.stage].visits += 1;
    perStage[w.stage].ms += Math.max(0, w.to - w.from);
  }
  const blocks = events.filter((e) => e.type === "block");
  const blocksByCode = count(blocks, (e) => `${e.stage}:${e.code}`);
  const guards = events.filter((e) => e.type === "guard");
  const guardsByGuard = count(guards, (e) => e.guard);
  const halts = events.filter((e) => e.type === "halt");
  const verdictEvents = events.filter((e) => e.type === "verdict");
  const jev = events.filter((e) => e.type === "jev");
  const browser = events.filter((e) => e.type === "browser");
  const records = events.filter((e) => e.type === "record");
  const subagentUsage = events.filter((e) => e.type === "usage" && e.scope === "subagent");

  const verdicts = [];
  if (existsSync(p.verdicts)) {
    for (const name of readdirSync(p.verdicts).filter((n) => n.endsWith(".json")).sort()) {
      const v = readJson(join(p.verdicts, name), null);
      if (!v) continue;
      if (name.startsWith("reconcile")) { verdicts.push({ name, kind: "reconcile", items: v.items?.length ?? 0, newSlices: v.newSlices?.length ?? 0 }); continue; }
      const evidence = (v.findings ?? []).flatMap((f) => f.evidence ?? []).concat((v.criteria ?? []).flatMap((c) => c.evidence ?? []));
      const resolved = evidence.filter((e) => e.path && (existsSync(join(cwd, e.path)) || existsSync(e.path))).length;
      verdicts.push({ name, kind: v.agent, verdict: v.verdict, findings: (v.findings ?? []).length, block: (v.findings ?? []).filter((f) => f.severity === "block").length, criteria: (v.criteria ?? []).map((c) => `${c.id}:${c.status}`).join(" "), evidence: evidence.length, evidenceResolved: resolved, screenshots: evidence.filter((e) => e.type === "screenshot" || e.type === "gif").length, browser: v.browser ?? null });
    }
  }
  const screenshots = [];
  if (existsSync(p.evidence)) {
    const walk = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) walk(f); else screenshots.push({ path: f.replace(cwd + "/", ""), bytes: statSync(f).size }); } };
    walk(p.evidence);
  }
  const fromLog = driveLog && existsSync(driveLog) ? readLines(driveLog).map((l) => { const m = l.match(/^(\S+) iteration (\d+) stage (\S+) (.*)$/); if (!m) return null; let j = {}; try { j = JSON.parse(m[4]); } catch { /* skip */ } return { ts: m[1], iteration: Number(m[2]), stage: m[3], ...j }; }).filter(Boolean) : [];
  // The driver also records each session as an event, so the figure survives without the log.
  const drive = fromLog.length ? fromLog : events.filter((e) => e.type === "session").map((e) => ({ ts: e.ts, iteration: e.iteration, stage: e.stage, turns: e.turns, usd: e.usd, isError: e.isError, result: "" }));
  const driveUsd = drive.reduce((s, d) => s + (d.usd ?? 0), 0);

  const metrics = runMetrics(p.dir, { driveLog: driveLog && existsSync(driveLog) ? driveLog : null });
  return { metrics, state: state && { goal: state.goal.id, sentence: state.goal.sentence, stage: state.stage, halt: state.halt, slices: state.slices.map((s) => ({ id: s.id, title: s.title, status: s.status, attempts: s.attempts, origin: s.origin })), holds: state.holds, defaults: state.defaults, reconcile: state.reconcile },
    totalMs: events.length ? Date.parse(events[events.length - 1].ts) - Date.parse(events[0].ts) : 0,
    perStage, blocks: blocks.length, blocksByCode, guards: guards.length, guardsByGuard, halts, verdictEvents: verdictEvents.map((e) => ({ role: e.role, agent: e.agent, valid: e.valid, verdict: e.verdict, findings: e.findings, errors: e.errors })), verdicts, screenshots, browser: browser.map((b) => ({ host: b.host, kind: b.kind, stage: b.stage, agent: b.agent })), records: records.length, jev: jev.length, subagentUsage: subagentUsage.map((u) => ({ agent: u.agent, stage: u.stage, model: u.model, calls: u.calls, usd: u.usd, stops: u.stops ?? 1 })), usage, drive, driveUsd };
}

function count(list, key) {
  const out = {};
  for (const item of list) { const k = key(item); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

export function renderAnalysis(a) {
  const L = [];
  if (a.state) L.push(`# Run analysis: ${a.state.goal} "${a.state.sentence}"`, "", `Final stage: ${a.state.stage}${a.state.halt ? ` (${a.state.halt.code}: ${a.state.halt.reason})` : ""}. Wall clock from first to last event: ${fmtMin(a.totalMs)}.`, "");
  if (a.metrics) {
    const m = a.metrics;
    L.push("## Metrics", "", "| Metric | Value |", "|---|---|");
    for (const [k, v] of [["slices done / held / total", `${m.slicesDone} / ${m.slicesHeld} / ${m.slicesTotal}`], ["minutes", m.minutes], ["sessions, turns", `${m.sessions}, ${m.turns}`], ["cost reported by Claude Code", m.costReported], ["cost from the price table", `${m.costTable ?? "n/a"} (${m.costRatio ?? "n/a"}x)`], ["stop-hook blocks", m.blocks], ["guard denials", m.guardDenials], ["halts", m.halts], ["verdict writes, invalid", `${m.verdictWrites}, ${m.invalidVerdicts}`], ["judges that stopped more than once", m.judgeStopsExtra], ["critic tool calls per slice", m.criticCallsPerSlice.map((c) => `${c.slice}: ${c.calls}`).join(", ") || "none"], ["reviewer tool calls per slice", m.reviewerCallsPerSlice.map((c) => `${c.slice}: ${c.calls}`).join(", ") || "none"], ["screenshots", m.screenshots], ["jev answers, routes", `${m.jevAnswers}, ${Object.entries(m.jevRoutes).map(([k, v]) => `${k} ${v}`).join(" ") || "none"}`]]) L.push(`| ${k} | ${v} |`);
    L.push("");
  }
  L.push("## Slices", "", "| Slice | Title | Status | Attempts | Origin |", "|---|---|---|---|---|");
  for (const s of a.state?.slices ?? []) L.push(`| ${s.id} | ${s.title} | ${s.status} | ${s.attempts} | ${s.origin ?? ""} |`);
  L.push("", "## Time per stage", "", "| Stage | Visits | Time |", "|---|---|---|");
  for (const [stage, v] of Object.entries(a.perStage)) L.push(`| ${stage} | ${v.visits} | ${fmtMin(v.ms)} |`);
  if (a.usage?.byStage) {
    L.push("", "## Cost per stage (harness price table)", "", "| Stage | Calls | Input | Cache read | Output | USD |", "|---|---|---|---|---|---|");
    for (const [stage, u] of Object.entries(a.usage.byStage)) L.push(`| ${stage} | ${u.calls} | ${u.input} | ${u.cacheRead} | ${u.output} | ${u.usd.toFixed(3)} |`);
    L.push("", `Harness total: $${a.usage.totalUsd.toFixed(3)} (main $${(a.usage.mainUsd ?? 0).toFixed(3)}, subagents $${(a.usage.subagentUsd ?? 0).toFixed(3)}). Reported by Claude Code: $${a.driveUsd.toFixed(3)} over ${a.drive.length} sessions.`);
  }
  if (a.drive.length) {
    L.push("", "## Headless sessions", "", "| # | Stage at start | Turns | USD | Error | Result |", "|---|---|---|---|---|---|");
    for (const d of a.drive) L.push(`| ${d.iteration} | ${d.stage} | ${d.turns ?? ""} | ${d.usd?.toFixed?.(3) ?? ""} | ${d.isError ?? ""} | ${String(d.result ?? "").replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 90)} |`);
  }
  L.push("", "## Stop-hook blocks", "", `${a.blocks} blocks.`, "", "| Stage:code | Count |", "|---|---|");
  for (const [k, v] of Object.entries(a.blocksByCode)) L.push(`| ${k} | ${v} |`);
  L.push("", "## Guard denials", "", `${a.guards} denials.`, "");
  if (a.guards) { L.push("| Guard | Count |", "|---|---|"); for (const [k, v] of Object.entries(a.guardsByGuard)) L.push(`| ${k} | ${v} |`); }
  L.push("", "## Verdicts", "", "| File | Agent | Verdict | Findings | Block | Criteria | Evidence (resolved) | Screenshots |", "|---|---|---|---|---|---|---|---|");
  for (const v of a.verdicts) L.push(v.kind === "reconcile" ? `| ${v.name} | reconciler | | ${v.items} items | | ${v.newSlices} new slices | | |` : `| ${v.name} | ${v.kind} | ${v.verdict} | ${v.findings} | ${v.block} | ${v.criteria} | ${v.evidence} (${v.evidenceResolved}) | ${v.screenshots} |`);
  const invalid = a.verdictEvents.filter((e) => e.valid === false);
  if (invalid.length) { L.push("", `Invalid verdict attempts: ${invalid.length}.`, ""); for (const e of invalid) L.push(`- ${e.agent ?? e.role}: ${(e.errors ?? []).slice(0, 3).join("; ")}`); }
  L.push("", "## Browser", "", `${a.browser.length} host changes, ${a.screenshots.length} evidence files.`, "");
  for (const b of a.browser) L.push(`- ${b.agent ?? "main"} opened ${b.host} (${b.kind}) in stage ${b.stage}`);
  for (const s of a.screenshots) L.push(`- ${s.path} (${s.bytes} bytes)`);
  if (a.subagentUsage.length) { L.push("", "## Subagent usage", "", "| Agent | Stage | Model | Calls | Stop | USD |", "|---|---|---|---|---|---|"); for (const u of a.subagentUsage) L.push(`| ${u.agent} | ${u.stage} | ${u.model} | ${u.calls} | ${u.stops} | ${u.usd} |`); }
  L.push("", "## Halts and holds", "");
  for (const h of a.halts) L.push(`- halt ${h.code} in ${h.stage}: ${h.reason}`);
  for (const h of a.state?.holds ?? []) L.push(`- hold ${h.id}: ${h.question} (blocks ${h.blocks.join(", ") || "nothing"})`);
  for (const d of a.state?.defaults ?? []) L.push(`- default ${d.id}: ${d.question} → ${d.chosen}`);
  if (a.state?.reconcile) L.push(`- reconcile: ${a.state.reconcile.missing} missing`);
  return L.join("\n") + "\n";
}
