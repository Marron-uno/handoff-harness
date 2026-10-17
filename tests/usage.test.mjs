import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpDir, initRepo, PLUGIN_ROOT } from "./helpers.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";
import { newState, saveState } from "../scripts/lib/state.mjs";
import { appendEvent } from "../scripts/lib/events.mjs";
import { readTranscriptUsage, attributeByStage, costOf, priceFor, usageDelta, summarizeAgentTranscript, subagentUsageRows } from "../scripts/lib/usage.mjs";

function row(ts, model, input, output, cacheRead = 0, extra = {}) {
  return JSON.stringify({ type: "assistant", timestamp: new Date(ts).toISOString(), message: { model, usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead, ...extra.usage }, ...(extra.id ? { id: extra.id } : {}) } });
}

test("transcript rows parse and price by model family and context tier", () => {
  const dir = tmpDir();
  const t = join(dir, "t.jsonl");
  writeFileSync(t, [row(1000, "claude-opus-5-5", 100, 10), "{not json", JSON.stringify({ type: "user" }), row(2000, "claude-haiku-5-5", 1_000_000, 0), row(3000, "claude-haiku-5-5", 1000, 0)].join("\n"));
  const rows = readTranscriptUsage(t);
  assert.equal(rows.length, 3);
  const profile = loadProfile(dir, PLUGIN_ROOT);
  assert.equal(priceFor("claude-haiku-5-5", profile.pricing).input, 0.1, "the base tier");
  assert.equal(costOf(rows[1], profile.pricing), 0.5, "a million-token prompt is priced at the long-context tier");
  assert.equal(costOf(rows[2], profile.pricing), 0.0001, "a small prompt at the base tier");
  assert.equal(priceFor("something-else", profile.pricing), profile.pricing.perMillion.default);
});

test("rows that share a message id count once; one-hour cache writes use their own price", () => {
  const dir = tmpDir();
  const t = join(dir, "t.jsonl");
  const usage = { cache_creation_input_tokens: 1_000_000, cache_creation: { ephemeral_1h_input_tokens: 1_000_000, ephemeral_5m_input_tokens: 0 } };
  writeFileSync(t, [
    row(1000, "claude-sonnet-5-5", 0, 0, 0, { id: "msg_1", usage }),
    row(1000, "claude-sonnet-5-5", 0, 0, 0, { id: "msg_1", usage }),
    row(1000, "claude-sonnet-5-5", 0, 0, 0, { id: "msg_1", usage }),
    row(2000, "claude-sonnet-5-5", 0, 0, 0, { id: "msg_2", usage: { cache_creation_input_tokens: 1_000_000 } }),
    row(3000, "claude-sonnet-5-5", 10, 0),
  ].join("\n"));
  const rows = readTranscriptUsage(t);
  assert.equal(rows.length, 3, "three rows with one id collapse to one; a row without an id counts");
  const profile = loadProfile(dir, PLUGIN_ROOT);
  const p = profile.pricing.perMillion.sonnet;
  assert.equal(costOf(rows[0], profile.pricing), p.cacheWrite1h, "the one-hour write price");
  assert.equal(costOf(rows[1], profile.pricing), p.cacheWrite, "no TTL detail means the five-minute price");
  const total = summarizeAgentTranscript(t, { stage: "critic", agent: "critic" });
  assert.equal(total.calls, 3);
  assert.equal(total.cacheWrite, 2_000_000);
  assert.equal(total.cacheWrite1h, 1_000_000);
});

test("usageDelta subtracts what earlier usage events already recorded", () => {
  const total = { calls: 8, input: 16, cacheWrite: 20000, cacheWrite1h: 0, cacheRead: 70000, output: 3000, model: "m", stage: "spec_review", agent: "spec-reviewer" };
  const delta = usageDelta(total, [{ calls: 5, input: 10, cacheWrite: 17000, cacheRead: 33000, output: 2000 }]);
  assert.deepEqual({ calls: delta.calls, input: delta.input, cacheWrite: delta.cacheWrite, cacheRead: delta.cacheRead, output: delta.output }, { calls: 3, input: 6, cacheWrite: 3000, cacheRead: 37000, output: 1000 });
  assert.equal(delta.model, "m");
  assert.equal(usageDelta(total, [total]).calls, 0, "nothing new after the same stop");
  assert.equal(usageDelta(total, []).calls, 8, "the first stop records everything");
});

