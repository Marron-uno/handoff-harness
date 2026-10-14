import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli } from "./helpers.mjs";
import { fixtureRepo, writeIntake, state, hash, stop, writeVerdict } from "./fixture.mjs";
import { decide } from "../scripts/lib/machine.mjs";
import { loadState, saveState } from "../scripts/lib/state.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";
import { workHash } from "../scripts/lib/git.mjs";

function buildingRepo() {
  const dir = fixtureRepo();
  runCli(dir, ["init"]);
  runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff"]);
  writeIntake(dir);
  stop(dir);
  runCli(dir, ["goal", "approve"]);
  stop(dir);
  assert.equal(state(dir).stage, "building");
  return dir;
}

test("runaway guard halts after maxConsecutiveBlocks without progress", () => {
  const dir = buildingRepo();
  const profile = loadProfile(dir);
  const already = state(dir).guards.blocks;
  for (let i = already; i < profile.caps.maxConsecutiveBlocks; i++) {
    const r = stop(dir);
    assert.equal(r.json.decision, "block", `stop ${i}: ${r.stdout}`);
  }
  const r = stop(dir);
  assert.equal(r.json.decision, undefined);
  assert.match(r.json.systemMessage, /blocked 7 times/);
  const s = state(dir);
  assert.equal(s.stage, "halted");
  assert.equal(s.halt.code, "runaway");
  // A human can retry.
  assert.equal(runCli(dir, ["retry"]).json.stage, "building");
  assert.equal(state(dir).guards.blocks, 0);
});

test("oscillation guard halts on an A B A B work hash pattern", () => {
  const dir = buildingRepo();
  const s = loadState(dir);
  const profile = loadProfile(dir);
  const a = workHash(dir);
  writeFileSync(join(dir, "src/notes.mjs"), "// b\n");
  const b = workHash(dir);
  s.guards.diffHashes = [a, b, a];
  const r = decide({ cwd: dir, state: s, profile });
  assert.equal(r.action, "allow");
  assert.equal(r.code, "oscillation");
  assert.equal(s.stage, "halted");
});

test("attempt cap after repeated preflight failures hands over to a human", () => {
  const dir = buildingRepo();
  const profile = loadProfile(dir);
  let s = loadState(dir);
  for (let attempt = 1; attempt <= profile.caps.maxAttempts; attempt++) {
    s.slice.buildDone = true;
    s.stage = "preflight";
    s.preflight = { diffHash: workHash(dir), passed: false, at: new Date().toISOString(), checks: [{ id: "project:test", status: "fail", details: "1 failing" }] };
    const r = decide({ cwd: dir, state: s, profile });
    if (attempt < profile.caps.maxAttempts) {
      assert.equal(r.action, "block");
      assert.match(r.reason, new RegExp(`attempt ${attempt + 1} of ${profile.caps.maxAttempts}`));
      assert.match(r.reason, /project:test: 1 failing/);
      assert.equal(s.stage, "building");
    } else {
      assert.equal(r.action, "allow");
      assert.equal(s.stage, "awaiting_human");
      assert.equal(s.halt.code, "attempt_cap");
    }
  }
  saveState(dir, s);
  assert.equal(runCli(dir, ["slice", "skip", "--reason", "cannot fix"]).json.skipped, "S-1");
});

test("review rounds cap and authorize-rounds", () => {
  const dir = buildingRepo();
  const profile = loadProfile(dir);
  let s = loadState(dir);
  s.review.roundsAuthorized = 2;
  saveState(dir, s);
  for (let round = 1; round <= 2; round++) {
    s = loadState(dir);
    s.stage = "review";
    s.slice.buildDone = true;
    saveState(dir, s);
    writeVerdict(dir, join(dir, ".harness/verdicts", `S-1-a1-r${round}-reviewer.json`), { agent: "reviewer", slice: "S-1", attempt: 1, round, verdict: "block", findings: [{ id: "F-1", severity: "block", issue: "nope", authority: "criterion:C-3", evidence: [] }] });
    const r = stop(dir);
    if (round === 1) { assert.equal(r.json.decision, "block"); assert.equal(state(dir).stage, "building"); }
    else { assert.equal(r.json.decision, undefined); assert.equal(state(dir).stage, "awaiting_human"); assert.equal(state(dir).halt.code, "rounds_cap"); }
  }
  const auth = runCli(dir, ["authorize-rounds", "4"]);
  assert.equal(auth.json.stage, "building");
  assert.equal(state(dir).review.roundsAuthorized, 4);
});

