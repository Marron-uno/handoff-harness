// Adversarial review: guard-bearing slices, tests that must fail without the change, probe
// evidence, and environment facts. Motivated by the review of the field-issues change, where an
// independent reviewer found three guard escapes the author's own review and tests had missed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runCli, sh, tmpDir, initRepo } from "./helpers.mjs";
import { fixtureRepo, writeIntake, state, stop } from "./fixture.mjs";
import { environmentFacts, caseInsensitiveFs } from "../scripts/lib/environment.mjs";
import { runMetrics } from "../scripts/lib/metrics.mjs";

function buildingRepo({ guardPaths } = {}) {
  const dir = fixtureRepo();
  runCli(dir, ["init"]);
  if (guardPaths) {
    const p = join(dir, ".harness/profile.json");
    const profile = JSON.parse(readFileSync(p, "utf8"));
    profile.review = { guardPaths };
    writeFileSync(p, JSON.stringify(profile, null, 2) + "\n");
    sh(dir, "git", ["add", ".harness/profile.json"]);
    sh(dir, "git", ["commit", "-q", "-m", "profile: guard paths"]);
  }
  runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff", "--source", "handoff/HANDOFF.md"]);
  writeIntake(dir);
  stop(dir);
  runCli(dir, ["goal", "approve"]);
  stop(dir);
  assert.equal(state(dir).stage, "building");
  return dir;
}
const sortNotes = (dir) => writeFileSync(join(dir, "src/notes.mjs"), readFileSync(join(dir, "src/notes.mjs"), "utf8").replace("return [...store];", "return [...store].sort((a, b) => b.createdAt.localeCompare(a.createdAt));"));
const SORT_TEST = `import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { createNote, listNotes } from "../src/notes.mjs";\ntest("newest first", () => { const s = []; createNote(s, { title: "a" }); s[0].createdAt = "2020-01-01"; createNote(s, { title: "b" }); assert.equal(listNotes(s)[0].title, "b"); });\n`;
const PLACEHOLDER_TEST = `import { test } from "node:test";\ntest("placeholder", () => {});\n`;
const check = (pf, id) => pf.checks.find((c) => c.id === id);
const passWith = (sk, criteria) => ({ ...sk, verdict: "pass", summary: "judged", findings: [], criteria });

