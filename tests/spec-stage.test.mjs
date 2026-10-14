import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runCli, runHook, sh, PLUGIN_ROOT } from "./helpers.mjs";
import { fixtureRepo, state, hash, stop, writeVerdict } from "./fixture.mjs";
import { parseDelta, parseTasks, tickTasks, planTaskProblems, changeSlug, citedIds } from "../scripts/lib/openspec.mjs";
import { checkFileAccess } from "../scripts/lib/guards/path-guard.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";
import { renderReport } from "../scripts/lib/report.mjs";

const OPENSPEC = join(PLUGIN_ROOT, "node_modules", ".bin", "openspec");
const fixtureDelta = readFileSync(join(PLUGIN_ROOT, "fixture/openspec/changes/lantern-v0-2/specs/notes/spec.md"), "utf8");
const fixtureTasks = readFileSync(join(PLUGIN_ROOT, "fixture/openspec/changes/lantern-v0-2/tasks.md"), "utf8");

test("parseDelta reads OpenSpec delta headers, requirements and scenarios", () => {
  const ops = parseDelta(fixtureDelta);
  assert.deepEqual(ops.map((o) => o.op), ["MODIFIED", "ADDED"]);
  const listed = ops[0].requirements[0];
  assert.equal(listed.name, "List notes");
  assert.match(listed.text, /SHALL return a copy/);
  assert.deepEqual(listed.scenarios.map((s) => s.name), ["Copy", "Newest first", "Tag filter"]);
  assert.equal(listed.scenarios[2].when, '`listNotes(store, { tag: "Work" })` is called');
  assert.match(listed.scenarios[2].then, /only notes tagged/);
  assert.equal(ops[1].requirements[0].name, "Export to markdown");
  assert.equal(ops[1].requirements[0].scenarios.length, 1);
  // No header at all is reported as UNKNOWN so the check can name it.
  assert.equal(parseDelta("### Requirement: Loose\n\nThe thing SHALL work.\n")[0].op, "UNKNOWN");
  assert.deepEqual(parseDelta("## RENAMED Requirements\n- FROM: `### Requirement: A`\n- TO: `### Requirement: B`\n")[0], { op: "RENAMED", requirements: [] });
});

test("parseDelta agrees with the pinned openspec parser on the fixture change", { skip: !existsSync(OPENSPEC) && "openspec not installed" }, () => {
  const dir = fixtureRepo();
  const r = spawnSync(OPENSPEC, ["show", "lantern-v0-2", "--json", "--deltas-only", "--no-interactive"], { cwd: dir, encoding: "utf8" });
  const theirs = JSON.parse(r.stdout).deltas.map((d) => ({ op: d.operation, name: d.requirement.name, scenarios: d.requirement.scenarios.length })).sort((a, b) => a.name.localeCompare(b.name));
  const ours = parseDelta(fixtureDelta).flatMap((o) => o.requirements.map((q) => ({ op: o.op, name: q.name, scenarios: q.scenarios.length }))).sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(ours, theirs);
});

test("tasks parse, tick, and must each belong to one slice", () => {
  const tasks = parseTasks(fixtureTasks);
  assert.deepEqual(tasks.map((t) => t.id), ["1.1", "1.2", "2.1", "3.1"]);
  assert.equal(tasks[0].done, false);
  assert.match(tasks[0].text, /\(I-2, C-3\)/);
  assert.deepEqual([...citedIds(tasks[0].text)], ["I-2", "C-3"]);
  const noId = parseTasks("- [ ] Do the thing\n- [x] 2 Done thing\n");
  assert.equal(noId[0].id, null);
  assert.equal(noId[1].done, true);

  const { text, ticked } = tickTasks(fixtureTasks, ["1.1", "2.1", "9.9"]);
  assert.deepEqual(ticked, ["1.1", "2.1"]);
  assert.match(text, /- \[x\] 1\.1 Sort newest first/);
  assert.match(text, /- \[ \] 1\.2 Filter by tag/);
  assert.match(text, /- \[x\] 2\.1 /);
  assert.equal(parseTasks(text).filter((t) => t.done).length, 2);
  // Ticking is idempotent and keeps everything else byte-identical.
  assert.equal(tickTasks(text, ["1.1"]).text, text);

  const plan = { slices: [{ id: "S-1", tasks: ["1.1", "1.2"] }, { id: "S-2", tasks: ["1.2", "7.7"] }] };
  const problems = planTaskProblems(plan, tasks);
  assert.ok(problems.some((p) => p.includes("task 1.2 belongs to both S-1 and S-2")), problems.join("\n"));
  assert.ok(problems.some((p) => p.includes("names task 7.7, which is not in tasks.md")));
  assert.ok(problems.some((p) => p.includes("tasks owned by no slice: 2.1, 3.1")));
  assert.deepEqual(planTaskProblems({ slices: [{ id: "S-1", tasks: ["1.1", "1.2", "2.1", "3.1"] }] }, tasks), []);

  assert.equal(changeSlug("G-7", "Build all of the handoff!"), "g-7-build-all-of-the-handoff");
  assert.equal(changeSlug("G-1", "  ???  "), "g-1-goal");
});

