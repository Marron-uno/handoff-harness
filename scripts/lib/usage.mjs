// Token usage and cost attribution from Claude Code transcripts (JSONL). Each assistant message
// carries message.usage; this module buckets them by stage window from the events log.
import { existsSync, readFileSync } from "node:fs";
import { readEvents } from "./events.mjs";
import { harnessPaths } from "./paths.mjs";
import { writeJsonAtomic, nowIso } from "./io.mjs";

export function readTranscriptUsage(path) {
  if (!path || !existsSync(path)) return [];
  const rows = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const u = rec?.message?.usage;
    if (!u || rec.type !== "assistant") continue;
    rows.push({
      ts: rec.timestamp ? Date.parse(rec.timestamp) : null,
      model: rec.message.model ?? "unknown",
      input: u.input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
    });
  }
  return rows;
}

export function priceFor(model, pricing) {
  const table = pricing.perMillion;
  const key = Object.keys(table).find((k) => k !== "default" && model.toLowerCase().includes(k));
  return table[key] ?? table.default;
}

export function costOf(row, pricing) {
  const p = priceFor(row.model, pricing);
  return (row.input * p.input + row.cacheWrite * p.cacheWrite + row.cacheRead * p.cacheRead + row.output * p.output) / 1e6;
}

function emptyBucket() { return { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, usd: 0 }; }

function add(bucket, row, pricing) {
  bucket.calls += 1; bucket.input += row.input; bucket.cacheWrite += row.cacheWrite; bucket.cacheRead += row.cacheRead; bucket.output += row.output; bucket.usd += costOf(row, pricing);
}

// Stage windows come from `stage` events; a row belongs to the stage active at its timestamp.
export function attributeByStage(cwd, state, profile, { transcriptPath = state.transcriptPath, agentRows = [] } = {}) {
  const stages = readEvents(cwd, (e) => e.type === "stage").map((e) => ({ at: Date.parse(e.ts), stage: e.to }));
  const goalStart = readEvents(cwd, (e) => e.type === "goal" && e.action === "new" && e.id === state.goal.id)[0];
  const since = goalStart ? Date.parse(goalStart.ts) : 0;
  const rows = readTranscriptUsage(transcriptPath).filter((r) => r.ts === null || r.ts >= since);
  const byStage = {};
  const byModel = {};
  const stageAt = (ts) => {
    let current = "intake";
    for (const s of stages) { if (ts === null || s.at <= ts) current = s.stage; else break; }
    return current;
  };
  for (const row of [...rows.map((r) => ({ ...r, stage: stageAt(r.ts) })), ...agentRows]) {
    byStage[row.stage] ??= emptyBucket();
    byModel[row.model] ??= emptyBucket();
    add(byStage[row.stage], row, profile.pricing);
    add(byModel[row.model], row, profile.pricing);
  }
  const totalUsd = Object.values(byStage).reduce((s, b) => s + b.usd, 0);
  const summary = { goal: state.goal.id, at: nowIso(), transcriptPath, totalUsd, byStage, byModel };
  writeJsonAtomic(harnessPaths(cwd).usage, summary);
  return summary;
}

// Sums one subagent transcript into a single row tagged with its stage and agent.
export function summarizeAgentTranscript(path, { stage, agent }) {
  const rows = readTranscriptUsage(path);
  const total = rows.reduce((acc, r) => ({ input: acc.input + r.input, cacheWrite: acc.cacheWrite + r.cacheWrite, cacheRead: acc.cacheRead + r.cacheRead, output: acc.output + r.output }), { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });
  return { ...total, calls: rows.length, model: rows[0]?.model ?? "unknown", stage, agent, ts: rows[0]?.ts ?? null };
}
