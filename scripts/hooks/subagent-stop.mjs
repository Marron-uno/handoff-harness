#!/usr/bin/env node
// SubagentStop: a judge may not finish without a valid verdict. Usage from the subagent
// transcript is attributed to the stage. The optional Jev gate runs on valid verdicts.
import { existsSync } from "node:fs";
import { bootstrap, agentTypeOf } from "./_common.mjs";
import { readJson, hookBlock } from "../lib/io.mjs";
import { verdictPath } from "../lib/machine.mjs";
import { validateVerdict } from "../lib/verdict.mjs";
import { workHash } from "../lib/git.mjs";
import { summarizeAgentTranscript, costOf } from "../lib/usage.mjs";
import { jevVerdictGate } from "../lib/jev/verdict-gate.mjs";

const ctx = await bootstrap();
if (!ctx.active) process.exit(0);
const { input, cwd, state, profile } = ctx;
const agent = agentTypeOf(input);
const JUDGES = { critic: "critic", "critic-strong": "critic", reviewer: "review", "reviewer-strong": "review" };

if (input.agent_transcript_path && existsSync(input.agent_transcript_path)) {
  const row = summarizeAgentTranscript(input.agent_transcript_path, { stage: state.stage, agent: agent ?? "unknown" });
  ctx.event({ type: "usage", scope: "subagent", agent: row.agent, stage: row.stage, slice: state.slice?.id ?? null, model: row.model, calls: row.calls, input: row.input, cacheWrite: row.cacheWrite, cacheRead: row.cacheRead, output: row.output, usd: Number(costOf(row, profile.pricing).toFixed(4)) });
}

const role = agent ? JUDGES[agent] : null;
if (role && state.slice && (state.stage === "critic" || state.stage === "review")) {
  const path = verdictPath(cwd, state, role);
  if (!existsSync(path)) {
    if (input.stop_hook_active) { ctx.event({ type: "verdict", role, agent, path, valid: false, errors: ["no verdict written after a reminder"] }); ctx.save(); process.exit(0); }
    ctx.save();
    hookBlock(`You finished without writing the verdict. Write it to ${path} following schemas/verdict.schema.json (agent "${agent}", slice ${state.slice.id}, attempt ${state.slice.attempt}, diffHash ${workHash(cwd)}), then stop.`);
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
