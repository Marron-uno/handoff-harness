// Regressions for docs/field-issues.md. Each test names the issue it keeps closed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { runCli, runHook, sh, tmpDir, initRepo, PLUGIN_ROOT } from "./helpers.mjs";
import { fixtureRepo, writeIntake, state, stop, writeVerdict, hash } from "./fixture.mjs";
import { loadState, saveState } from "../scripts/lib/state.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";
import { checkFileAccess } from "../scripts/lib/guards/path-guard.mjs";
import { checkBashCommand } from "../scripts/lib/guards/git-guard.mjs";
import { diffStat, workHash } from "../scripts/lib/git.mjs";
import { decide } from "../scripts/lib/machine.mjs";
import { prepareReconcile } from "../scripts/lib/reconcile.mjs";
import { renderReport } from "../scripts/lib/report.mjs";

// Commands and credential-like names under test are spelled in two parts, so a guard reading this
// file's text does not take them for commands to run or files to open.
const GIT = "git ";
const SECRET_TEST = "tests/browser-" + "secret.test.mjs";
const SECRETS_JSON = "config/sec" + "rets.json";
const DOTENV = ".e" + "nv";

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
const hook = (dir, extra) => runHook("pre-tool-use", { cwd: dir, session_id: "s1", transcript_path: join(dir, "transcript.jsonl"), hook_event_name: "PreToolUse", ...extra });
const denied = (r) => r.json?.hookSpecificOutput?.permissionDecision === "deny";
const reason = (r) => r.json?.hookSpecificOutput?.permissionDecisionReason ?? "";
const setStage = (dir, fn) => { const s = loadState(dir); fn(s); saveState(dir, s); return s; };
const met = [{ id: "C-3", status: "met" }, { id: "C-4", status: "met" }];

test("issue 2: lanes apply inside the project only; the scratchpad and other repositories stay writable in judge stages", () => {
  const dir = buildingRepo();
  setStage(dir, (s) => { s.stage = "review"; s.slice.buildDone = true; });
  const outside = join(tmpDir("hh-scratch-"), "notes.md");
  assert.equal(denied(hook(dir, { tool_name: "Write", tool_input: { file_path: outside, content: "" } })), false, "the main session writes outside the project");
  assert.equal(denied(hook(dir, { tool_name: "Write", tool_input: { file_path: outside, content: "" }, agent_type: "handoff-harness:reviewer", agent_id: "a1" })), false, "so does a judge");
  assert.match(reason(hook(dir, { tool_name: "Write", tool_input: { file_path: join(dir, "src/x.mjs"), content: "" } })), /stage review does not edit source/, "the project itself stays in its lane");
  assert.match(reason(hook(dir, { tool_name: "Read", tool_input: { file_path: join(tmpDir("hh-home-"), ".ssh", "id_rsa") } })), /sensitive path/, "secrets are unreadable wherever they are");
  assert.equal(runCli(dir, ["events", "--type", "guard"]).json.events.filter((e) => e.guard === "lane").length, 1);
});

