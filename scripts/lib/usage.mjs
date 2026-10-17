// Token usage and cost attribution from Claude Code transcripts (JSONL). Claude Code writes one
// assistant row per content block, so a response with several tool calls appears as several rows
// that share one message.id and the same usage; each id is counted once. Prices come from the
// profile; cache writes are priced by TTL (five minutes or one hour) when the transcript says
// which, and a model entry may carry a long-context tier.
import { existsSync, readFileSync } from "node:fs";
import { readEvents } from "./events.mjs";
import { harnessPaths } from "./paths.mjs";
import { writeJsonAtomic, nowIso } from "./io.mjs";

const TOKEN_KEYS = ["calls", "input", "cacheWrite", "cacheWrite1h", "cacheRead", "output"];

export function readTranscriptUsage(path) {
  if (!path || !existsSync(path)) return [];
  const rows = [];
  const seen = new Set();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const u = rec?.message?.usage;
    if (!u || rec.type !== "assistant") continue;
    const id = rec.message.id;
    if (id) { if (seen.has(id)) continue; seen.add(id); }
    rows.push({
      ts: rec.timestamp ? Date.parse(rec.timestamp) : null,
      model: rec.message.model ?? "unknown",
      input: u.input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      cacheWrite1h: u.cache_creation?.ephemeral_1h_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
    });
  }
  return rows;
}

// The table entry whose key appears in the model id, else `default`. A `longContext` tier applies
// when the prompt (input plus cache) is over its `over` threshold.
export function priceFor(model, pricing, row = null) {
  const table = pricing.perMillion;
  const key = Object.keys(table).find((k) => k !== "default" && String(model).toLowerCase().includes(k));
  const p = table[key] ?? table.default;
  if (row && p.longContext && (row.input + row.cacheWrite + row.cacheRead) > (p.longContext.over ?? 100000)) return { ...p, ...p.longContext };
  return p;
}

export function costOf(row, pricing) {
  const p = priceFor(row.model, pricing, row);
  const w1h = Math.min(row.cacheWrite1h ?? 0, row.cacheWrite);
  const w5m = row.cacheWrite - w1h;
  return (row.input * p.input + w5m * p.cacheWrite + w1h * (p.cacheWrite1h ?? p.cacheWrite) + row.cacheRead * p.cacheRead + row.output * p.output) / 1e6;
}

function emptyBucket() { return { calls: 0, input: 0, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0, output: 0, usd: 0 }; }

function add(bucket, row, pricing) {
  bucket.calls += 1; bucket.input += row.input; bucket.cacheWrite += row.cacheWrite; bucket.cacheWrite1h += row.cacheWrite1h ?? 0; bucket.cacheRead += row.cacheRead; bucket.output += row.output; bucket.usd += costOf(row, pricing);
}

// Stage windows come from `stage` events; a row belongs to the stage active at its timestamp.
// Subagent rows arrive pre-summarized (one per usage event) with their stage already set.
export function attributeByStage(cwd, state, profile, { transcriptPath = state.transcriptPath, agentRows = [] } = {}) {
  const log = readEvents(cwd);
  const stages = log.filter((e) => e.type === "stage").map((e) => ({ at: Date.parse(e.ts), stage: e.to }));
  // Rows count between the goal's creation and its completion: what a session does in the dormant
  // project after `done` is not the goal's cost (self-run 3's retro, R-2). The done event carries
  // no goal id, so the first one after this goal's new event is its own.
  const start = log.findIndex((e) => e.type === "goal" && e.action === "new" && e.id === state.goal.id);
  const since = start >= 0 ? Date.parse(log[start].ts) : 0;
  const done = start >= 0 ? log.slice(start + 1).find((e) => e.type === "goal" && e.action === "done") : null;
  const until = done ? Date.parse(done.ts) : Infinity;
  const inGoal = (r) => r.ts === null || r.ts === undefined || (r.ts >= since && r.ts <= until);
  const rows = readTranscriptUsage(transcriptPath).filter(inGoal);
  const byStage = {};
  const byModel = {};
  const byScope = { main: emptyBucket(), subagent: emptyBucket() };
  const stageAt = (ts) => {
    let current = "intake";
    for (const s of stages) { if (ts === null || s.at <= ts) current = s.stage; else break; }
    return current;
  };
  for (const row of [...rows.map((r) => ({ ...r, stage: stageAt(r.ts), scope: "main" })), ...agentRows.filter(inGoal).map((r) => ({ ...r, scope: "subagent" }))]) {
    byStage[row.stage] ??= emptyBucket();
    byModel[row.model] ??= emptyBucket();
    add(byStage[row.stage], row, profile.pricing);
    add(byModel[row.model], row, profile.pricing);
    add(byScope[row.scope], row, profile.pricing);
  }
  const totalUsd = Object.values(byStage).reduce((s, b) => s + b.usd, 0);
  const summary = { goal: state.goal.id, at: nowIso(), transcriptPath, totalUsd, mainUsd: byScope.main.usd, subagentUsd: byScope.subagent.usd, byStage, byModel };
  writeJsonAtomic(harnessPaths(cwd).usage, summary);
  return summary;
}

// Sums one subagent transcript into a single row tagged with its stage and agent.
export function summarizeAgentTranscript(path, { stage, agent }) {
  const rows = readTranscriptUsage(path);
  const total = rows.reduce((acc, r) => ({ input: acc.input + r.input, cacheWrite: acc.cacheWrite + r.cacheWrite, cacheWrite1h: acc.cacheWrite1h + r.cacheWrite1h, cacheRead: acc.cacheRead + r.cacheRead, output: acc.output + r.output }), { input: 0, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0, output: 0 });
  return { ...total, calls: rows.length, model: rows[0]?.model ?? "unknown", stage, agent, ts: rows[0]?.ts ?? null };
}

// A subagent that SubagentStop sends back stops again later, and its transcript then holds the
// earlier calls too. The part not yet recorded is the total minus every earlier usage event of
// the same agent.
export function usageDelta(total, previous) {
  const delta = { ...total };
  for (const k of TOKEN_KEYS) delta[k] = Math.max(0, (total[k] ?? 0) - previous.reduce((s, e) => s + (e[k] ?? 0), 0));
  return delta;
}

// Usage events as rows for attribution; every event is already a delta, so they add up. Each row
// carries the event's time, so a judge that ran for an earlier goal, or after this one was done,
// stays out of the bill.
export function subagentUsageRows(cwd) {
  return readEvents(cwd, (e) => e.type === "usage" && e.scope === "subagent").map((e) => ({ stage: e.stage, agent: e.agent, model: e.model, input: e.input ?? 0, cacheWrite: e.cacheWrite ?? 0, cacheWrite1h: e.cacheWrite1h ?? 0, cacheRead: e.cacheRead ?? 0, output: e.output ?? 0, ts: typeof e.ts === "string" ? Date.parse(e.ts) : typeof e.ts === "number" ? e.ts : null }));
}
