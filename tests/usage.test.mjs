import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpDir, initRepo, PLUGIN_ROOT } from "./helpers.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";
import { newState, saveState, transition } from "../scripts/lib/state.mjs";
import { appendEvent } from "../scripts/lib/events.mjs";
import { readTranscriptUsage, attributeByStage, costOf, priceFor } from "../scripts/lib/usage.mjs";

function row(ts, model, input, output, cacheRead = 0) {
  return JSON.stringify({ type: "assistant", timestamp: new Date(ts).toISOString(), message: { model, usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead } } });
}

test("transcript rows parse and price by model family", () => {
  const dir = tmpDir();
  const t = join(dir, "t.jsonl");
  writeFileSync(t, [row(1000, "claude-opus-5-5", 100, 10), "{not json", JSON.stringify({ type: "user" }), row(2000, "claude-haiku-5-5", 1_000_000, 0)].join("\n"));
  const rows = readTranscriptUsage(t);
  assert.equal(rows.length, 2);
  const profile = loadProfile(dir, PLUGIN_ROOT);
  assert.equal(priceFor("claude-haiku-5-5", profile.pricing).input, 1);
  assert.equal(costOf(rows[1], profile.pricing), 1);
  assert.equal(priceFor("something-else", profile.pricing), profile.pricing.perMillion.default);
});

test("usage is attributed to the stage active at each message", () => {
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
  assert.equal(Object.keys(summary.byModel).length, 2);
});
