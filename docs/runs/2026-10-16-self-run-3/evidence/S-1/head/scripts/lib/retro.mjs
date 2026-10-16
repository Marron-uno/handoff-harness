// The deterministic half of a retrospective: the run's metrics, the signals a script can see
// in them, and a proposal skeleton the retro skill fills in. It never touches harness files;
// the proposal is the handoff from the project that ran to the harness repo that changes.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJson, readLines } from "./io.mjs";
import { pluginRoot } from "./paths.mjs";
import { runMetrics, readRunDir } from "./metrics.mjs";

export const SIGNAL_THRESHOLDS = { criticCalls: 8, reviewerCalls: 15, costRatioLow: 0.8, costRatioHigh: 1.25, jevNearMiss: 0.05 };

export function retroSignals(dir, metrics, { profile = null, thresholds = SIGNAL_THRESHOLDS } = {}) {
  const { events, state } = readRunDir(dir);
  const signals = [];
  const add = (severity, text, evidence = []) => signals.push({ id: `SIG-${signals.length + 1}`, severity, text, evidence });

  if (metrics.stage !== "done") add("high", `The run rests in ${metrics.stage}${metrics.haltCode ? ` (${metrics.haltCode})` : ""}: ${state?.halt?.reason?.split("\n")[0] ?? "no halt reason recorded"}.`, ["state.json"]);
  if (metrics.slicesHeld) add("high", `${metrics.slicesHeld} slice(s) left unbuilt behind a hold: ${(state?.slices ?? []).filter((s) => s.status !== "done" && s.status !== "skipped" && (state?.holds ?? []).some((h) => h.blocks.includes(s.id))).map((s) => `${s.id} "${s.title}"`).join(", ")}. Was the hold needed to build the slice?`, (state?.holds ?? []).map((h) => `${h.id}: ${h.question}`));
  if (metrics.halts) add("high", `${metrics.halts} halt(s): ${metrics.haltCodes.join(", ")}.`, events.filter((e) => e.type === "halt").map((e) => `${e.ts} ${e.stage}:${e.code} ${String(e.reason).split("\n")[0]}`));
  if (metrics.blocks) add("medium", `${metrics.blocks} Stop-hook block(s): ${Object.entries(metrics.blocksByCode).map(([k, v]) => `${k} x${v}`).join(", ")}. Each one is a model turn that re-read the brief.`);
  for (const g of events.filter((e) => e.type === "guard")) add("medium", `Guard ${g.guard} denied in ${g.stage ?? "?"}: ${String(g.reason ?? "").split("\n")[0].slice(0, 160)}. A denial in a judge or reconcile stage is often a false positive.`, [`${g.ts}${g.command ? ` command: ${String(g.command).slice(0, 120)}` : ""}${g.path ? ` path: ${g.path}` : ""}`]);
  if (metrics.invalidVerdicts) add("medium", `${metrics.invalidVerdicts} of ${metrics.verdictWrites} verdict writes were rejected by the validator: ${Object.entries(metrics.invalidByError).map(([k, v]) => `"${k}" x${v}`).join("; ")}. Each costs a judge turn; a repeated pattern wants a brief or skeleton change.`, events.filter((e) => e.type === "verdict" && e.valid === false).map((e) => `${e.ts} ${e.agent ?? e.role} ${e.path?.split("/").pop()}`));
  if (metrics.judgeStopsExtra) add("low", `${metrics.judgeStopsExtra} judge stop(s) beyond the first: judges that were sent back and stopped again.`);
  for (const c of metrics.criticCallsPerSlice.filter((c) => c.calls >= thresholds.criticCalls)) add("medium", `Critic used ${c.calls} tool calls on ${c.slice} (threshold ${thresholds.criticCalls}). With the packet, under 8 is the expectation; look at what it read.`);
  for (const c of metrics.reviewerCallsPerSlice.filter((c) => c.calls >= thresholds.reviewerCalls)) add("low", `Reviewer used ${c.calls} tool calls on ${c.slice} (threshold ${thresholds.reviewerCalls}).`);
  if (metrics.costRatio !== null && (metrics.costRatio < thresholds.costRatioLow || metrics.costRatio > thresholds.costRatioHigh)) add("medium", `Price table at ${metrics.costRatio}x of Claude Code's figure ($${metrics.costTable} against $${metrics.costReported}); check pricing.perMillion or the counting.`);
  if (metrics.sessions === 0) add("low", "No session cost recorded: the run was not driven headless, so the table is the only figure.");
  const uiWithoutShots = (state?.slices ?? []).filter((s) => s.ui && s.status === "done");
  if (uiWithoutShots.length && metrics.screenshots === 0) add("medium", `UI slice(s) ${uiWithoutShots.map((s) => s.id).join(", ")} were recorded with no screenshot in evidence/; the reviewer did not verify them in a browser.`);
  if (metrics.slicesFromReconcile) add("low", `Reconciliation added ${metrics.slicesFromReconcile} slice(s) the plan missed: ${(state?.slices ?? []).filter((s) => s.origin === "reconcile").map((s) => `${s.id} "${s.title}"`).join(", ")}. Could intake have planned them?`);
  if (metrics.specBlocks) add("medium", `The spec reviewer blocked ${metrics.specBlocks} time(s) over ${metrics.specAttempts} attempt(s).`);

  // Jev: answers that sat within reach of a threshold, and calls that were skipped.
  const jevPath = join(dir, "jev.jsonl");
  const thr = profile?.jev?.thresholds ?? {};
  if (existsSync(jevPath) && Object.keys(thr).length) {
    for (const line of readLines(jevPath)) {
      let row; try { row = JSON.parse(line); } catch { continue; }
      for (const [q, a] of Object.entries(row.answers ?? {})) {
        if (typeof a?.noul !== "number" || thr[q] === undefined) continue;
        if (a.noul >= thr[q] && a.noul - thr[q] <= thresholds.jevNearMiss) add("low", `Jev near miss: ${row.purpose} ${q} answered ${a.noul} against the ${thr[q]} threshold; accepted, barely.`, [row.id]);
      }
    }
  }
  if (metrics.jevSkipped) add("low", `${metrics.jevSkipped} Jev call(s) skipped: ${[...new Set(events.filter((e) => e.type === "jev" && e.skipped).map((e) => e.reason))].join("; ")}.`);
  return signals;
}

