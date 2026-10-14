// One definition of a run's numbers, shared by `harness analyze`, `harness retro`, the replay
// evals and the bench. Reads a directory that holds state.json, events.jsonl, usage.json,
// verdicts/ and evidence/: a project's .harness/ or a snapshot under docs/runs/. Flat numbers
// only, so two runs can be diffed column by column.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readJson, readLines } from "./io.mjs";

const JUDGE = { critic: "critic", "critic-strong": "critic", reviewer: "reviewer", "reviewer-strong": "reviewer" };

export function readRunDir(dir, { driveLog = null } = {}) {
  const events = readLines(join(dir, "events.jsonl")).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const state = existsSync(join(dir, "state.json")) ? readJson(join(dir, "state.json"), null) : null;
  const usage = existsSync(join(dir, "usage.json")) ? readJson(join(dir, "usage.json"), null) : null;
  const log = driveLog ?? (existsSync(join(dir, "drive.log")) ? join(dir, "drive.log") : null);
  const sessionsFromLog = log && existsSync(log) ? readLines(log).map((l) => { const m = l.match(/^(\S+) iteration (\d+) stage (\S+) (.*)$/); if (!m) return null; let j = {}; try { j = JSON.parse(m[4]); } catch { /* skip */ } return { ts: m[1], iteration: Number(m[2]), stage: m[3], ...j }; }).filter(Boolean) : [];
  return { events, state, usage, sessionsFromLog };
}

// Error messages carry paths and ids; the pattern is what repeats across runs.
export function normalizeError(text) {
  return String(text).replace(/\/[^\s:]+/g, "<path>").replace(/\b[0-9a-f]{16}\b/g, "<hash>").replace(/\$\.\w+\[\d+\](\.\w+\[\d+\])*/g, "$.<item>").replace(/\b[SCIFHD]-\d+\b/g, "<id>").slice(0, 120);
}

