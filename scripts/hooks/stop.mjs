#!/usr/bin/env node
// Stop hook: the state machine. Allows the session to end only in a resting stage.
import { readStdinJson, hookBlock } from "../lib/io.mjs";
import { projectDir, hasHarness } from "../lib/paths.mjs";
import { loadState, saveState } from "../lib/state.mjs";
import { loadProfile } from "../lib/profile.mjs";
import { decide } from "../lib/machine.mjs";

const input = await readStdinJson();
const cwd = projectDir(input);
if (!hasHarness(cwd)) process.exit(0);

let state, profile;
try {
  state = loadState(cwd);
  profile = loadProfile(cwd);
} catch (err) {
  process.stderr.write(`handoff-harness: cannot load state: ${err.message}\n`);
  process.exit(1);
}
if (input.transcript_path && state.transcriptPath !== input.transcript_path) state.transcriptPath = input.transcript_path;

let result;
try {
  result = decide({ cwd, state, profile, input });
} catch (err) {
  process.stderr.write(`handoff-harness: state machine error: ${err.stack}\n`);
  saveState(cwd, state);
  process.exit(1);
}
saveState(cwd, state);
if (result.action === "block") hookBlock(result.reason);
const out = {};
if (result.systemMessage) out.systemMessage = result.systemMessage;
if (Object.keys(out).length) process.stdout.write(JSON.stringify(out));
process.exit(0);