test("issue 14: a done goal is dormant; follow-up work proceeds on a new branch, never on the default or the goal branch", () => {
  const dir = buildingRepo();
  const profile = loadProfile(dir);
  setStage(dir, (s) => { s.stage = "done"; s.slice = null; });
  assert.match(reason(hook(dir, { tool_name: "Edit", tool_input: { file_path: join(dir, "src/x.mjs") } })), /done and goal\/G-1 is its reviewed goal branch/);
  assert.equal(denied(hook(dir, { tool_name: "Bash", tool_input: { command: GIT + "checkout main" } })), false, "switching to the default branch is allowed once the goal is done");
  sh(dir, "git", ["checkout", "-q", "main"]);
  assert.match(reason(hook(dir, { tool_name: "Edit", tool_input: { file_path: join(dir, "src/x.mjs") } })), /done and main is the default branch/);
  assert.match(reason(hook(dir, { tool_name: "Bash", tool_input: { command: GIT + "push origin HEAD" } })), /default branch main/, "HEAD on main is main");
  sh(dir, "git", ["checkout", "-q", "-b", "fix/follow-up"]);
  assert.equal(denied(hook(dir, { tool_name: "Edit", tool_input: { file_path: join(dir, "src/x.mjs") } })), false, "a new branch may be edited");
  assert.equal(denied(hook(dir, { tool_name: "Bash", tool_input: { command: GIT + "push -u origin fix/follow-up" } })), false, "and pushed");
  assert.match(reason(hook(dir, { tool_name: "Bash", tool_input: { command: GIT + "push origin main" } })), /default branch main is not allowed/);
  // The same guards still hold while the goal runs.
  const s = loadState(dir); s.stage = "review";
  assert.match(checkFileAccess({ tool: "Edit", filePath: join(dir, "src/x.mjs"), cwd: dir, profile, state: s, agentType: null, pluginRoot: PLUGIN_ROOT }).reason, /does not edit source/);
  assert.equal(checkBashCommand(GIT + "checkout main", { profile, state: s, cwd: dir }).guard, "git");
  assert.equal(checkBashCommand(GIT + "push origin fix/follow-up", { profile, state: s, cwd: dir }).guard, "git");
});

test("issue 15: a test file named *secret* is source, not a credential", () => {
  const dir = buildingRepo();
  writeFileSync(join(dir, SECRET_TEST), "// the guard's own test\n");
  assert.equal(denied(hook(dir, { tool_name: "Read", tool_input: { file_path: join(dir, SECRET_TEST) } })), false);
  assert.equal(denied(hook(dir, { tool_name: "Bash", tool_input: { command: `cat ${SECRET_TEST}` } })), false);
  assert.match(reason(hook(dir, { tool_name: "Read", tool_input: { file_path: join(dir, SECRETS_JSON) } })), /sensitive path/);
  assert.match(reason(hook(dir, { tool_name: "Bash", tool_input: { command: `cat ${DOTENV}` } })), /sensitive path/);
});

test("issue 5: the browser action budget is per review; a second review starts from zero", () => {
  const dir = buildingRepo();
  const profile = loadProfile(dir);
  const cap = profile.budgets.browserActionsPerReview;
  setStage(dir, (s) => { s.stage = "critic"; s.slice.buildDone = true; s.counters.browserActions = cap; });
  writeVerdict(dir, join(dir, ".harness/verdicts/S-1-a1-r1-critic.json"), { agent: "critic", slice: "S-1", attempt: 1, round: 1, verdict: "pass", criteria: met });
  stop(dir);
  assert.equal(state(dir).stage, "review");
  assert.equal(state(dir).counters.browserActions, 0, "entering review resets the counter");
  const browse = (tool, input = {}) => hook(dir, { tool_name: `mcp__claude-in-chrome__${tool}`, tool_input: input, agent_type: "handoff-harness:reviewer", agent_id: "r1" });
  assert.equal(denied(browse("navigate", { url: "http://localhost:4173/" })), false);
  assert.equal(denied(browse("read_page")), false);
  assert.equal(state(dir).counters.browserActions, 2);
  setStage(dir, (s) => { s.counters.browserActions = cap; });
  assert.match(reason(browse("read_page")), /browser action budget/);
  // The reviewer blocks; the second round's review gets a fresh budget.
  writeVerdict(dir, join(dir, ".harness/verdicts/S-1-a1-r1-reviewer.json"), { agent: "reviewer", slice: "S-1", attempt: 1, round: 1, verdict: "block", findings: [{ id: "F-1", severity: "block", issue: "x", authority: "criterion:C-3", evidence: [] }], criteria: [{ id: "C-3", status: "unmet" }] });
  stop(dir);
  assert.equal(state(dir).stage, "building");
  setStage(dir, (s) => { s.stage = "critic"; s.slice.buildDone = true; });
  writeVerdict(dir, join(dir, ".harness/verdicts/S-1-a1-r2-critic.json"), { agent: "critic", slice: "S-1", attempt: 1, round: 2, verdict: "pass", criteria: met });
  stop(dir);
  assert.equal(state(dir).stage, "review");
  assert.equal(state(dir).review.rounds, 1);
  assert.equal(state(dir).counters.browserActions, 0);
  assert.equal(denied(browse("read_page")), false);
});

