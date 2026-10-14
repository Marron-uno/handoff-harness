import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runCli } from "./helpers.mjs";
import { fixtureRepo, writeIntake, state, stop } from "./fixture.mjs";
import { appendEvent } from "../scripts/lib/events.mjs";

function criticRepo() {
  const dir = fixtureRepo();
  runCli(dir, ["init"]);
  runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff", "--source", "handoff/HANDOFF.md"]);
  writeIntake(dir);
  stop(dir);
  runCli(dir, ["goal", "approve"]);
  stop(dir);
  writeFileSync(join(dir, "src/notes.mjs"), readFileSync(join(dir, "src/notes.mjs"), "utf8").replace("return [...store];", "return [...store].sort((a, b) => b.createdAt.localeCompare(a.createdAt));"));
  writeFileSync(join(dir, "tests/sort.test.mjs"), `import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { createNote, listNotes } from "../src/notes.mjs";\ntest("newest first", () => { const s = []; createNote(s, { title: "a" }); s[0].createdAt = "2020-01-01"; createNote(s, { title: "b" }); assert.equal(listNotes(s)[0].title, "b"); });\n`);
  runCli(dir, ["slice", "done"]);
  return dir;
}

test("preflight writes the judge's packet: criteria text, paths, changed files, diff and new files", () => {
  const dir = criticRepo();
  assert.equal(runCli(dir, ["verdict", "template"]).json.ok, false, "no template outside a judging stage");
  const pf = runCli(dir, ["preflight"]);
  assert.equal(pf.json.passed, true, pf.stdout);
  assert.ok(pf.json.packet.endsWith("/.harness/packets/S-1-a1.md"), pf.json.packet);
  assert.equal(pf.json.stage, "critic", "the cli advanced to the critic");
  const packet = readFileSync(pf.json.packet, "utf8");
  assert.match(packet, /# Packet: S-1 "List notes newest first", attempt 1/);
  assert.match(packet, /- C-3 \(I-2 "List newest first", source handoff\/HANDOFF\.md\): sorted desc/);
  assert.match(packet, /- C-4 \(I-2 .*\): copy/);
  assert.doesNotMatch(packet, /C-6/, "criteria of other slices stay out");
  assert.match(packet, /## Declared paths\n\n- src\/\*\*\n- tests\/\*\*/);
  assert.match(packet, /\| src\/notes\.mjs \| 1 \| 1 \|/);
  assert.match(packet, /\| tests\/sort\.test\.mjs \(new\) \| \d+ \| 0 \|/);
  assert.match(packet, /```diff\ndiff --git a\/src\/notes\.mjs/);
  assert.match(packet, /### tests\/sort\.test\.mjs\n\n```\nimport \{ test \}/, "a new file is shown in full since the diff omits it");
  assert.match(pf.json.brief, /Start with `\.harness\/packets\/S-1-a1\.md`/, "the critic brief names the packet");
  assert.match(pf.json.brief, /verdict template/);
});

test("verdict template prints a skeleton that cannot pass as written and validates once filled", () => {
  const dir = criticRepo();
  runCli(dir, ["preflight"]);
  let t = runCli(dir, ["verdict", "template"]);
  assert.equal(t.json.ok, true, t.stdout);
  assert.equal(t.json.role, "critic");
  assert.equal(t.json.agent, "critic");
  assert.ok(t.json.path.endsWith("/.harness/verdicts/S-1-a1-r1-critic.json"), t.json.path);
  assert.equal(t.json.written, false);
  const sk = t.json.skeleton;
  assert.equal(sk.goal, "G-1"); assert.equal(sk.slice, "S-1"); assert.equal(sk.attempt, 1); assert.equal(sk.round, 1);
  assert.equal(sk.diffHash, runCli(dir, ["hash"]).json.diffHash);
  assert.deepEqual(sk.criteria.map((c) => `${c.id}:${c.status}`), ["C-3:unverified", "C-4:unverified"]);
  assert.deepEqual(sk.findings, []);

  // Written as is, the skeleton is rejected: empty summary, block verdict with no block finding.
  t = runCli(dir, ["verdict", "template", "--write"]);
  assert.equal(t.json.written, true);
  assert.ok(existsSync(t.json.path));
  let v = runCli(dir, ["verdict", "validate", t.json.path]);
  assert.equal(v.json.ok, false);
  assert.ok(v.json.errors.some((e) => /summary/.test(e)), v.stdout);
  // With a summary but nothing else decided, the block verdict without a block finding still fails.
  writeFileSync(t.json.path, JSON.stringify({ ...sk, summary: "looked" }));
  v = runCli(dir, ["verdict", "validate", t.json.path]);
  assert.equal(v.json.ok, false);
  assert.ok(v.json.errors.some((e) => /verdict is block but no finding/.test(e)), v.stdout);
  let r = stop(dir);
  assert.match(r.json.reason, /verdict is block but no finding has severity block/, "the Stop hook rejects the unedited skeleton too");
  assert.equal(state(dir).stage, "critic");

  // Filled in: pass with met criteria and evidence on disk.
  const filled = { ...sk, verdict: "pass", summary: "sorted and copied", criteria: sk.criteria.map((c) => ({ ...c, status: "met", evidence: [{ type: "test", path: "tests/sort.test.mjs" }] })) };
  writeFileSync(t.json.path, JSON.stringify(filled, null, 2));
  v = runCli(dir, ["verdict", "validate", t.json.path]);
  assert.equal(v.json.ok, true, v.stdout);
  r = stop(dir);
  assert.match(r.json.reason, /Stage: review, slice S-1/);
  assert.equal(state(dir).stage, "review");

  // In review the template names the reviewer and the review round; an explicit agent wins.
  t = runCli(dir, ["verdict", "template"]);
  assert.equal(t.json.role, "review");
  assert.equal(t.json.agent, "reviewer");
  assert.ok(t.json.path.endsWith("/.harness/verdicts/S-1-a1-r1-reviewer.json"), t.json.path);
  assert.equal(runCli(dir, ["verdict", "template", "--agent", "reviewer-strong"]).json.skeleton.agent, "reviewer-strong");
});

test("the report prints Claude Code's own figure next to the price table when the driver recorded sessions", async () => {
  const dir = criticRepo();
  runCli(dir, ["preflight"]);
  const t = runCli(dir, ["verdict", "template"]).json.skeleton;
  writeFileSync(join(dir, ".harness/verdicts/S-1-a1-r1-critic.json"), JSON.stringify({ ...t, verdict: "pass", summary: "ok", criteria: t.criteria.map((c) => ({ ...c, status: "met", evidence: [{ type: "file", path: "README.md" }] })) }));
  // A transcript for the main session so usage.json exists.
  const transcript = join(dir, "transcript.jsonl");
  writeFileSync(transcript, JSON.stringify({ type: "assistant", timestamp: new Date().toISOString(), message: { id: "m1", model: "claude-sonnet-5-5", usage: { input_tokens: 1000, output_tokens: 100 } } }));
  stop(dir, { transcript_path: transcript });
  appendEvent(dir, { type: "session", scope: "driver", iteration: 1, stage: "intake", seconds: 30, turns: 12, usd: 0.4321, isError: false });
  appendEvent(dir, { type: "session", scope: "driver", iteration: 2, stage: "critic", seconds: 30, turns: 3, usd: 0.1, isError: false });
  const { renderReport } = await import("../scripts/lib/report.mjs");
  const text = renderReport(dir, state(dir));
  assert.match(text, /Total from the price table: \$\d+\.\d{3} \(main session \$\d+\.\d{3}, subagents \$0\.000\)/);
  assert.match(text, /Reported by Claude Code: \$0\.532 over 2 headless session\(s\)\. This is the number of record/);
  const analysis = runCli(dir, ["analyze"]).stdout;
  assert.match(analysis, /Reported by Claude Code: \$0\.532 over 2 sessions/);
  assert.match(analysis, /\| 2 \| critic \| 3 \| 0\.100 \| false \|/, "session events feed the headless table when there is no drive log");
});