test("usage is attributed to the stage active at each message, split by scope", () => {
  const dir = initRepo(tmpDir());
  const profile = loadProfile(dir, PLUGIN_ROOT);
  const t = join(dir, "t.jsonl");
  const t0 = Date.now() - 60_000;
  const state = newState({ id: "G-1", sentence: "Build it", mode: "handoff", branch: "goal/G-1", defaultBranch: "main", transcriptPath: t });
  saveState(dir, state);
  appendEvent(dir, { ts: new Date(t0).toISOString(), type: "goal", action: "new", id: "G-1" });
  // Stage events at t0+10s (building) and t0+20s (critic).
  appendEvent(dir, { ts: new Date(t0 + 10_000).toISOString(), type: "stage", from: "intake", to: "building" });
  appendEvent(dir, { ts: new Date(t0 + 20_000).toISOString(), type: "stage", from: "building", to: "critic" });
  writeFileSync(t, [row(t0 - 5000, "claude-opus-5-5", 999, 999), row(t0 + 5000, "claude-opus-5-5", 100, 10), row(t0 + 15_000, "claude-opus-5-5", 200, 20), row(t0 + 25_000, "claude-opus-5-5", 300, 30)].join("\n"));
  const summary = attributeByStage(dir, state, profile, { agentRows: [{ stage: "critic", agent: "critic", model: "claude-haiku-5-5", input: 1000, output: 100, cacheRead: 0, cacheWrite: 0 }] });
  assert.equal(summary.byStage.intake.input, 100, "row before the first stage event belongs to intake");
  assert.equal(summary.byStage.building.input, 200);
  assert.equal(summary.byStage.critic.input, 1300);
  assert.equal(summary.byStage.critic.calls, 2);
  assert.ok(!summary.byStage.unknown);
  assert.ok(summary.totalUsd > 0);
  assert.ok(Math.abs(summary.mainUsd + summary.subagentUsd - summary.totalUsd) < 1e-9, "scopes add up to the total");
  assert.ok(summary.subagentUsd > 0 && summary.mainUsd > summary.subagentUsd);
  assert.equal(Object.keys(summary.byModel).length, 2);
});

test("usage stops counting at the goal's done event, and subagent rows carry the time of their event", () => {
  const dir = initRepo(tmpDir());
  const profile = loadProfile(dir, PLUGIN_ROOT);
  const t = join(dir, "t.jsonl");
  const t0 = Date.now() - 60_000;
  const state = newState({ id: "G-2", sentence: "Build it", mode: "handoff", branch: "goal/G-2", defaultBranch: "main", transcriptPath: t });
  saveState(dir, state);
  // An unrotated log still holds the previous goal; its rows must not count either.
  appendEvent(dir, { ts: new Date(t0 - 30_000).toISOString(), type: "goal", action: "new", id: "G-1" });
  appendEvent(dir, { ts: new Date(t0 - 20_000).toISOString(), type: "goal", action: "done" });
  appendEvent(dir, { ts: new Date(t0).toISOString(), type: "goal", action: "new", id: "G-2" });
  appendEvent(dir, { ts: new Date(t0 + 10_000).toISOString(), type: "stage", from: "intake", to: "building" });
  appendEvent(dir, { ts: new Date(t0 + 20_000).toISOString(), type: "stage", from: "report", to: "done" });
  appendEvent(dir, { ts: new Date(t0 + 20_000).toISOString(), type: "goal", action: "done" });
  appendEvent(dir, { ts: new Date(t0 + 15_000).toISOString(), type: "usage", scope: "subagent", stage: "building", agent: "critic", agentId: "a1", model: "claude-haiku-5-5", input: 1000, output: 100 });
  appendEvent(dir, { ts: new Date(t0 + 30_000).toISOString(), type: "usage", scope: "subagent", stage: "done", agent: "critic", agentId: "a2", model: "claude-haiku-5-5", input: 5000, output: 500 });
  writeFileSync(t, [row(t0 - 25_000, "claude-opus-5-5", 999, 999), row(t0 + 5000, "claude-opus-5-5", 100, 10), row(t0 + 15_000, "claude-opus-5-5", 200, 20), row(t0 + 25_000, "claude-opus-5-5", 300, 30)].join("\n"));
  const rows = subagentUsageRows(dir);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].ts, t0 + 15_000);
  const summary = attributeByStage(dir, state, profile, { agentRows: rows });
  assert.equal(summary.byStage.intake.input, 100, "the previous goal's row is out");
  assert.equal(summary.byStage.building.input, 1200, "the subagent row inside the goal counts under its own stage");
  assert.ok(!summary.byStage.done, "rows after done, main or subagent, are not the goal's");
  assert.equal(Object.values(summary.byStage).reduce((s, b) => s + b.input, 0), 1300);
});
