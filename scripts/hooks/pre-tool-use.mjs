#!/usr/bin/env node
// PreToolUse: git/shell guard, file lanes, browser lane, tool-call budgets.
import { bootstrap, agentTypeOf } from "./_common.mjs";
import { hookDeny } from "../lib/io.mjs";
import { checkBashCommand } from "../lib/guards/git-guard.mjs";
import { checkFileAccess } from "../lib/guards/path-guard.mjs";
import { checkBrowserTool } from "../lib/guards/browser-guard.mjs";

const ctx = await bootstrap();
if (!ctx.active) process.exit(0);
const { input, cwd, state, profile, root } = ctx;
const tool = input.tool_name ?? "";
const agentType = agentTypeOf(input);

function deny(result) {
  ctx.event({ type: "guard", guard: result.guard, tool, stage: state.stage, slice: state.slice?.id ?? null, agent: agentType ?? undefined, reason: result.reason.slice(0, 300) });
  ctx.save();
  hookDeny(result.reason);
}

// Budget: tool calls per stage (main session only; subagents have their own maxTurns).
if (!agentType) {
  const cap = profile.budgets.toolCallsPerStage[state.stage];
  const used = state.counters.toolCalls[state.stage] ?? 0;
  if (cap && used >= cap) deny({ guard: "budget", reason: `Tool-call budget for stage ${state.stage} reached (${cap}). Stop now so the Stop hook can decide; a human can raise budgets in .harness/profile.json.` });
  state.counters.toolCalls[state.stage] = used + 1;
}

let result = { deny: false };
if (tool === "Bash") result = checkBashCommand(input.tool_input?.command, { profile, state, cwd });
else if (["Edit", "Write", "MultiEdit", "NotebookEdit", "Read"].includes(tool)) result = checkFileAccess({ tool, filePath: input.tool_input?.file_path ?? input.tool_input?.notebook_path, cwd, profile, state, agentType, pluginRoot: root });
else if (tool.startsWith("mcp__claude-in-chrome__")) {
  result = checkBrowserTool({ tool, input: input.tool_input, state, profile });
  if (!result.deny) {
    state.counters.browserActions += 1;
    if (result.host !== undefined && result.host !== state.browser.lastHost) {
      state.browser.lastHost = result.host;
      ctx.event({ type: "browser", host: result.host, kind: result.kind, stage: state.stage, slice: state.slice?.id ?? null, agent: agentType ?? undefined });
    }
  }
}
if (result.deny) deny(result);
ctx.save();
process.exit(0);