export function harnessVersion() {
  return readJson(join(pluginRoot(), ".claude-plugin", "plugin.json"), {}).version ?? "unknown";
}

export function renderProposal({ metrics, signals, state, version, date = new Date().toISOString().slice(0, 10) }) {
  const L = [];
  L.push("---", "kind: retro", `goal: ${metrics.goal}`, `sentence: ${JSON.stringify(metrics.sentence ?? "")}`, `harness: ${version}`, `finalStage: ${metrics.stage}`, `date: ${date}`, "status: draft", "---", "");
  L.push(`# Retro: ${metrics.goal} ${JSON.stringify(metrics.sentence ?? "")}`, "");
  L.push("Written by `harness retro` from the events log, then completed by the retro skill. Findings carry stable ids (R-n) so a goal in the harness repo can take this file as a source. The harness itself was not edited; that is the rule.", "");
  L.push("## Metrics", "", "```json", JSON.stringify(metrics, null, 2), "```", "");
  L.push("## Signals", "", signals.length ? "What a script could see. Not every signal is a finding; a finding needs a cause and a change." : "No signals. A clean run; the findings below, if any, come from reading the artifacts.", "");
  for (const s of signals) { L.push(`- ${s.id} [${s.severity}] ${s.text}`); for (const e of s.evidence ?? []) L.push(`  - ${e}`); }
  L.push("", "## Findings, ranked", "", "<!-- One block per finding, most expensive failure first. Delete this comment when done. -->", "");
  L.push("### R-1: <what went wrong, in one line>", "", "- Evidence: <event timestamps, verdict files, report lines; nothing invented>", "- Cause: <the rule, brief, agent or code path responsible, by file name>", "- Proposed change: <the smallest change to that file that prevents it>", "- Hypothesis: `<metric>: <down|up|zero>` from <current value>, measured by the replay eval or the bench", "");
  L.push("## Not changed", "", "<!-- Things the run did right that a change above must not break, and signals judged not worth a change. -->", "");
  return L.join("\n") + "\n";
}
