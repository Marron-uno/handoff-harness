#!/usr/bin/env node
// SubagentStart: record which stage a judge was spawned in, so its usage is attributed there
// even when it finishes after the stage moved on.
import { bootstrap, agentTypeOf } from "./_common.mjs";
const ctx = await bootstrap();
if (!ctx.active) process.exit(0);
ctx.event({ type: "note", text: "subagent start", agentId: ctx.input.agent_id ?? null, agent: agentTypeOf(ctx.input) ?? "unknown", stage: ctx.state.stage, slice: ctx.state.slice?.id ?? null });
process.exit(0);
