#!/usr/bin/env node
// SubagentStop: a judge may not finish without a valid verdict. Usage from the subagent
// transcript is attributed to the stage. The optional Jev gate runs on valid verdicts.
import { existsSync } from "node:fs";
import { bootstrap, agentTypeOf } from "./_common.mjs";
import { readJson, hookBlock } from "../lib/io.mjs";
import { verdictPath } from "../lib/machine.mjs";
import { validateVerdict } from "../lib/verdict.mjs";
import { workHash } from "../lib/git.mjs";
import { summarizeAgentTranscript, usageDelta, costOf } from "../lib/usage.mjs";
import { jevVerdictGate } from "../lib/jev/verdict-gate.mjs";
import { readEvents } from "../lib/events.mjs";

const ctx = await bootstrap();
if (!ctx.active) process.exit(0);
const { input, cwd, state, profile } = ctx;
const agent = agentTypeOf(input);
const JUDGES = { critic: "critic", "critic-strong": "critic", reviewer: "review", "reviewer-strong": "review", "spec-reviewer": "spec" };

if (input.agent_transcript_path && existsSync(input.agent_transcript_path)) {
  // Attribute to the stage the agent was spawned in, not the stage at the time it finished.
  const agentId = input.agent_id ?? null;
  const start = readEvents(cwd, (e) => e.type === "note" && e.text === "subagent start" && e.agentId && e.agentId === agentId).pop();
  const total = summarizeAgentTranscript(input.agent_transcript_path, { stage: start?.stage ?? state.stage, agent: agent ?? "unknown" });
  // This hook fires again when a blocked judge stops a second time; record only what is new.
  const previous = agentId ? readEvents(cwd, (e) => e.type === "usage" && e.scope === "subagent" && e.agentId === agentId) : [];
  const row = usageDelta(total, previous);
  if (row.calls > 0 || row.output > 0) {
    ctx.event({ type: "usage", scope: "subagent", agentId, agent: row.agent, stage: row.stage, slice: state.slice?.id ?? null, model: row.model, calls: row.calls, input: row.input, cacheWrite: row.cacheWrite, cacheWrite1h: row.cacheWrite1h, cacheRead: row.cacheRead, output: row.output, usd: Number(costOf(row, profile.pricing).toFixed(4)), stops: previous.length + 1, totalCalls: total.calls });
  }
}

const role = agent ? JUDGES[agent] : null;
const judging = role === "spec" ? state.spec && state.stage === "spec_review" : state.slice && (state.stage === "critic" || state.stage === "review");
if (role && judging) {
  const path = verdictPath(cwd, state, role);
  const where = role === "spec" ? `slice null, attempt ${state.spec.attempt}` : `slice ${state.slice.id}, attempt ${state.slice.attempt}`;
  if (!existsSync(path)) {
    if (input.stop_hook_active) { ctx.event({ type: "verdict", role, agent, path, valid: false, errors: ["no verdict written after a reminder"] }); ctx.save(); process.exit(0); }
    ctx.save();
    hookBlock(`You finished without writing the verdict. Write it to ${path} following schemas/verdict.schema.json (agent "${agent}", ${where}, diffHash ${workHash(cwd)}), then stop.`);
  }
  const result = validateVerdict(cwd, readJson(path, null), { state, profile, workHash: workHash(cwd), role });
  if (!result.ok && !input.stop_hook_active) {
    ctx.event({ type: "verdict", role, agent, path, valid: false, errors: result.errors.slice(0, 10) });
    ctx.save();
    hookBlock(`The verdict at ${path} is invalid:\n- ${result.errors.join("\n- ")}\nFix the file, then stop.`);
  }
  if (result.ok && state.goal.jev && profile.jev.enabled) {
    const gate = await jevVerdictGate(cwd, result.verdict, { state, profile });
    if (gate.route === "re-review" && !input.stop_hook_active) {
      ctx.save();
      hookBlock(`A calibrated check questions this verdict (${gate.reasons.join("; ")}). Re-examine the findings named, correct the evidence or severity, and write the verdict again.`);
    }
  }
}
ctx.save();
process.exit(0);