test("a guard-bearing slice is marked by preflight, described in the packet, judged on probes, and reviewed adversarially by the strong model", () => {
  const dir = buildingRepo({ guardPaths: ["src/guard*.mjs"] });
  writeFileSync(join(dir, "src/guard.mjs"), 'export function allowed(path) { return !path.startsWith("/etc/"); }\n');
  writeFileSync(join(dir, "tests/guard.test.mjs"), `import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { allowed } from "../src/guard.mjs";\ntest("denies /etc", () => { assert.equal(allowed("/etc/passwd"), false); assert.equal(allowed("/home/x"), true); });\n`);
  runCli(dir, ["slice", "done"]);
  const pf = runCli(dir, ["preflight"]).json;
  assert.equal(pf.passed, true, JSON.stringify(pf.checks));
  assert.equal(pf.guardBearing, true);
  assert.deepEqual(pf.guardFiles, ["src/guard.mjs"]);
  assert.equal(check(pf, "tests_discriminate").status, "pass", JSON.stringify(check(pf, "tests_discriminate")));
  const packet = readFileSync(pf.packet, "utf8");
  assert.match(packet, /## Guard-bearing change\n\nThis slice changes what the harness allows or denies:\n\n- src\/guard\.mjs\n\nJudge it by what now passes/);
  assert.match(packet, /## Environment\n\n- OS: .+\n- Node: v\d+/);
  assert.match(packet, /- Filesystem: case-(in)?sensitive/);
  assert.match(pf.brief, /This slice is guard-bearing \(src\/guard\.mjs\)/, "the critic brief carries the guard note");
  assert.equal(state(dir).preflight.guardBearing, true);

  // Critic: a met criterion resting on a file quote is rejected; a test the judge ran is accepted.
  let t = runCli(dir, ["verdict", "template"]).json;
  assert.equal(t.guardBearing, true);
  assert.match(t.guardNote, /command or test/);
  writeFileSync(t.path, JSON.stringify(passWith(t.skeleton, t.skeleton.criteria.map((c) => ({ ...c, status: "met", evidence: [{ type: "file", path: "src/guard.mjs", quote: "startsWith" }] })))));
  let v = runCli(dir, ["verdict", "validate"]).json;
  assert.equal(v.ok, false);
  assert.match(v.errors.join("\n"), /C-3: on a guard-bearing slice a met criterion needs evidence of type command or test/);
  writeFileSync(t.path, JSON.stringify(passWith(t.skeleton, t.skeleton.criteria.map((c) => ({ ...c, status: "met", evidence: [{ type: "test", path: "tests/guard.test.mjs", quote: "denies /etc" }] })))));
  assert.equal(runCli(dir, ["verdict", "validate"]).json.ok, true);

  // Review: the adversarial brief, the strong reviewer from round one.
  const nx = runCli(dir, ["next"]).json;
  assert.equal(nx.stage, "review");
  assert.match(nx.brief, /\(round 1 of 3\), guard-bearing\n/);
  assert.match(nx.brief, /Your job is to get through/);
  assert.match(nx.brief, /handoff-harness:reviewer-strong/);
  assert.match(runCli(dir, ["resume"]).json.brief, /Adversarial review of slice S-1/);
  t = runCli(dir, ["verdict", "template"]).json;
  assert.equal(t.agent, "reviewer-strong");
  const finding = { id: "F-1", severity: "block", issue: "a path with parent segments gets through", authority: "criterion:C-3", evidence: [{ type: "file", path: "src/guard.mjs" }] };
  const blockWith = (f) => ({ ...t.skeleton, verdict: "block", summary: "escape", findings: [f], criteria: t.skeleton.criteria.map((c) => ({ ...c, status: "unmet" })) });
  writeFileSync(t.path, JSON.stringify(blockWith(finding)));
  v = runCli(dir, ["verdict", "validate"]).json;
  assert.equal(v.ok, false);
  assert.match(v.errors.join("\n"), /F-1: on a guard-bearing slice a block finding needs evidence of type command or test/);
  mkdirSync(join(dir, ".harness/evidence/S-1"), { recursive: true });
  writeFileSync(join(dir, ".harness/evidence/S-1/probe.mjs"), "// the reviewer's probe\n");
  writeFileSync(t.path, JSON.stringify(blockWith({ ...finding, evidence: [{ type: "command", path: ".harness/evidence/S-1/probe.mjs", quote: "allowed('/etc/../etc/passwd') => true" }] })));
  assert.equal(runCli(dir, ["verdict", "validate"]).json.ok, true, "a probe with its output stands");
  assert.equal(runMetrics(join(dir, ".harness")).guardBearingSlices, 1);

  // An ordinary slice is untouched by the rule, and still gets the environment facts.
  const plain = buildingRepo();
  sortNotes(plain);
  writeFileSync(join(plain, "tests/sort.test.mjs"), SORT_TEST);
  runCli(plain, ["slice", "done"]);
  const pf2 = runCli(plain, ["preflight"]).json;
  assert.equal(pf2.guardBearing, false);
  const packet2 = readFileSync(pf2.packet, "utf8");
  assert.doesNotMatch(packet2, /Guard-bearing/);
  assert.match(packet2, /## Environment/);
  assert.doesNotMatch(pf2.brief, /guard-bearing/);
  const t2 = runCli(plain, ["verdict", "template"]).json;
  assert.equal(t2.agent, "critic");
  assert.equal(t2.guardBearing, false);
  assert.equal(t2.guardNote, undefined);
});

test("the slice's changed tests must fail without the change: a tautological test fails preflight, a real one passes, and the rest skip", () => {
  const dir = buildingRepo();
  sortNotes(dir);
  writeFileSync(join(dir, "tests/sort.test.mjs"), PLACEHOLDER_TEST);
  runCli(dir, ["slice", "done"]);
  let pf = runCli(dir, ["preflight"]).json;
  let c = check(pf, "tests_discriminate");
  assert.equal(c.status, "fail", JSON.stringify(c));
  assert.match(c.details, /pass without the slice's source changes \(tests\/sort\.test\.mjs\)/);
  assert.equal(pf.passed, false);
  assert.equal(pf.stage, "building", "the slice goes back to build");
  assert.match(pf.brief, /tests_discriminate: the changed tests pass without/);
  assert.equal(state(dir).slice.attempt, 2);
  writeFileSync(join(dir, "tests/sort.test.mjs"), SORT_TEST);
  runCli(dir, ["slice", "done"]);
  pf = runCli(dir, ["preflight"]).json;
  c = check(pf, "tests_discriminate");
  assert.equal(c.status, "pass", JSON.stringify(c));
  assert.match(c.details, /1 changed test file\(s\) fail without the change/);
  assert.equal(pf.passed, true, JSON.stringify(pf.checks));
  assert.equal(sh(dir, "git", ["worktree", "list"]).stdout.trim().split("\n").length, 1, "the temporary worktree is removed");
  assert.equal(runMetrics(join(dir, ".harness")).discriminationFailures, 1);

  const onlySource = buildingRepo();
  sortNotes(onlySource);
  runCli(onlySource, ["slice", "done"]);
  assert.match(check(runCli(onlySource, ["preflight"]).json, "tests_discriminate").details, /no test files changed/);

  const onlyTests = buildingRepo();
  writeFileSync(join(onlyTests, "tests/extra.test.mjs"), PLACEHOLDER_TEST);
  runCli(onlyTests, ["slice", "done"]);
  assert.match(check(runCli(onlyTests, ["preflight"]).json, "tests_discriminate").details, /only tests changed/);

  const off = buildingRepo();
  const p = join(off, ".harness/profile.json");
  writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, "utf8")), review: { discriminatingTests: false } }));
  sortNotes(off);
  writeFileSync(join(off, "tests/sort.test.mjs"), PLACEHOLDER_TEST);
  runCli(off, ["slice", "done"]);
  assert.match(check(runCli(off, ["preflight"]).json, "tests_discriminate").details, /disabled in the profile/);
});

