import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, runHook, sh } from "./helpers.mjs";
import { fixtureRepo, writeIntake, state, stop, writeVerdict, hash } from "./fixture.mjs";

function buildingRepo() {
  const dir = fixtureRepo();
  runCli(dir, ["init"]);
  runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff"]);
  writeIntake(dir);
  stop(dir);
  runCli(dir, ["goal", "approve"]);
  stop(dir);
  return dir;
}
const base = (dir, extra) => ({ cwd: dir, session_id: "s1", transcript_path: join(dir, "transcript.jsonl"), ...extra });

test("PreToolUse denies history rewrites, counts tool calls, and records browser hosts", () => {
  const dir = buildingRepo();
  let r = runHook("pre-tool-use", base(dir, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git push --force origin goal/G-1" } }));
  assert.equal(r.json.hookSpecificOutput.permissionDecision, "deny");
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /git guard/);
  r = runHook("pre-tool-use", base(dir, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git status" } }));
  assert.equal(r.json, null);
  assert.equal(state(dir).counters.toolCalls.building, 2);
  r = runHook("pre-tool-use", base(dir, { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: join(dir, ".env") } }));
  assert.equal(r.json.hookSpecificOutput.permissionDecision, "deny");
  r = runHook("pre-tool-use", base(dir, { hook_event_name: "PreToolUse", tool_name: "mcp__claude-in-chrome__navigate", tool_input: { url: "http://localhost:4173/" } }));
  assert.equal(r.json, null);
  assert.equal(state(dir).browser.lastHost, "localhost");
  assert.equal(state(dir).counters.browserActions, 1);
  const guards = runCli(dir, ["events", "--type", "guard"]).json.events;
  assert.deepEqual(guards.map((g) => g.guard), ["git", "sensitive"]);
});

test("PreToolUse enforces the stage lane for the main session and the judge lane for subagents", () => {
  const dir = buildingRepo();
  let r = runHook("pre-tool-use", base(dir, { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: join(dir, "src/x.mjs"), content: "" } }));
  assert.equal(r.json, null, "building stage may edit source");
  r = runHook("pre-tool-use", base(dir, { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: join(dir, "src/x.mjs"), content: "" }, agent_type: "handoff-harness:critic", agent_id: "a1" }));
  assert.equal(r.json.hookSpecificOutput.permissionDecision, "deny");
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /read-only/);
  r = runHook("pre-tool-use", base(dir, { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: join(dir, ".harness/verdicts/x.json"), content: "" }, agent_type: "critic", agent_id: "a1" }));
  assert.equal(r.json, null);
  const s = JSON.parse(readFileSync(join(dir, ".harness/state.json"), "utf8"));
  s.stage = "review";
  writeFileSync(join(dir, ".harness/state.json"), JSON.stringify(s));
  r = runHook("pre-tool-use", base(dir, { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: join(dir, "src/x.mjs") } }));
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /stage review does not edit source/);
});

test("PreToolUse stops the session at the tool-call budget", () => {
  const dir = buildingRepo();
  const s = JSON.parse(readFileSync(join(dir, ".harness/state.json"), "utf8"));
  s.counters.toolCalls.building = 250;
  writeFileSync(join(dir, ".harness/state.json"), JSON.stringify(s));
  const r = runHook("pre-tool-use", base(dir, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" } }));
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /budget for stage building reached \(250\)/);
});

test("PostToolUse blocks a Spanish paragraph or a secret in a written file", () => {
  const dir = buildingRepo();
  const es = "El sistema debe permitir que los usuarios creen notas con un título y un cuerpo, y además debe mostrar la lista de notas ordenada por fecha de creación para que sea fácil encontrar las más recientes.";
  const f = join(dir, "docs/notes.md");
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(f, `# Notes\n\n${es}\n`);
  let r = runHook("post-tool-use", base(dir, { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: f, content: "" }, tool_response: {} }));
  assert.equal(r.json.decision, "block");
  assert.match(r.json.reason, /reads as es/);
  writeFileSync(f, "# Notes\n\nAll good here.\n\nAWS_KEY=AKIAIOSFODNN7EXAMPLE\n");
  r = runHook("post-tool-use", base(dir, { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: f }, tool_response: {} }));
  assert.match(r.json.reason, /aws-access-key/);
  writeFileSync(f, "# Notes\n\nAll good here.\n");
  r = runHook("post-tool-use", base(dir, { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: f }, tool_response: {} }));
  assert.equal(r.json, null);
});