function writeInventory(dir) {
  const inventory = {
    goal: "G-1", sources: ["handoff/HANDOFF.md"],
    items: [
      { id: "I-1", kind: "endpoint", title: "Create a note", criteria: [{ id: "C-1", text: "rejects empty title" }, { id: "C-2", text: "note has fields" }], ui: false },
      { id: "I-2", kind: "endpoint", title: "List newest first", criteria: [{ id: "C-3", text: "sorted desc" }, { id: "C-4", text: "copy" }], ui: false },
      { id: "I-3", kind: "endpoint", title: "Filter by tag", criteria: [{ id: "C-5", text: "only notes with the tag" }], ui: false },
      { id: "I-4", kind: "endpoint", title: "Export to markdown", criteria: [{ id: "C-6", text: "one section per note" }], ui: false },
      { id: "I-5", kind: "screen", title: "Note count on the page", criteria: [{ id: "C-7", text: "page shows N notes" }], ui: true },
    ],
  };
  mkdirSync(join(dir, ".harness"), { recursive: true });
  writeFileSync(join(dir, ".harness", "inventory.json"), JSON.stringify(inventory, null, 2));
}

function writePlan(dir, slices) {
  const plan = {
    goal: "G-1", slices,
    questions: [
      { id: "D-1", question: "Tags case-insensitive?", kind: "default", chosen: "yes, lowercase compare" },
      { id: "H-1", question: "Public URL of the deployed page?", kind: "hold", blocks: [] },
    ],
  };
  writeFileSync(join(dir, ".harness", "plan.json"), JSON.stringify(plan, null, 2));
}

const PLAN = [
  { id: "S-1", title: "Listing", criteria: ["C-1", "C-2", "C-3", "C-4", "C-5"], paths: ["src/notes.mjs", "tests/**"], ui: false, tasks: ["1.1", "1.2", "1.3"] },
  { id: "S-2", title: "Export to markdown", criteria: ["C-6"], paths: ["src/export.mjs", "tests/**"], dependsOn: ["S-1"], ui: false, tasks: ["2.1"] },
  { id: "S-3", title: "Note count on the page", criteria: ["C-7"], paths: ["public/**", "src/server.mjs", "tests/**"], dependsOn: ["S-1"], ui: true, tasks: ["3.1"] },
];

function specVerdict(dir, path, { attempt, verdict, findings = [] }) {
  const v = { version: 1, agent: "spec-reviewer", goal: "G-1", slice: null, attempt, diffHash: hash(dir), verdict, summary: `spec ${verdict}`, findings, criteria: [], writtenAt: new Date().toISOString() };
  mkdirSync(join(dir, ".harness", "verdicts"), { recursive: true });
  writeFileSync(path, JSON.stringify(v, null, 2));
}

