import { join } from "node:path";
import { readJson, writeJsonAtomic, nowIso } from "./io.mjs";
import { harnessPaths, pluginRoot } from "./paths.mjs";
import { assertValid } from "./schema.mjs";
import { appendEvent } from "./events.mjs";

export const STAGES = [
  "intake", "awaiting_approval", "planning", "building", "preflight", "critic", "review",
  "record", "reconcile", "report", "done", "awaiting_human", "budget_exceeded", "halted",
];
// Stages where the Stop hook lets the session end.
export const RESTING = new Set(["awaiting_approval", "awaiting_human", "budget_exceeded", "halted", "done"]);

let schemaCache = null;
export function stateSchema() {
  if (!schemaCache) schemaCache = readJson(join(pluginRoot(), "schemas", "state.schema.json"));
  return schemaCache;
}

export function newState({ id, sentence, mode, sources = [], budget = {}, autoApprove = false, environments = {}, jev = false, branch, defaultBranch, transcriptPath = null }) {
  return {
    version: 1,
    goal: {
      id, sentence, mode, sources,
      createdAt: nowIso(), approvedAt: null, autoApprove,
      budget: { usd: 20, minutes: 120, maxSlices: 20, ...budget },
      environments: { prod: false, preview: null, ...environments },
      jev,
    },
    stage: "intake",
    stageEnteredAt: nowIso(),
    branch, defaultBranch,
    slice: null,
    slices: [],
    review: { rounds: 0, roundsAuthorized: 3 },
    preflight: null,
    verdicts: { critic: null, review: null },
    guards: { blocks: 0, diffHashes: [], continuations: 0 },
    counters: { toolCalls: {}, browserActions: 0 },
    browser: { lastHost: null },
    holds: [],
    defaults: [],
    reconcile: null,
    transcriptPath,
    pluginRoot: pluginRoot(),
    halt: null,
    updatedAt: nowIso(),
  };
}

export function loadState(cwd) {
  const state = readJson(harnessPaths(cwd).state);
  assertValid(stateSchema(), state, "state.json");
  return state;
}

export function saveState(cwd, state) {
  state.updatedAt = nowIso();
  assertValid(stateSchema(), state, "state.json");
  writeJsonAtomic(harnessPaths(cwd).state, state);
  return state;
}

// The only way a stage changes. Logs the transition, resets the non-progress block counter.
export function transition(cwd, state, stage, reason, data = {}) {
  if (!STAGES.includes(stage)) throw new Error(`unknown stage ${stage}`);
  const from = state.stage;
  state.stage = stage;
  state.stageEnteredAt = nowIso();
  state.guards.blocks = 0;
  appendEvent(cwd, { type: "stage", from, to: stage, slice: state.slice?.id ?? null, reason, ...data });
  return state;
}

export function currentSlice(state) {
  if (!state.slice) return null;
  return state.slices.find((s) => s.id === state.slice.id) ?? null;
}

export function nextReadySlice(state) {
  const done = new Set(state.slices.filter((s) => s.status === "done" || s.status === "skipped").map((s) => s.id));
  const held = new Set(state.holds.flatMap((h) => h.blocks));
  return state.slices.find((s) => s.status === "pending" && !held.has(s.id) && s.dependsOn.every((d) => done.has(d))) ?? null;
}
