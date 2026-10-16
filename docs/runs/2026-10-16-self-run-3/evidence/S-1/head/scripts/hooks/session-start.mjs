#!/usr/bin/env node
// SessionStart: record the transcript path and plugin root, inject only the current stage brief.
import { writeFileSync } from "node:fs";
import { bootstrap } from "./_common.mjs";
import { harnessPaths } from "../lib/paths.mjs";
import { briefFor } from "../lib/machine.mjs";
import { RESTING } from "../lib/state.mjs";

const ctx = await bootstrap();
if (!ctx.active) process.exit(0);
const { input, cwd, state, profile, root } = ctx;
if (input.transcript_path) state.transcriptPath = input.transcript_path;
state.pluginRoot = root;
writeFileSync(harnessPaths(cwd).pluginRoot, root + "\n");
ctx.event({ type: "note", text: `session ${input.source ?? "start"}`, stage: state.stage });
ctx.save();

const cli = `node "${root}/scripts/cli.mjs"`;
const header = [
  `handoff-harness is active in this project. Goal ${state.goal.id}: "${state.goal.sentence}". Stage: ${state.stage}${state.slice ? `, slice ${state.slice.id} attempt ${state.slice.attempt}` : ""}.`,
  `Rules: never edit .harness/state.json or events.jsonl by hand; every state change goes through \`${cli} <command>\`. The Stop hook decides when a stage is complete and injects the next brief. If unsure, run \`${cli} resume\`.`,
];
const body = RESTING.has(state.stage)
  ? `The run is resting (${state.stage})${state.halt ? `: ${state.halt.reason}` : ""}. ${state.stage === "done" ? `Goal ${state.goal.id} is done and the harness is dormant: follow-up work goes on a new branch (${state.defaultBranch} and ${state.branch} stay protected from edits), or start a new goal.` : "Wait for the human."}`
  : briefFor(cwd, state, profile);
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `${header.join("\n")}\n\n${body}` } }));
process.exit(0);