test("harness init seeds review.guardPaths for a checkout of the harness and nothing for other projects", () => {
  const dir = initRepo(tmpDir("hh-self-"));
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  writeFileSync(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "handoff-harness", version: "0.0.0" }));
  const r = runCli(dir, ["init"]);
  assert.equal(r.json.ok, true, r.stdout);
  const profile = JSON.parse(readFileSync(join(dir, ".harness/profile.json"), "utf8"));
  assert.deepEqual(profile.review.guardPaths, ["scripts/lib/guards/**", "scripts/hooks/**", "profiles/*.json", "schemas/*.json"]);
  assert.ok(r.json.committed, "the seeded profile is part of the init commit");
  assert.doesNotMatch(sh(dir, "git", ["status", "--porcelain"]).stdout, /profile\.json/, "the profile is committed, not left dirty");
  const other = initRepo(tmpDir());
  runCli(other, ["init"]);
  assert.equal(JSON.parse(readFileSync(join(other, ".harness/profile.json"), "utf8")).review, undefined);
});

test("environment facts are probed, not assumed, and leave nothing behind", () => {
  const dir = tmpDir("hh-env-");
  const facts = environmentFacts(dir);
  assert.equal(facts.node, process.version);
  assert.match(facts.git, /^\d+\.\d+/);
  assert.equal(typeof facts.caseInsensitiveFs, "boolean");
  assert.equal(caseInsensitiveFs(join(dir, ".harness")), facts.caseInsensitiveFs);
  assert.deepEqual(readdirSync(join(dir, ".harness")), [], "the probe file is removed");
});