test("issues 1 and 9: an untracked binary counts as 0 lines, and new files appear in the packet's diff", () => {
  const dir = buildingRepo();
  // A "PNG" with a NUL byte early and thousands of newlines after it: counted as text it would blow the diff cap.
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]), Buffer.alloc(40000, 0x0a)]);
  writeFileSync(join(dir, "src/logo.png"), png);
  writeFileSync(join(dir, "tests/sort.test.mjs"), `import { test } from "node:test";\ntest("placeholder", () => {});\n`);
  const stat = diffStat(dir);
  const logo = stat.files.find((f) => f.file === "src/logo.png");
  assert.deepEqual({ added: logo.added, untracked: logo.untracked, binary: logo.binary }, { added: 0, untracked: true, binary: true });
  assert.equal(stat.files.find((f) => f.file === "tests/sort.test.mjs").binary, false);
  assert.ok(stat.added < 10, `the binary is not counted: ${stat.added} lines`);
  runCli(dir, ["slice", "done"]);
  const pf = runCli(dir, ["preflight"]);
  assert.equal(pf.json.checks.find((c) => c.id === "diff_budget").status, "pass", pf.stdout);
  const packet = readFileSync(pf.json.packet, "utf8");
  assert.match(packet, /\| src\/logo\.png \(new\) \(binary\) \| 0 \| 0 \|/);
  // The slice only adds files, so `git diff HEAD` alone is empty; the packet still shows the change.
  assert.match(packet, /## Diff against HEAD[\s\S]*\+\+\+ b\/tests\/sort\.test\.mjs\n@@[^\n]*\n\+import \{ test \}/);
  assert.match(packet, /Binary files \/dev\/null and b\/src\/logo\.png differ/);
  assert.doesNotMatch(packet, /## New files/);
});

// A slice built and in the critic stage, with the packet written.
function judgingRepo() {
  const dir = buildingRepo();
  writeFileSync(join(dir, "src/notes.mjs"), readFileSync(join(dir, "src/notes.mjs"), "utf8").replace("return [...store];", "return [...store].sort((a, b) => b.createdAt.localeCompare(a.createdAt));"));
  runCli(dir, ["slice", "done"]);
  const pf = runCli(dir, ["preflight"]);
  assert.equal(pf.json.stage, "critic", pf.stdout);
  return dir;
}
const passVerdict = (skeleton, findings = []) => ({ ...skeleton, verdict: "pass", summary: "looked at it", findings, criteria: skeleton.criteria.map((c) => ({ ...c, status: "met", evidence: [{ type: "file", path: "README.md" }] })) });

test("issue 4: the template prints a finding example that validates, and the fumbled shapes are rejected by name", () => {
  const dir = judgingRepo();
  const t = runCli(dir, ["verdict", "template"]).json;
  assert.match(t.note, /findingExample/);
  assert.deepEqual(Object.keys(t.findingExample).sort(), ["authority", "evidence", "file", "id", "issue", "line", "severity", "suggestion"]);
  const example = { ...t.findingExample, file: "src/notes.mjs", evidence: t.findingExample.evidence.map((e) => ({ ...e, path: "src/notes.mjs" })) };
  writeFileSync(t.path, JSON.stringify(passVerdict(t.skeleton, [example])));
  let v = runCli(dir, ["verdict", "validate", t.path]).json;
  assert.equal(v.ok, true, JSON.stringify(v));
  writeFileSync(t.path, JSON.stringify(passVerdict(t.skeleton, [{ severity: "nit", authority: "criterion: C-3", summary: "written as a summary", evidence: [] }])));
  v = runCli(dir, ["verdict", "validate", t.path]).json;
  assert.equal(v.ok, false);
  assert.ok(v.errors.length >= 3, JSON.stringify(v.errors));
  assert.ok(v.errors.some((e) => /severity/.test(e)) && v.errors.some((e) => /authority/.test(e)), JSON.stringify(v.errors));
});