test("escalation to the strong critic after two rejections", () => {
  const dir = buildingRepo();
  const profile = loadProfile(dir);
  const s = loadState(dir);
  s.slice.rejections = 2;
  s.slice.buildDone = true;
  s.stage = "preflight";
  s.preflight = { diffHash: workHash(dir), passed: true, at: new Date().toISOString(), checks: [] };
  const r = decide({ cwd: dir, state: s, profile });
  assert.match(r.reason, /handoff-harness:critic-strong/);
});

test("time budget exceeded rests the run; raising the budget resumes it", () => {
  const dir = buildingRepo();
  const s = loadState(dir);
  s.goal.approvedAt = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  saveState(dir, s);
  const r = stop(dir);
  assert.match(r.json.systemMessage, /Time budget of 120 minutes exceeded/);
  assert.equal(state(dir).stage, "budget_exceeded");
  assert.equal(runCli(dir, ["goal", "budget", "--minutes", "600"]).json.stage, "building");
});

test("stale verdict is rejected with the hash mismatch named", () => {
  const dir = buildingRepo();
  let s = loadState(dir);
  s.stage = "critic"; s.slice.buildDone = true;
  saveState(dir, s);
  const path = join(dir, ".harness/verdicts/S-1-a1-r1-critic.json");
  writeVerdict(dir, path, { agent: "critic", slice: "S-1", attempt: 1, round: 1, verdict: "pass" });
  writeFileSync(join(dir, "src/notes.mjs"), "// edited after the critic looked\n");
  const r = stop(dir);
  assert.match(r.json.reason, /judged a different change set/);
  assert.equal(state(dir).slice.staleVerdicts, 1);
});

test("auto-approve skips the human gate", () => {
  const dir = fixtureRepo();
  runCli(dir, ["init"]);
  runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff", "--auto-approve"]);
  writeIntake(dir);
  const r = stop(dir);
  assert.equal(r.json.decision, "block");
  assert.match(r.json.reason, /Stage: build, slice S-1/);
  assert.ok(state(dir).goal.approvedAt);
});

test("stop hook is silent outside a harness project", () => {
  const dir = fixtureRepo();
  const r = stop(dir);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, "");
});

test("a running background task in a judge stage lets the turn end without counting a block", () => {
  const dir = buildingRepo();
  let s = loadState(dir);
  s.stage = "critic"; s.slice.buildDone = true;
  saveState(dir, s);
  const before = s.guards.blocks;
  const r = stop(dir, { background_tasks: [{ id: "t1", type: "agent", status: "running", description: "critic" }] });
  assert.equal(r.json, null, r.stdout);
  s = state(dir);
  assert.equal(s.stage, "critic");
  assert.equal(s.guards.blocks, before, "a running task is not a stall");
  const again = stop(dir, { background_tasks: [{ id: "t1", type: "agent", status: "completed" }] });
  assert.equal(again.json.decision, "block");
  assert.equal(state(dir).guards.blocks, before + 1);
});

test("retry --stage resumes a halted run at a judge stage without rebuilding", () => {
  const dir = buildingRepo();
  let s = loadState(dir);
  s.stage = "halted"; s.slice.buildDone = true; s.halt = { reason: "x", at: new Date().toISOString(), code: "runaway" };
  saveState(dir, s);
  assert.match(runCli(dir, ["retry", "--stage", "nowhere"]).json.error, /--stage must be one of/);
  const r = runCli(dir, ["retry", "--stage", "critic"]);
  assert.equal(r.json.stage, "critic");
  s = state(dir);
  assert.equal(s.slice.buildDone, true);
  assert.equal(s.slice.attempt, 1);
  assert.equal(s.halt, null);
});
