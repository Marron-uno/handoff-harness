// Regressions for the G-3 retro (.harness/proposals/2026-10-16-G-3-retro.md, the run recorded as
// docs/runs/2026-10-16-self-run-3). Each test names the finding it keeps closed. R-3 and the lane
// change for sessions resting in a human-wait stage touch the guards and land through a goal run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli } from "./helpers.mjs";
import { fixtureRepo, writeIntake, state, stop, writeVerdict } from "./fixture.mjs";
import { loadState, saveState } from "../scripts/lib/state.mjs";
import { prepareReconcile } from "../scripts/lib/reconcile.mjs";
import { renderReport } from "../scripts/lib/report.mjs";

function buildingRepo() {
  const dir = fixtureRepo();
  runCli(dir, ["init"]);
  runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff", "--source", "handoff/HANDOFF.md"]);
  writeIntake(dir);
  stop(dir);
  runCli(dir, ["goal", "approve"]);
  stop(dir);
  assert.equal(state(dir).stage, "building");
  return dir;
}
const setStage = (dir, fn) => { const s = loadState(dir); fn(s); saveState(dir, s); return s; };
const readLog = (dir, rel) => readFileSync(join(dir, rel), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const met = (id) => ({ id, status: "met" });

test("R-2: a new goal keeps the previous goal's log, cost summary and intake artifacts under .harness/runs/ and takes the next id", () => {
  const dir = buildingRepo();
  writeFileSync(join(dir, ".harness/usage.json"), JSON.stringify({ goal: "G-1", totalUsd: 43.63 }));
  setStage(dir, (s) => { s.stage = "done"; s.slice = null; });
  const g2 = runCli(dir, ["goal", "new", "--sentence", "Second goal", "--mode", "feature"]);
  assert.equal(g2.json?.goal?.id, "G-2", g2.stdout);
  for (const f of ["events.jsonl", "usage.json", "plan.json", "inventory.json", "goal-card.md"]) assert.ok(existsSync(join(dir, ".harness/runs/G-1", f)), `${f} is kept with the first goal`);
  assert.ok(!existsSync(join(dir, ".harness/usage.json")), "the second goal's budget starts from zero");
  assert.ok(!existsSync(join(dir, ".harness/plan.json")));
  const kept = readLog(dir, ".harness/runs/G-1/events.jsonl");
  assert.ok(kept.some((e) => e.type === "goal" && e.action === "new" && e.id === "G-1"));
  assert.ok(kept.some((e) => e.type === "stage" && e.to === "building"));
  const log = readLog(dir, ".harness/events.jsonl");
  assert.equal(log[0].type, "goal");
  assert.equal(log[0].id, "G-2", "the new log starts with the new goal's event");
  assert.equal(runCli(dir, ["events", "--type", "stage"]).json.count, 0, "no transition of the old goal is in it");
  // A third goal is G-3 although the log now holds one goal event.
  setStage(dir, (s) => { s.stage = "done"; });
  const g3 = runCli(dir, ["goal", "new", "--sentence", "Third goal", "--mode", "feature"]);
  assert.equal(g3.json?.goal?.id, "G-3", g3.stdout);
  assert.equal(g3.json.branch, "goal/G-3");
  assert.ok(existsSync(join(dir, ".harness/runs/G-2/events.jsonl")));
  assert.equal(readLog(dir, ".harness/events.jsonl")[0].id, "G-3");
  // Decision and hold ids count within the goal, like the defaults and holds they name.
  assert.equal(runCli(dir, ["decide", "--text", "ship it"]).json.decision.id, "D-1");
  assert.equal(runCli(dir, ["hold", "--question", "Which host?"]).json.hold, "H-1");
});

test("R-4: slice skip lifts the halt with the slice, and the record stage with no slice names `harness next`", () => {
  const dir = buildingRepo();
  setStage(dir, (s) => { s.stage = "awaiting_human"; s.halt = { code: "attempt_cap", reason: "Slice S-1 failed 3 attempt(s) (critic_block).", at: new Date().toISOString() }; });
  const r = runCli(dir, ["slice", "skip", "--reason", "cut by the human"]);
  assert.equal(r.json?.ok, true, r.stdout);
  const s = state(dir);
  assert.equal(s.stage, "record");
  assert.equal(s.slice, null);
  assert.equal(s.halt, null, "the halt that handed the slice over goes with it");
  assert.equal(s.slices[0].status, "skipped");
  const resume = runCli(dir, ["resume"]).json;
  assert.equal(resume.halt, null);
  assert.match(resume.brief, /no active slice/);
  assert.match(resume.brief, /cli\.mjs" next/);
  assert.doesNotMatch(resume.brief, /cli\.mjs" record/);
  const rec = runCli(dir, ["record"]);
  assert.equal(rec.json?.ok, false);
  assert.match(rec.json.error, /harness next/);
  const next = runCli(dir, ["next"]).json;
  assert.equal(next.stage, "building", "S-2 depends on S-1, and a skipped dependency counts as settled");
  assert.equal(state(dir).slice.id, "S-2");
  assert.equal(state(dir).halt, null);
});

test("R-5: a skipped slice's verdicts count for nothing, and only the recorded attempt of a slice sets its criteria", () => {
  const dir = buildingRepo();
  const vdir = join(dir, ".harness/verdicts");
  setStage(dir, (s) => {
    s.stage = "reconcile"; s.slice = null;
    s.slices[0].status = "skipped"; s.slices[0].attempts = 6;
    s.slices[1].status = "done"; s.slices[1].attempts = 2;
  });
  // S-1 passed both judges at attempt 4; attempts 5 and 6 blocked and the human skipped the slice.
  writeVerdict(dir, join(vdir, "S-1-a4-r1-critic.json"), { agent: "critic", slice: "S-1", attempt: 4, round: 1, verdict: "pass", criteria: [met("C-3"), met("C-4")] });
  writeVerdict(dir, join(vdir, "S-1-a4-r1-reviewer.json"), { agent: "reviewer", slice: "S-1", attempt: 4, round: 1, verdict: "pass", criteria: [met("C-3"), met("C-4")] });
  writeVerdict(dir, join(vdir, "S-1-a6-r1-critic.json"), { agent: "critic", slice: "S-1", attempt: 6, round: 1, verdict: "block", findings: [{ id: "F-1", severity: "block", issue: "sort order", authority: "criterion:C-3", evidence: [] }], criteria: [{ id: "C-3", status: "unmet" }, met("C-4")] });
  // S-2 passed at attempt 1, was retried, and its recorded attempt 2 holds the critic's block so far.
  writeVerdict(dir, join(vdir, "S-2-a1-r1-reviewer.json"), { agent: "reviewer", slice: "S-2", attempt: 1, round: 1, verdict: "pass", criteria: [met("C-6")] });
  writeVerdict(dir, join(vdir, "S-2-a2-r1-critic.json"), { agent: "critic", slice: "S-2", attempt: 2, round: 1, verdict: "block", findings: [{ id: "F-1", severity: "block", issue: "export misses a note", authority: "criterion:C-6", evidence: [] }], criteria: [{ id: "C-6", status: "unmet" }] });
  let text = renderReport(dir, state(dir));
  assert.match(text, /\| C-3 \| skipped \|/, "a skipped slice's criteria read skipped, whatever its verdicts said");
  assert.match(text, /\| C-4 \| skipped \|/);
  assert.match(text, /\| C-6 \| unmet \|/, "the recorded attempt, not the pass before the retry");
  let items = prepareReconcile(dir, state(dir)).items;
  const item = (id) => items.find((i) => i.id === id);
  assert.equal(item("I-2").decided, null, "the skipped slice's passes do not mark its item done");
  assert.equal(item("I-2").bucket, "model");
  assert.ok(!item("I-2").evidence.some((e) => e.type === "verdict"));
  assert.equal(item("I-4").decided, null, "a pass from before the retry does not count either");
  // The recorded attempt passes: C-6 is met and I-4 is done deterministically; I-2 is still the model's.
  writeVerdict(dir, join(vdir, "S-2-a2-r1-reviewer.json"), { agent: "reviewer", slice: "S-2", attempt: 2, round: 1, verdict: "pass", criteria: [met("C-6")] });
  text = renderReport(dir, state(dir));
  assert.match(text, /\| C-6 \| met \|/);
  items = prepareReconcile(dir, state(dir)).items;
  assert.equal(item("I-4").decided, "done");
  assert.equal(item("I-2").decided, null);
});
