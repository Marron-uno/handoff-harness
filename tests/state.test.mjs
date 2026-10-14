import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { tmpDir, initRepo } from "./helpers.mjs";
import { newState, saveState, loadState, transition, nextReadySlice, currentSlice, RESTING, STAGES } from "../scripts/lib/state.mjs";
import { readEvents } from "../scripts/lib/events.mjs";
import { harnessPaths } from "../scripts/lib/paths.mjs";

function base() {
  return newState({ id: "G-1", sentence: "Build all of the handoff", mode: "handoff", branch: "goal/G-1", defaultBranch: "main" });
}

test("new state validates and round-trips through disk", () => {
  const dir = initRepo(tmpDir());
  const state = saveState(dir, base());
  assert.ok(existsSync(harnessPaths(dir).state));
  const loaded = loadState(dir);
  assert.equal(loaded.stage, "intake");
  assert.equal(loaded.goal.budget.usd, 20);
  assert.equal(loaded.updatedAt, state.updatedAt);
});

test("saveState rejects a corrupted state", () => {
  const dir = initRepo(tmpDir());
  const state = base();
  state.stage = "flying";
  assert.throws(() => saveState(dir, state), /state.json failed schema validation/);
});

test("transition logs an event and resets the block counter", () => {
  const dir = initRepo(tmpDir());
  const state = base();
  state.guards.blocks = 4;
  transition(dir, state, "planning", "card approved");
  assert.equal(state.stage, "planning");
  assert.equal(state.guards.blocks, 0);
  const events = readEvents(dir);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "stage");
  assert.equal(events[0].from, "intake");
  assert.equal(events[0].to, "planning");
  assert.throws(() => transition(dir, state, "nowhere", "x"), /unknown stage/);
});

test("nextReadySlice honours dependencies and holds", () => {
  const state = base();
  const slice = (id, dependsOn = []) => ({ id, title: id, status: "pending", dependsOn, criteria: [], paths: [], attempts: 0, ui: false });
  state.slices = [slice("S-1"), slice("S-2", ["S-1"]), slice("S-3")];
  state.holds = [{ id: "H-1", question: "Which handle?", blocks: ["S-3"] }];
  assert.equal(nextReadySlice(state).id, "S-1");
  state.slices[0].status = "done";
  assert.equal(nextReadySlice(state).id, "S-2");
  state.slices[1].status = "done";
  assert.equal(nextReadySlice(state), null);
  state.slice = { id: "S-2", attempt: 1 };
  assert.equal(currentSlice(state).title, "S-2");
});

test("resting stages are a subset of stages", () => {
  for (const s of RESTING) assert.ok(STAGES.includes(s));
});