test("SessionStart injects the current brief and records the transcript path", () => {
  const dir = buildingRepo();
  const r = runHook("session-start", base(dir, { hook_event_name: "SessionStart", source: "resume" }));
  const ctx = r.json.hookSpecificOutput.additionalContext;
  assert.match(ctx, /handoff-harness is active/);
  assert.match(ctx, /Stage: build, slice S-1/);
  assert.equal(state(dir).transcriptPath, join(dir, "transcript.jsonl"));
  const r2 = runHook("session-start", { cwd: fixtureRepo(), hook_event_name: "SessionStart", source: "startup" });
  assert.equal(r2.stdout, "");
});

test("SubagentStop blocks a judge that wrote no verdict and accepts a valid one with usage", () => {
  const dir = buildingRepo();
  const s = JSON.parse(readFileSync(join(dir, ".harness/state.json"), "utf8"));
  s.stage = "critic"; s.slice.buildDone = true;
  writeFileSync(join(dir, ".harness/state.json"), JSON.stringify(s));
  const transcript = join(dir, ".harness", "agent.jsonl"); // outside the work tree, so appending to it keeps the work hash
  writeFileSync(transcript, [
    JSON.stringify({ type: "assistant", timestamp: new Date().toISOString(), message: { model: "claude-haiku-5-5", usage: { input_tokens: 1000, cache_creation_input_tokens: 200, cache_read_input_tokens: 5000, output_tokens: 300 } } }),
    JSON.stringify({ type: "user", message: { content: "x" } }),
    JSON.stringify({ type: "assistant", timestamp: new Date().toISOString(), message: { model: "claude-haiku-5-5", usage: { input_tokens: 500, output_tokens: 100 } } }),
  ].join("\n"));
  const input = base(dir, { hook_event_name: "SubagentStop", agent_type: "handoff-harness:critic", agent_id: "a1", agent_transcript_path: transcript, stop_hook_active: false });
  let r = runHook("subagent-stop", input);
  assert.equal(r.json.decision, "block");
  assert.match(r.json.reason, /without writing the verdict/);
  const path = join(dir, ".harness/verdicts/S-1-a1-r1-critic.json");
  writeVerdict(dir, path, { agent: "critic", slice: "S-1", attempt: 1, round: 1, verdict: "pass", findings: [{ id: "F-1", severity: "block", issue: "x", authority: "criterion:C-3", evidence: [] }] });
  r = runHook("subagent-stop", input);
  assert.match(r.json.reason, /verdict is pass but carries 1 block finding/);
  writeVerdict(dir, path, { agent: "critic", slice: "S-1", attempt: 1, round: 1, verdict: "pass", criteria: [{ id: "C-3", status: "met", evidence: [{ type: "test" }] }] });
  r = runHook("subagent-stop", input);
  assert.match(r.json.reason, /evidence of type test needs a path/);
  writeVerdict(dir, path, { agent: "critic", slice: "S-1", attempt: 1, round: 1, verdict: "pass", criteria: [{ id: "C-3", status: "met" }] });
  r = runHook("subagent-stop", input);
  assert.equal(r.json, null, r.stdout + r.stderr);
  let usage = runCli(dir, ["events", "--type", "usage"]).json.events;
  assert.equal(usage.length, 1, "four stops of the same transcript record its usage once");
  assert.equal(usage[0].input, 1500);
  assert.equal(usage[0].cacheRead, 5000);
  assert.equal(usage[0].agent, "critic");
  assert.equal(usage[0].agentId, "a1");
  assert.ok(usage[0].usd > 0);
  // The judge keeps working after a block and stops again: only the new calls are recorded.
  appendFileSync(transcript, "\n" + JSON.stringify({ type: "assistant", timestamp: new Date().toISOString(), message: { id: "msg_x", model: "claude-haiku-5-5", usage: { input_tokens: 40, output_tokens: 7 } } }) + "\n" + JSON.stringify({ type: "assistant", timestamp: new Date().toISOString(), message: { id: "msg_x", model: "claude-haiku-5-5", usage: { input_tokens: 40, output_tokens: 7 } } }));
  r = runHook("subagent-stop", input);
  assert.equal(r.json, null, r.stdout + r.stderr);
  usage = runCli(dir, ["events", "--type", "usage"]).json.events;
  assert.equal(usage.length, 2);
  assert.equal(usage[1].calls, 1, "two rows with one message id are one call");
  assert.equal(usage[1].input, 40);
  assert.equal(usage[1].output, 7);
  assert.equal(usage[1].stops, 2);
  assert.equal(usage[1].totalCalls, 3);
});