test("the spec stage adopts the fixture change, checks coverage, gates on the spec reviewer, commits at approval and ticks tasks at record", () => {
  const dir = fixtureRepo();
  runCli(dir, ["init"]);
  assert.equal(runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff", "--change", "lantern-v0-2"]).json.ok, false, "--change needs the spec stage");
  const created = runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff", "--source", "handoff/HANDOFF.md", "--openspec", "--change", "lantern-v0-2"]);
  assert.equal(created.json.ok, true, created.stdout);
  assert.equal(created.json.spec.change, "lantern-v0-2");
  assert.match(created.json.next, /harness spec check/);

  // The spec check runs on a goal with the stage; it names what the change does not cover yet.
  let r = stop(dir);
  assert.equal(r.json.decision, "block");
  assert.match(r.json.reason, /Stage: intake \(G-1\), OpenSpec change `lantern-v0-2`/);
  assert.match(r.json.reason, /inventory\.json/);
  assert.match(r.json.reason, /no \.harness\/inventory\.json yet/);

  writeInventory(dir);
  let check = runCli(dir, ["spec", "check"]).json;
  assert.equal(check.ok, false);
  assert.ok(check.problems.some((p) => p.includes("in-scope criteria cited nowhere in the change: C-1, C-2, C-4")), JSON.stringify(check.problems));
  assert.deepEqual(check.coverage.uncited, ["C-1", "C-2", "C-4"]);
  assert.equal(check.validate.status, existsSync(OPENSPEC) ? "pass" : "skip");
  assert.deepEqual(check.tasks.map((t) => t.id), ["1.1", "1.2", "2.1", "3.1"]);

  // Amend the adopted change: a task that verifies the already-implemented behavior.
  const tasksPath = join(dir, "openspec/changes/lantern-v0-2/tasks.md");
  writeFileSync(tasksPath, readFileSync(tasksPath, "utf8").replace("- [ ] 1.2 Filter by tag (I-3, C-5)\n", "- [ ] 1.2 Filter by tag (I-3, C-5)\n- [ ] 1.3 Verify create and copy behavior with tests (I-1, C-1, C-2, C-4)\n"));
  check = runCli(dir, ["spec", "check"]).json;
  assert.equal(check.problems.length, 0, JSON.stringify(check.problems));
  assert.deepEqual(check.planProblems, ["plan.json not written yet"]);
  assert.equal(check.coverage.cited, 7);

  // Every task must belong to exactly one slice.
  writePlan(dir, PLAN.map((s) => (s.id === "S-3" ? { ...s, tasks: [] } : s)));
  writeFileSync(join(dir, ".harness/goal-card.md"), "# Goal card G-1\n");
  r = stop(dir);
  assert.match(r.json.reason, /tasks owned by no slice: 3\.1/);
  assert.equal(state(dir).stage, "intake");
  writePlan(dir, PLAN);
  check = runCli(dir, ["spec", "check"]).json;
  assert.equal(check.ok, true, JSON.stringify(check));

  // Intake complete: the machine moves to spec review, not to the human.
  let nx = runCli(dir, ["next"]).json;
  assert.equal(nx.stage, "spec_review", JSON.stringify(nx));
  assert.match(nx.brief, /Stage: spec review \(G-1\), change `lantern-v0-2`, attempt 1 of 3/);
  assert.match(nx.brief, /2 requirement\(s\), 4 scenario\(s\), 5 task\(s\), 7\/7 criteria cited/);
  const path1 = nx.brief.match(/to `([^`]+spec-a1-spec-reviewer\.json)`/)[1];
  assert.equal(state(dir).spec.attempt, 1);

  // Lanes: the main session edits nothing while the spec reviewer judges.
  const profile = loadProfile(dir);
  const denied = checkFileAccess({ tool: "Write", filePath: join(dir, "src/notes.mjs"), cwd: dir, profile, state: state(dir), agentType: null, pluginRoot: PLUGIN_ROOT });
  assert.equal(denied.deny, true);
  assert.match(denied.reason, /stage spec_review does not edit source/);
  // The spec reviewer cannot finish without a verdict.
  const hook = runHook("subagent-stop", { cwd: dir, hook_event_name: "SubagentStop", agent_type: "handoff-harness:spec-reviewer", stop_hook_active: false });
  assert.equal(hook.json.decision, "block", hook.stdout);
  assert.match(hook.json.reason, /slice null, attempt 1/);

  // A block sends intake back to the change with the findings; the attempt counts.
  specVerdict(dir, path1, { attempt: 1, verdict: "block", findings: [{ id: "F-1", severity: "block", file: "openspec/changes/lantern-v0-2/specs/notes/spec.md", line: null, issue: "no requirement covers the note count on the page", suggestion: "add an ADDED requirement for the page count", authority: "handoff:handoff/HANDOFF.md", evidence: [{ type: "file", path: "handoff/HANDOFF.md", quote: "C-7: the page at / shows N notes" }] }] });
  r = stop(dir);
  assert.equal(r.json.decision, "block");
  assert.match(r.json.reason, /Spec reviewer blocked \(attempt 1\)/);
  assert.match(r.json.reason, /F-1 \[block\] openspec\/changes\/lantern-v0-2\/specs\/notes\/spec\.md no requirement covers the note count/);
  let s = state(dir);
  assert.equal(s.stage, "intake");
  assert.equal(s.spec.attempt, 2);
  assert.ok(s.spec.verdict.endsWith("/spec-a1-spec-reviewer.json"), s.spec.verdict);

  // Fix the change, then the second attempt gets its own verdict path; a wrong attempt is rejected.
  const deltaPath = join(dir, "openspec/changes/lantern-v0-2/specs/notes/spec.md");
  writeFileSync(deltaPath, readFileSync(deltaPath, "utf8") + "\n### Requirement: Note count on the page\n\nThe page at `/` SHALL show the number of notes in the store as \"N notes\" (C-7).\n\n#### Scenario: Count shown\n\n- **WHEN** the page loads with two notes in the store\n- **THEN** it shows \"2 notes\"\n");
  r = stop(dir);
  assert.match(r.json.reason, /attempt 2 of 3/);
  const path2 = r.json.reason.match(/to `([^`]+spec-a2-spec-reviewer\.json)`/)[1];
  specVerdict(dir, path2, { attempt: 1, verdict: "pass" });
  r = stop(dir);
  assert.match(r.json.reason, /attempt 1 is not the active spec attempt 2/);
  specVerdict(dir, path2, { attempt: 2, verdict: "pass" });
  r = stop(dir);
  assert.equal(r.json.decision, undefined, r.stdout);
  assert.match(r.json.systemMessage, /Goal card ready/);
  assert.equal(state(dir).stage, "awaiting_approval");

  // Approval commits the reviewed change, so the first slice starts from a clean tree.
  assert.notEqual(sh(dir, "git", ["status", "--porcelain", "--", "openspec"]).stdout.trim(), "");
  const approved = runCli(dir, ["goal", "approve"]).json;
  assert.equal(approved.ok, true, JSON.stringify(approved));
  assert.ok(approved.specCommit, "the change was committed");
  assert.equal(sh(dir, "git", ["log", "-1", "--pretty=%s"]).stdout.trim(), "spec: lantern-v0-2 (G-1)");
  assert.equal(sh(dir, "git", ["status", "--porcelain"]).stdout.trim(), "");
  assert.equal(state(dir).spec.committed, approved.specCommit);
  assert.deepEqual(state(dir).slices.map((x) => x.tasks), [["1.1", "1.2", "1.3"], ["2.1"], ["3.1"]]);

  // Build S-1 and pass both judges; record ticks the slice's tasks inside the slice commit.
  r = stop(dir);
  assert.match(r.json.reason, /Stage: build, slice S-1/);
  writeFileSync(join(dir, "src/notes.mjs"), readFileSync(join(dir, "src/notes.mjs"), "utf8").replace("return [...store];", "return [...store].sort((a, b) => b.createdAt.localeCompare(a.createdAt));"));
  assert.equal(runCli(dir, ["slice", "done"]).json.stage, "preflight");
  const pf = runCli(dir, ["preflight"]).json;
  assert.equal(pf.passed, true, JSON.stringify(pf.checks.filter((c) => c.status === "fail")));
  const criticPath = pf.brief.match(/to `([^`]+S-1-a1-r1-critic\.json)`/)[1];
  const met = ["C-1", "C-2", "C-3", "C-4", "C-5"].map((id) => ({ id, status: "met" }));
  writeVerdict(dir, criticPath, { agent: "critic", slice: "S-1", attempt: 1, round: 1, verdict: "pass", criteria: met });
  nx = runCli(dir, ["next"]).json;
  const reviewPath = nx.brief.match(/to `([^`]+S-1-a1-r1-reviewer\.json)`/)[1];
  writeVerdict(dir, reviewPath, { agent: "reviewer", slice: "S-1", attempt: 1, round: 1, verdict: "pass", criteria: met });
  assert.equal(runCli(dir, ["next"]).json.stage, "record");
  const rec = runCli(dir, ["record"]).json;
  assert.equal(rec.ok, true, JSON.stringify(rec));
  assert.deepEqual(rec.tasks, ["1.1", "1.2", "1.3"]);
  assert.ok(rec.files.includes("openspec/changes/lantern-v0-2/tasks.md"), rec.files.join(","));
  const ticked = readFileSync(tasksPath, "utf8");
  assert.match(ticked, /- \[x\] 1\.1 /);
  assert.match(ticked, /- \[x\] 1\.3 /);
  assert.match(ticked, /- \[ \] 2\.1 /);
  assert.match(sh(dir, "git", ["log", "-1", "--pretty=%B"]).stdout, /Tasks: 1\.1, 1\.2, 1\.3/);
  assert.equal(sh(dir, "git", ["status", "--porcelain"]).stdout.trim(), "");

  // The goal predicate counts open tasks; tasks of a skipped slice no longer block.
  let gc = runCli(dir, ["goal", "check"]).json;
  assert.ok(gc.reasons.some((x) => x === "OpenSpec tasks still open: 2.1 (S-2), 3.1 (S-3)"), JSON.stringify(gc.reasons));
  const tasks = runCli(dir, ["spec", "tasks"]).json;
  assert.equal(tasks.done, 3);
  assert.equal(tasks.total, 5);
  assert.equal(rec.stage, "building");
  assert.equal(state(dir).slice.id, "S-2");
  runCli(dir, ["slice", "skip", "--reason", "test"]);
  stop(dir);
  assert.equal(state(dir).slice.id, "S-3");
  gc = runCli(dir, ["goal", "check"]).json;
  assert.ok(gc.reasons.some((x) => x === "OpenSpec tasks still open: 3.1 (S-3)"), JSON.stringify(gc.reasons));

  const report = renderReport(dir, state(dir));
  assert.match(report, /## Spec/);
  assert.match(report, /OpenSpec change: `openspec\/changes\/lantern-v0-2`/);
  assert.match(report, /Spec review: block, pass over 2 attempt\(s\)/);
  assert.match(report, /Tasks ticked: 3 of 5\. Open: 2\.1, 3\.1\./);
  assert.match(report, /openspec archive lantern-v0-2 --yes/);
  const status = runCli(dir, ["goal", "status"]).json;
  assert.equal(status.spec.change, "lantern-v0-2");
  assert.equal(status.tasks.done, 3);
});

test("without --change the goal authors its own change, auto-approve commits it after the spec passes", () => {
  const dir = fixtureRepo();
  runCli(dir, ["init"]);
  const created = runCli(dir, ["goal", "new", "--sentence", "Implement the tag filter", "--mode", "feature", "--openspec", "--auto-approve"]);
  assert.equal(created.json.spec.change, "g-1-implement-the-tag-filter");
  let r = stop(dir);
  assert.match(r.json.reason, /openspec\/changes\/g-1-implement-the-tag-filter\/ does not exist/);

  const inventory = { goal: "G-1", sources: [], items: [{ id: "I-1", kind: "endpoint", title: "Filter by tag", criteria: [{ id: "C-1", text: "only notes with the tag" }], ui: false }] };
  writeFileSync(join(dir, ".harness/inventory.json"), JSON.stringify(inventory));
  const change = join(dir, "openspec/changes/g-1-implement-the-tag-filter");
  mkdirSync(join(change, "specs/notes"), { recursive: true });
  writeFileSync(join(change, "proposal.md"), "# Change: tag filter\n\n## Why\n\nThe goal asks for it.\n\n## What Changes\n\n- `listNotes` filters by tag (I-1).\n\n## Impact\n\n- Affected specs: `notes`\n");
  writeFileSync(join(change, "specs/notes/spec.md"), "## ADDED Requirements\n\n### Requirement: Filter by tag\n\nThe library SHALL return only notes carrying the given tag when `listNotes` is called with `{ tag }` (C-1).\n\n#### Scenario: Tag filter\n\n- **WHEN** `listNotes(store, { tag: \"work\" })` is called\n- **THEN** only notes tagged `work` are returned (C-1)\n");
  writeFileSync(join(change, "tasks.md"), "## 1. Filter\n\n- [ ] 1.1 Filter by tag in listNotes (I-1, C-1)\n");
  writeFileSync(join(dir, ".harness/plan.json"), JSON.stringify({ goal: "G-1", slices: [{ id: "S-1", title: "Tag filter", criteria: ["C-1"], paths: ["src/**", "tests/**"], ui: false, tasks: ["1.1"] }], questions: [] }));
  writeFileSync(join(dir, ".harness/goal-card.md"), "# Goal card G-1\n");
  const check = runCli(dir, ["spec", "check"]).json;
  assert.equal(check.ok, true, JSON.stringify(check));
  r = stop(dir);
  assert.match(r.json.reason, /Stage: spec review/);
  const path = r.json.reason.match(/to `([^`]+spec-a1-spec-reviewer\.json)`/)[1];
  specVerdict(dir, path, { attempt: 1, verdict: "pass" });
  r = stop(dir);
  // Auto-approve: straight into the first slice, with the change already committed.
  assert.match(r.json.reason, /Stage: build, slice S-1/);
  const s = state(dir);
  assert.equal(s.stage, "building");
  assert.ok(s.spec.committed);
  assert.equal(sh(dir, "git", ["log", "-1", "--pretty=%s"]).stdout.trim(), "spec: g-1-implement-the-tag-filter (G-1)");
  assert.ok(sh(dir, "git", ["show", "--stat", "--pretty=", "HEAD"]).stdout.includes("openspec/changes/g-1-implement-the-tag-filter/tasks.md"));
  assert.equal(sh(dir, "git", ["status", "--porcelain"]).stdout.trim(), "");
  const ev = runCli(dir, ["events", "--type", "spec", "--last", "10"]).json.events;
  assert.deepEqual(ev.map((e) => e.action), ["checked", "committed"]);
});
