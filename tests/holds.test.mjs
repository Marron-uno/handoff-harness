import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, sh } from "./helpers.mjs";
import { fixtureRepo, writeIntake, state, stop, hash } from "./fixture.mjs";
import { appendEvent } from "../scripts/lib/events.mjs";

// A run whose only unbuilt slice is blocked by a hold, at the report stage with the report written.
function heldRepo() {
  const dir = fixtureRepo();
  runCli(dir, ["init"]);
  runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff", "--source", "handoff/HANDOFF.md"]);
  writeIntake(dir);
  const plan = JSON.parse(readFileSync(join(dir, ".harness/plan.json"), "utf8"));
  plan.questions.find((q) => q.id === "H-1").blocks = ["S-2"];
  writeFileSync(join(dir, ".harness/plan.json"), JSON.stringify(plan, null, 2));
  stop(dir);
  runCli(dir, ["goal", "approve"]);
  stop(dir);
  const s = state(dir);
  assert.equal(s.slice.id, "S-1");
  assert.deepEqual(s.holds[0].blocks, ["S-2"]);
  // S-1 done without the ceremony; the machine is then asked to judge the end of the run.
  s.slices[0].status = "done"; s.slices[0].commit = sh(dir, "git", ["rev-parse", "HEAD"]).stdout.trim();
  s.slice = null; s.stage = "report"; s.stageEnteredAt = new Date(Date.now() - 5000).toISOString();
  s.reconcile = { diffHash: hash(dir), at: new Date().toISOString(), missing: 0, path: join(dir, ".harness/verdicts/reconcile.json") };
  s.reconcilePasses = 1;
  writeFileSync(join(dir, ".harness/state.json"), JSON.stringify(s));
  writeFileSync(join(dir, ".harness/report.md"), "# G-1\n");
  return dir;
}

test("a slice blocked by a hold leaves the run waiting for a human, not done; answering the hold builds it", () => {
  const dir = heldRepo();
  const check = runCli(dir, ["goal", "check"]).json;
  assert.equal(check.done, true, "held slices do not fail the predicate");
  assert.deepEqual(check.heldPending, [{ slice: "S-2", hold: "H-1", question: "Public URL of the deployed page?" }]);
  let r = stop(dir);
  assert.equal(r.json?.decision, undefined, r.stdout);
  assert.match(r.json.systemMessage, /Waiting on a human for:\n- S-2: H-1 "Public URL of the deployed page\?"/);
  assert.match(r.json.systemMessage, /hold answer --id H-n/);
  let s = state(dir);
  assert.equal(s.stage, "awaiting_human");
  assert.equal(s.halt.code, "holds_open");
  assert.equal(runCli(dir, ["events", "--type", "goal"]).json.events.filter((e) => e.action === "done").length, 0, "no done event");

  const bad = runCli(dir, ["hold", "answer", "--id", "H-9", "--answer", "x"]);
  assert.equal(bad.json.ok, false);
  assert.match(bad.json.error, /no open hold H-9; open holds: H-1/);

  const ans = runCli(dir, ["hold", "answer", "--id", "H-1", "--answer", "https://notes.example.test"]);
  assert.equal(ans.json.ok, true, ans.stdout);
  assert.equal(ans.json.stage, "building");
  assert.deepEqual(ans.json.holds, []);
  assert.match(ans.json.brief, /Stage: build, slice S-2/);
  s = state(dir);
  assert.equal(s.halt, null);
  assert.equal(s.slice.id, "S-2");
  assert.equal(s.slices[1].status, "building");
  assert.equal(s.defaults.at(-1).question, "Public URL of the deployed page?");
  assert.equal(s.defaults.at(-1).chosen, "https://notes.example.test");
  assert.equal(s.defaults.at(-1).id, "D-2", "the answer gets the next default id after the plan's D-1");
  const holdEvents = runCli(dir, ["events", "--type", "hold"]).json.events;
  assert.equal(holdEvents.at(-1).action, "answered");
  // Adding another hold later numbers past the answered one.
  assert.equal(runCli(dir, ["hold", "--question", "Another?", "--blocks", "S-2"]).json.hold, "H-2", "hold ids never repeat, even after an answer");
});

test("report --refresh re-renders with the driver's session figure and commits the copy without advancing", () => {
  const dir = heldRepo();
  stop(dir);
  assert.equal(state(dir).stage, "awaiting_human");
  appendEvent(dir, { type: "session", scope: "driver", iteration: 1, stage: "intake", seconds: 300, turns: 16, usd: 0.884, isError: false });
  const r = runCli(dir, ["report", "--refresh"]);
  assert.equal(r.json.ok, true, r.stdout);
  assert.equal(r.json.refreshed, true);
  assert.equal(r.json.stage, "awaiting_human", "a refresh does not move the machine");
  assert.ok(r.json.commit, "the reports copy was committed");
  const report = readFileSync(join(dir, ".harness/report.md"), "utf8");
  assert.match(report, /Reported by Claude Code: \$0\.884 over 1 headless session\(s\)/);
  assert.match(report, /- H-1: Public URL of the deployed page\? \(blocks S-2\)/);
  assert.equal(sh(dir, "git", ["log", "-1", "--format=%s"]).stdout.trim(), "docs: harness report [G-1]");
  assert.equal(state(dir).stage, "awaiting_human");
});