export function runMetrics(dir, opts = {}) {
  const { events, state, usage, sessionsFromLog } = readRunDir(dir, opts);
  const count = (list, key) => { const out = {}; for (const e of list) { const k = key(e); if (k === undefined || k === null) continue; out[k] = (out[k] ?? 0) + 1; } return out; };
  const ofType = (t) => events.filter((e) => e.type === t);

  // Wall clock: the goal's own events; the driver's session rows arrive after the run rests.
  const runEvents = events.filter((e) => e.type !== "session");
  const minutes = runEvents.length ? (Date.parse(runEvents.at(-1).ts) - Date.parse(runEvents[0].ts)) / 60000 : 0;

  const sessionEvents = ofType("session").filter((e) => typeof e.usd === "number");
  const sessions = sessionEvents.length ? sessionEvents : sessionsFromLog;
  const costReported = sessions.reduce((s, e) => s + (e.usd ?? 0), 0);
  const costTable = usage?.totalUsd ?? null;

  const slices = state?.slices ?? [];
  const held = new Set((state?.holds ?? []).flatMap((h) => h.blocks));
  const blocks = ofType("block");
  const guards = ofType("guard");
  const halts = ofType("halt");
  const verdicts = ofType("verdict");
  const invalid = verdicts.filter((e) => e.valid === false);
  const usageEvents = ofType("usage").filter((e) => e.scope === "subagent");

  // Tool calls per judge per slice. New runs record one delta per stop; old runs recorded the
  // cumulative transcript at every stop, so there the last figure is the total.
  const calls = {};
  for (const u of usageEvents) {
    const role = JUDGE[u.agent]; if (!role) continue;
    const key = `${role}:${u.slice ?? "-"}`;
    calls[key] ??= { role, slice: u.slice ?? null, delta: 0, max: 0, stops: 0, hasStops: false };
    calls[key].delta += u.calls ?? 0; calls[key].max = Math.max(calls[key].max, u.calls ?? 0); calls[key].stops += 1; if (u.stops !== undefined) calls[key].hasStops = true;
  }
  const perSlice = (role) => Object.values(calls).filter((c) => c.role === role).map((c) => ({ slice: c.slice, calls: c.hasStops ? c.delta : c.max }));
  const criticCalls = perSlice("critic"); const reviewerCalls = perSlice("reviewer");
  const stat = (list) => list.length ? { max: Math.max(...list), mean: Number((list.reduce((s, x) => s + x, 0) / list.length).toFixed(1)) } : { max: 0, mean: 0 };

  let screenshots = 0;
  const ev = join(dir, "evidence");
  if (existsSync(ev)) { const walk = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) walk(f); else if (/\.(jpe?g|png|gif|webp)$/i.test(n)) screenshots += 1; } }; walk(ev); }

  const specVerdict = state?.spec ? readJson(join(dir, "verdicts", `spec-a${state.spec.attempt}-spec-reviewer.json`), null) : null;
  const jev = ofType("jev");
  const jevAnswers = jev.filter((e) => e.ok === true && e.purpose && !/^(verdict:gate|outcome)$/.test(e.purpose));
  const jevGates = jev.filter((e) => e.purpose === "verdict:gate");

  return {
    goal: state?.goal?.id ?? null, sentence: state?.goal?.sentence ?? null, stage: state?.stage ?? null, haltCode: state?.halt?.code ?? null,
    slicesTotal: slices.length,
    slicesDone: slices.filter((s) => s.status === "done").length,
    slicesSkipped: slices.filter((s) => s.status === "skipped").length,
    slicesHeld: slices.filter((s) => s.status !== "done" && s.status !== "skipped" && held.has(s.id)).length,
    slicesFromReconcile: slices.filter((s) => s.origin === "reconcile").length,
    minutes: Number(minutes.toFixed(1)),
    sessions: sessions.length, turns: sessions.reduce((s, e) => s + (e.turns ?? 0), 0),
    costReported: Number(costReported.toFixed(3)), costTable: costTable === null ? null : Number(costTable.toFixed(3)),
    costRatio: costTable !== null && costReported > 0 ? Number((costTable / costReported).toFixed(2)) : null,
    costMain: usage?.mainUsd === undefined ? null : Number(usage.mainUsd.toFixed(3)), costSubagents: usage?.subagentUsd === undefined ? null : Number(usage.subagentUsd.toFixed(3)),
    blocks: blocks.length, blocksByCode: count(blocks, (e) => `${e.stage}:${e.code}`),
    guardDenials: guards.length, guardsByGuard: count(guards, (e) => e.guard),
    halts: halts.length, haltCodes: halts.map((h) => h.code),
    verdictWrites: verdicts.length, invalidVerdicts: invalid.length,
    invalidByError: count(invalid.flatMap((e) => (e.errors ?? []).map(normalizeError)), (x) => x),
    judgeStopsExtra: usageEvents.filter((u) => (u.stops ?? 1) > 1).length,
    criticCalls: stat(criticCalls.map((c) => c.calls)), criticCallsPerSlice: criticCalls,
    reviewerCalls: stat(reviewerCalls.map((c) => c.calls)), reviewerCallsPerSlice: reviewerCalls,
    screenshots,
    reconcilePasses: state?.reconcilePasses ?? 0, reconcileMissing: state?.reconcile?.missing ?? null,
    specAttempts: state?.spec?.attempt ?? 0, specFindings: specVerdict?.findings?.length ?? 0, specBlocks: (specVerdict?.findings ?? []).filter((f) => f.severity === "block").length,
    holdsOpen: state?.holds?.length ?? 0, defaultsApplied: state?.defaults?.length ?? 0,
    jevAnswers: jevAnswers.length, jevRoutes: count(jevGates, (e) => e.route), jevSkipped: jev.filter((e) => e.skipped === true).length,
    jevCost: Number(jev.reduce((s, e) => s + (e.cost ?? 0), 0).toFixed(5)),
  };
}

// The columns a bench compares and the direction that counts as better. Null means "report only".
export const METRIC_DIRECTIONS = {
  slicesDone: "up", slicesHeld: null, minutes: "down", costReported: "down", costRatio: null, blocks: "down", guardDenials: "down", halts: "down",
  invalidVerdicts: "down", judgeStopsExtra: "down", "criticCalls.max": "down", "criticCalls.mean": "down", "reviewerCalls.mean": "down", screenshots: null,
  reconcilePasses: null, slicesFromReconcile: null, specAttempts: "down", jevAnswers: null, jevCost: "down",
};

export function metricValue(metrics, key) {
  return key.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), metrics);
}
