import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runCli, sh } from "./helpers.mjs";
import { fixtureRepo, writeIntake, state, hash, stop, writeVerdict } from "./fixture.mjs";

test("a goal runs intake → approval → two slices → reconcile → report → done through the Stop hook", async () => {
  const dir = fixtureRepo();
  assert.equal(runCli(dir, ["init"]).json.ok, true);
  const created = runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff", "--source", "handoff/HANDOFF.md"]);
  assert.equal(created.json.ok, true, created.stdout);
  assert.equal(created.json.branch, "goal/G-1");
  assert.equal(sh(dir, "git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim(), "goal/G-1");

  // Intake incomplete: the hook blocks and names what is missing.
  let r = stop(dir);
  assert.equal(r.json.decision, "block", r.stdout);
  assert.match(r.json.reason, /inventory\.json/);
  assert.equal(state(dir).guards.blocks, 1);

  writeIntake(dir);
  r = stop(dir);
  assert.equal(r.json?.decision, undefined, r.stdout);
  assert.match(r.json.systemMessage, /Goal card ready/);
  assert.equal(state(dir).stage, "awaiting_approval");
  assert.equal(state(dir).guards.blocks, 0);

  // Resting stage: stopping again is allowed without side effects.
  r = stop(dir);
  assert.equal(r.code, 0);
  assert.equal(state(dir).stage, "awaiting_approval");

  const approved = runCli(dir, ["goal", "approve"]);
  assert.equal(approved.json.ok, true, approved.stdout);
  assert.equal(approved.json.slices, 2);
  assert.equal(approved.json.holds, 1);

  r = stop(dir);
  assert.equal(r.json.decision, "block");
  assert.match(r.json.reason, /Stage: build, slice S-1/);
  let s = state(dir);
  assert.equal(s.stage, "building");
  assert.deepEqual(s.slice.id, "S-1");
  assert.equal(s.slices[0].status, "building");

  // Build attempt 1 for S-1.
  writeFileSync(join(dir, "src/notes.mjs"), readFileSync(join(dir, "src/notes.mjs"), "utf8").replace("return [...store];", "return [...store].sort((a, b) => b.createdAt.localeCompare(a.createdAt));"));
  r = stop(dir);
  assert.match(r.json.reason, /slice done/);
  assert.equal(runCli(dir, ["slice", "done"]).json.ok, true);
  r = stop(dir);
  assert.match(r.json.reason, /Stage: preflight/);
  assert.equal(state(dir).stage, "preflight");

  const pf = runCli(dir, ["preflight"]);
  assert.equal(pf.json.passed, true, pf.stdout);
  assert.ok(pf.json.checks.some((c) => c.id === "project:test" && c.status === "pass"));
  r = stop(dir);
  assert.match(r.json.reason, /Stage: critic/);
  assert.match(r.json.reason, /handoff-harness:critic/);
  const criticPath = r.json.reason.match(/to `([^`]+S-1-a1-r1-critic\.json)`/)[1];
  assert.equal(state(dir).stage, "critic");

  // Critic missing → block again; then a pass verdict moves to review.
  r = stop(dir);
  assert.match(r.json.reason, /Stage: critic/);
  writeVerdict(dir, criticPath, { agent: "critic", slice: "S-1", attempt: 1, round: 1, verdict: "pass", criteria: [{ id: "C-3", status: "met" }, { id: "C-4", status: "met" }] });
  r = stop(dir);
  assert.match(r.json.reason, /Stage: review, slice S-1 .*round 1 of 3/);
  const reviewPath = r.json.reason.match(/to `([^`]+S-1-a1-r1-reviewer\.json)`/)[1];
  assert.equal(state(dir).stage, "review");

  // A pass that carries a block finding is rejected by the validator.
  writeVerdict(dir, reviewPath, { agent: "reviewer", slice: "S-1", attempt: 1, round: 1, verdict: "pass", findings: [{ id: "F-1", severity: "block", issue: "x", authority: "criterion:C-3", evidence: [] }] });
  r = stop(dir);
  assert.match(r.json.reason, /verdict is pass but carries 1 block finding/);
  assert.equal(state(dir).stage, "review");

  // Reviewer blocks with a real finding → back to build, round counted, same attempt.
  writeVerdict(dir, reviewPath, { agent: "reviewer", slice: "S-1", attempt: 1, round: 1, verdict: "block", findings: [{ id: "F-1", severity: "block", file: "src/notes.mjs", line: 10, issue: "no test covers the sort order", suggestion: "add a test", authority: "criterion:C-3", evidence: [{ type: "diff", path: "src/notes.mjs" }] }], criteria: [{ id: "C-3", status: "unverified" }] });
  r = stop(dir);
  assert.match(r.json.reason, /Stage: build, slice S-1 .*attempt 1 of 3/);
  assert.match(r.json.reason, /Reviewer blocked \(round 1\)/);
  assert.match(r.json.reason, /F-1 \[block\] src\/notes.mjs:10 no test covers the sort order/);
  s = state(dir);
  assert.equal(s.stage, "building");
  assert.equal(s.review.rounds, 1);
  assert.equal(s.slice.attempt, 1);
  assert.equal(s.slice.rejections, 1);

  // Fix: add the test; second cycle passes.
  writeFileSync(join(dir, "tests/sort.test.mjs"), `import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { createNote, listNotes } from "../src/notes.mjs";\ntest("newest first", () => { const s = []; createNote(s, { title: "a" }); s[0].createdAt = "2020-01-01"; createNote(s, { title: "b" }); assert.equal(listNotes(s)[0].title, "b"); });\n`);
  runCli(dir, ["slice", "done"]);
  stop(dir);
  assert.equal(runCli(dir, ["preflight"]).json.passed, true);
  r = stop(dir);
  const critic2 = r.json.reason.match(/to `([^`]+S-1-a1-r2-critic\.json)`/)[1];
  writeVerdict(dir, critic2, { agent: "critic", slice: "S-1", attempt: 1, round: 2, verdict: "pass", criteria: [{ id: "C-3", status: "met" }, { id: "C-4", status: "met" }] });
  r = stop(dir);
  const review2 = r.json.reason.match(/to `([^`]+S-1-a1-r2-reviewer\.json)`/)[1];
  writeVerdict(dir, review2, { agent: "reviewer", slice: "S-1", attempt: 1, round: 2, verdict: "pass", criteria: [{ id: "C-3", status: "met" }, { id: "C-4", status: "met" }] });
  r = stop(dir);
  assert.match(r.json.reason, /Stage: record, slice S-1/);
  assert.equal(state(dir).stage, "record");

  // Record is enforced: stopping without the commit blocks; the cli commits with the slice id.
  r = stop(dir);
  assert.match(r.json.reason, /Stage: record/);
  const rec = runCli(dir, ["record"]);
  assert.equal(rec.json.ok, true, rec.stdout);
  assert.ok(rec.json.files.includes("src/notes.mjs") && rec.json.files.includes("tests/sort.test.mjs"));
  assert.equal(rec.json.push.attempted, false);
  assert.match(sh(dir, "git", ["log", "-1", "--pretty=%s"]).stdout, /\[S-1\] \(G-1\)/);
  assert.equal(sh(dir, "git", ["status", "--porcelain"]).stdout.trim(), "");

  r = stop(dir);
  assert.match(r.json.reason, /Stage: build, slice S-2 "Export to markdown"/);
  s = state(dir);
  assert.equal(s.slices[0].status, "done");
  assert.ok(s.slices[0].commit);
  assert.equal(s.slice.id, "S-2");
  assert.equal(s.review.rounds, 0);

  // S-2 straight through.
  writeFileSync(join(dir, "src/export.mjs"), `export function exportMarkdown(store) { return store.map((n) => \`## \${n.title}\\n\\n\${n.body}\\n\`).join("\\n"); }\n`);
  writeFileSync(join(dir, "tests/export.test.mjs"), `import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { exportMarkdown } from "../src/export.mjs";\ntest("C-6 one section per note", () => { assert.match(exportMarkdown([{ title: "t", body: "b" }]), /## t\\n\\nb/); });\n`);
  runCli(dir, ["slice", "done"]);
  stop(dir);
  assert.equal(runCli(dir, ["preflight"]).json.passed, true);
  r = stop(dir);
  writeVerdict(dir, r.json.reason.match(/to `([^`]+critic\.json)`/)[1], { agent: "critic", slice: "S-2", attempt: 1, round: 1, verdict: "pass", criteria: [{ id: "C-6", status: "met" }] });
  r = stop(dir);
  writeVerdict(dir, r.json.reason.match(/to `([^`]+reviewer\.json)`/)[1], { agent: "reviewer", slice: "S-2", attempt: 1, round: 1, verdict: "pass", criteria: [{ id: "C-6", status: "met" }] });
  stop(dir);
  assert.equal(runCli(dir, ["record"]).json.ok, true);
  r = stop(dir);
  assert.match(r.json.reason, /Stage: reconcile/);
  assert.equal(state(dir).stage, "reconcile");

  // Reconcile: deterministic evidence marks items with met criteria; the model decides the rest.
  const prep = runCli(dir, ["reconcile", "prepare"]);
  assert.equal(prep.json.ok, true, prep.stdout);
  assert.equal(prep.json.items, 3);
  assert.equal(prep.json.decidedDeterministically, 2);
  const input = JSON.parse(readFileSync(join(dir, ".harness/reconcile-input.json"), "utf8"));
  assert.equal(input.items.find((i) => i.id === "I-1").bucket, "model");
  // A gap with no proposed slice and no explicit decision is rejected.
  writeFileSync(join(dir, ".harness/verdicts/reconcile.json"), JSON.stringify({ goal: "G-1", diffHash: hash(dir), items: [{ id: "I-1", status: "missing" }], newSlices: [] }));
  const rejected = runCli(dir, ["reconcile", "load"]);
  assert.equal(rejected.json.ok, false);
  assert.match(rejected.json.errors[0], /I-1\) but newSlices is empty/);
  writeFileSync(join(dir, ".harness/verdicts/reconcile.json"), JSON.stringify({ goal: "G-1", diffHash: hash(dir), items: [{ id: "I-1", status: "done", evidence: [{ type: "test", path: "tests/notes.test.mjs" }] }], newSlices: [] }));
  const loaded = runCli(dir, ["reconcile", "load"]);
  assert.equal(loaded.json.ok, true, loaded.stdout);
  assert.equal(loaded.json.missing, 0);
  r = stop(dir);
  assert.match(r.json.reason, /Stage: report/);

  // Report, then the goal predicate decides done.
  assert.equal(runCli(dir, ["goal", "check"]).json.done, false);
  assert.equal(runCli(dir, ["report"]).json.ok, true);
  const check = runCli(dir, ["goal", "check"]).json;
  assert.equal(check.done, true, JSON.stringify(check));
  r = stop(dir);
  assert.equal(r.json.decision, undefined, r.stdout);
  assert.match(r.json.systemMessage, /Goal G-1 complete/);
  s = state(dir);
  assert.equal(s.stage, "done");
  const report = readFileSync(join(dir, ".harness/report.md"), "utf8");
  assert.match(report, /# G-1: Build all of the handoff/);
  assert.match(report, /\| S-1 \| List notes newest first \| done \| 1 \|/);
  assert.match(report, /H-1: Public URL/);
  assert.ok(existsSync(join(dir, ".harness/reports/G-1.md")));

  // Events are the record: every transition and block is there.
  const ev = runCli(dir, ["events", "--last", "500"]).json.events;
  assert.ok(ev.filter((e) => e.type === "stage").length >= 14);
  assert.ok(ev.some((e) => e.type === "verdict" && e.valid === false));
  assert.ok(ev.some((e) => e.type === "record" && e.slice === "S-2"));

  // A second goal gets the next id and a fresh branch.
  const g2 = runCli(dir, ["goal", "new", "--sentence", "Add tag filtering", "--mode", "feature"]);
  assert.equal(g2.json.goal.id, "G-2");
  assert.equal(g2.json.branch, "goal/G-2");
});