test("issue 7: verdict validate without a path checks the verdict of the current judging stage", () => {
  const dir = judgingRepo();
  let v = runCli(dir, ["verdict", "validate"]).json;
  assert.equal(v.ok, false);
  assert.match(v.error, /missing verdict file .*S-1-a1-r1-critic\.json/);
  runCli(dir, ["verdict", "template", "--write"]);
  v = runCli(dir, ["verdict", "validate"]).json;
  assert.ok(v.path.endsWith("/.harness/verdicts/S-1-a1-r1-critic.json"), v.path);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /summary/.test(e)));
  const resting = fixtureRepo();
  runCli(resting, ["init"]);
  assert.match(runCli(resting, ["verdict", "validate"]).json.error, /must be in the critic, review or spec_review stage/);
});

test("issue 8: the work hash is the same from any directory of the project, and a stale verdict names what moved", () => {
  const dir = judgingRepo();
  const root = runCli(dir, ["hash"]).json.diffHash;
  assert.equal(runCli(join(dir, "src"), ["hash"]).json.diffHash, root, "the cli resolves to the project root");
  const before = state(dir).counters.toolCalls.critic ?? 0;
  const r = runHook("pre-tool-use", { cwd: join(dir, "src"), hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" } });
  assert.equal(r.json, null, r.stdout);
  assert.equal(state(dir).counters.toolCalls.critic, before + 1, "hooks find the project from a subdirectory");
  const t = runCli(dir, ["verdict", "template"]).json;
  writeFileSync(t.path, JSON.stringify(passVerdict(t.skeleton)));
  mkdirSync(join(dir, ".harness/evidence/S-1"), { recursive: true });
  writeFileSync(join(dir, ".harness/evidence/S-1/page.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]));
  let v = runCli(join(dir, "src"), ["verdict", "validate"]).json;
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.stale, false, "evidence under .harness/ never makes a verdict stale");
  assert.equal(v.workHash, t.skeleton.diffHash);
  writeFileSync(join(dir, "scratch-notes.txt"), "left behind by a dev server\n");
  v = runCli(dir, ["verdict", "validate"]).json;
  assert.equal(v.stale, true);
  assert.notEqual(v.workHash, v.verdictHash);
  assert.deepEqual(v.changedFiles.filter((f) => f === "scratch-notes.txt"), ["scratch-notes.txt"], "the stray file is named");
  assert.equal(realpathSync(v.projectRoot), realpathSync(dir));
});

test("issue 8, boundary: the project root never crosses into a parent repository", () => {
  const dir = buildingRepo();
  mkdirSync(join(dir, "nested"));
  const nested = initRepo(join(dir, "nested"));
  const before = state(dir).counters.toolCalls.building;
  const r = runHook("pre-tool-use", { cwd: nested, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" } });
  assert.equal(r.stdout, "", "a repository without a harness keeps the hooks inactive, whatever lies above it");
  assert.equal(state(dir).counters.toolCalls.building, before, "the parent's counters are untouched");
  assert.ok(runCli(nested, ["init"]).json.harnessDir.endsWith("/nested/.harness"), "init lands in the nested repository");
  assert.equal(runCli(nested, ["hash"]).json.ok, true, "the nested repository is a project of its own");
  assert.equal(runCli(join(dir, "src"), ["hash"]).json.diffHash, runCli(dir, ["hash"]).json.diffHash, "and the parent still resolves from its own subfolders");
});

test("issue 10: retry keeps the attempt count; the cap counts from the retry and its message names retry", () => {
  const dir = buildingRepo();
  const profile = loadProfile(dir);
  const failedPreflight = (s) => { s.slice.buildDone = true; s.stage = "preflight"; s.preflight = { diffHash: workHash(dir), passed: false, at: new Date().toISOString(), checks: [{ id: "project:test", status: "fail", details: "1 failing" }] }; };
  let s = loadState(dir);
  for (let attempt = 1; attempt <= profile.caps.maxAttempts; attempt++) { failedPreflight(s); decide({ cwd: dir, state: s, profile }); }
  assert.equal(s.stage, "awaiting_human");
  assert.equal(s.halt.code, "attempt_cap");
  assert.match(s.halt.reason, /failed 3 attempt\(s\)/);
  assert.match(s.halt.reason, /`harness retry` continues the slice/);
  assert.doesNotMatch(s.halt.reason, /raise caps/);
  saveState(dir, s);
  const r = runCli(dir, ["retry"]).json;
  assert.equal(r.stage, "building");
  assert.equal(r.attempt, 4);
  s = loadState(dir);
  assert.equal(s.slice.attempt, 4);
  assert.equal(s.slice.attemptBase, 3);
  assert.equal(s.slices[0].attempts, 4, "the report sees every build");
  assert.match(runCli(dir, ["resume"]).json.brief, /attempt 4 of 6/, "the cap window moved with the retry");
  failedPreflight(s);
  const d = decide({ cwd: dir, state: s, profile });
  assert.equal(d.action, "block");
  assert.equal(s.stage, "building");
  assert.equal(s.slice.attempt, 5, "one failure after a retry is not a cap");
  s.stage = "critic"; s.slice.buildDone = true;
  saveState(dir, s);
  assert.ok(runCli(dir, ["verdict", "template"]).json.path.endsWith("/S-1-a5-r1-critic.json"), "the retried attempt has its own verdict paths");
  failedPreflight(s); decide({ cwd: dir, state: s, profile });
  failedPreflight(s); decide({ cwd: dir, state: s, profile });
  assert.equal(s.stage, "awaiting_human");
  assert.match(s.halt.reason, /failed 6 attempt\(s\) \(preflight_failed\), 3 since the last retry/);
});

test("issue 12: the report takes each criterion from the recorded attempt of the active goal; reconcile ignores other goals' verdicts", () => {
  const dir = judgingRepo();
  const vdir = join(dir, ".harness/verdicts");
  const t = runCli(dir, ["verdict", "template"]).json.skeleton;
  const met = (id) => ({ id, status: "met", evidence: [{ type: "file", path: "README.md" }] });
  // Left over from an earlier goal: a pass that marks C-6, a criterion this goal also has.
  writeFileSync(join(vdir, "S-7-a1-r1-reviewer.json"), JSON.stringify({ ...t, agent: "reviewer", goal: "G-9", slice: "S-7", verdict: "pass", summary: "old goal", criteria: [met("C-6"), met("C-99")] }));
  // The first attempt found C-3 unmet; after a retry, attempt 4 passed, with the reviewer unable to verify C-4.
  writeFileSync(join(vdir, "S-1-a1-r1-critic.json"), JSON.stringify({ ...t, verdict: "block", summary: "first try", findings: [{ id: "F-1", severity: "block", issue: "x", authority: "criterion:C-3", evidence: [] }], criteria: [{ id: "C-3", status: "unmet" }, { id: "C-4", status: "unverified" }] }));
  writeFileSync(join(vdir, "S-1-a4-r1-critic.json"), JSON.stringify({ ...t, attempt: 4, verdict: "pass", summary: "fixed", criteria: [met("C-3"), met("C-4")] }));
  writeFileSync(join(vdir, "S-1-a4-r1-reviewer.json"), JSON.stringify({ ...t, attempt: 4, agent: "reviewer", verdict: "pass", summary: "fixed", criteria: [met("C-3"), { id: "C-4", status: "unverified", note: "no browser" }] }));
  const text = renderReport(dir, state(dir));
  assert.match(text, /\| C-3 \| met \|/, "the recorded attempt wins over the pre-retry one");
  assert.match(text, /\| C-4 \| unverified \|/, "the reviewer's status wins over the critic's in the same attempt");
  assert.doesNotMatch(text, /C-6|C-99/, "another goal's verdicts stay out");
  const items = prepareReconcile(dir, state(dir)).items;
  assert.equal(items.find((i) => i.id === "I-2").decided, "done", "this goal's pass marks C-3 and C-4");
  assert.equal(items.find((i) => i.id === "I-4").decided, null, "the old goal's pass on C-6 does not count");
});

test("issue 6: record commits harness configuration apart from the slice", () => {
  const dir = judgingRepo();
  let t = runCli(dir, ["verdict", "template"]).json;
  writeFileSync(t.path, JSON.stringify(passVerdict(t.skeleton)));
  assert.equal(runCli(dir, ["next"]).json.stage, "review");
  t = runCli(dir, ["verdict", "template"]).json;
  writeFileSync(t.path, JSON.stringify(passVerdict(t.skeleton)));
  assert.equal(runCli(dir, ["next"]).json.stage, "record");
  // The orchestrator raised a budget in the profile while the slice ran.
  const profilePath = join(dir, ".harness/profile.json");
  const profile = JSON.parse(readFileSync(profilePath, "utf8"));
  profile.budgets = { ...(profile.budgets ?? {}), browserActionsPerReview: 500 };
  writeFileSync(profilePath, JSON.stringify(profile, null, 2) + "\n");
  const rec = runCli(dir, ["record"]).json;
  assert.equal(rec.ok, true, JSON.stringify(rec));
  assert.deepEqual(rec.files, ["src/notes.mjs"]);
  assert.deepEqual(rec.harnessConfig.files, [".harness/profile.json"]);
  const subjects = sh(dir, "git", ["log", "-2", "--pretty=%s"]).stdout.trim().split("\n");
  assert.match(subjects[0], /\[S-1\] \(G-1\)$/);
  assert.match(subjects[1], /^chore: harness config changed during S-1 \(G-1\)$/);
  assert.equal(sh(dir, "git", ["show", "--pretty=", "--name-only", "HEAD"]).stdout.trim(), "src/notes.mjs", "the slice commit holds the reviewed diff only");
  assert.equal(sh(dir, "git", ["show", "--pretty=", "--name-only", "HEAD~1"]).stdout.trim(), ".harness/profile.json");
  assert.equal(rec.stage, "building", "the machine moves on to the next slice");
  assert.deepEqual(runCli(dir, ["events", "--type", "record"]).json.events.find((e) => e.harnessConfig).harnessConfig.files, [".harness/profile.json"], "the record event names the config commit");
});

test("issue 3: a human widens a slice's paths after approval; preflight and the plan follow", () => {
  const dir = buildingRepo();
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs/setup.md"), "# Setup\n\nStore setup notes.\n");
  runCli(dir, ["slice", "done"]);
  let pf = runCli(dir, ["preflight"]).json;
  const paths = pf.checks.find((c) => c.id === "slice_paths");
  assert.equal(paths.status, "fail");
  assert.match(paths.details, /harness slice amend --id S-1 --paths/);
  assert.equal(pf.stage, "building", "the failed preflight sends the slice back to build");
  assert.match(runCli(dir, ["slice", "amend", "--id", "S-9", "--paths", "docs/**"]).json.error, /no slice S-9/);
  const am = runCli(dir, ["slice", "amend", "--id", "S-1", "--paths", "docs/**", "--add"]).json;
  assert.deepEqual(am.paths, ["src/**", "tests/**", "docs/**"]);
  assert.deepEqual(am.pathsBefore, ["src/**", "tests/**"]);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, ".harness/plan.json"), "utf8")).slices[0].paths, ["src/**", "tests/**", "docs/**"], "the plan the judges read follows");
  assert.ok(runCli(dir, ["events", "--type", "slice"]).json.events.some((e) => e.action === "amend" && e.id === "S-1" && e.by === "human"));
  runCli(dir, ["slice", "done"]);
  pf = runCli(dir, ["preflight"]).json;
  assert.equal(pf.checks.find((c) => c.id === "slice_paths").status, "pass", JSON.stringify(pf.checks));
  assert.deepEqual(runCli(dir, ["slice", "amend", "--id", "S-2", "--paths", "src/**", "docs/**"]).json.paths, ["src/**", "docs/**"], "globs may follow as positionals and replace the list without --add");
  setStage(dir, (s) => { s.slices[1].status = "done"; });
  assert.match(runCli(dir, ["slice", "amend", "--id", "S-2", "--paths", "x/**"]).json.error, /is done/);
});

test("issue 11: a human decision is recorded, listed in the slice's packet, and citable as an authority", () => {
  const dir = buildingRepo();
  assert.match(runCli(dir, ["decide", "--slice", "S-9", "--text", "x"]).json.error, /no slice S-9/);
  assert.match(runCli(dir, ["decide"]).json.error, /usage: decide --text/);
  const d = runCli(dir, ["decide", "--slice", "S-1", "--question", "C-3 and C-4 contradict on empty lists", "--text", "An empty list shows the C-4 copy; the C-3 order applies to non-empty lists."]).json;
  assert.equal(d.decision.id, "D-2", "D-1 came from the plan");
  assert.equal(d.cite, "decision:D-2");
  assert.equal(state(dir).defaults.at(-1).slice, "S-1");
  assert.deepEqual(JSON.parse(readFileSync(join(dir, ".harness/plan.json"), "utf8")).questions.at(-1), { id: "D-2", question: "C-3 and C-4 contradict on empty lists", kind: "default", chosen: "An empty list shows the C-4 copy; the C-3 order applies to non-empty lists.", slice: "S-1" });
  assert.ok(runCli(dir, ["events", "--type", "default"]).json.events.some((e) => e.id === "D-2" && e.by === "human" && e.slice === "S-1"));
  writeFileSync(join(dir, "src/notes.mjs"), readFileSync(join(dir, "src/notes.mjs"), "utf8").replace("return [...store];", "return [...store].sort((a, b) => b.createdAt.localeCompare(a.createdAt));"));
  runCli(dir, ["slice", "done"]);
  const pf = runCli(dir, ["preflight"]).json;
  const packet = readFileSync(pf.packet, "utf8");
  assert.match(packet, /## Defaults and decisions\n\n[^\n]*decision:D-n[^\n]*\n\n- D-1: Tags case-insensitive\? → yes, lowercase compare\n- D-2 \(S-1\): C-3 and C-4 contradict on empty lists → An empty list/);
  const t = runCli(dir, ["verdict", "template"]).json;
  const finding = { id: "F-1", severity: "note", issue: "C-3 is read as D-2 says", authority: "decision:D-2", evidence: [{ type: "file", path: "README.md" }] };
  writeFileSync(t.path, JSON.stringify(passVerdict(t.skeleton, [finding])));
  assert.equal(runCli(dir, ["verdict", "validate"]).json.ok, true);
  writeFileSync(t.path, JSON.stringify(passVerdict(t.skeleton, [{ ...finding, authority: "decision:D-7" }])));
  const bad = runCli(dir, ["verdict", "validate"]).json;
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join("\n"), /F-1: authority decision:D-7 names no recorded decision/);
  assert.match(renderReport(dir, state(dir)), /- D-2 \(S-1, human decision\): C-3 and C-4 contradict on empty lists → An empty list/);
});
