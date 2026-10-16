// Shared hook bootstrap: parse stdin, load state and profile when a harness is active.
import { readStdinJson } from "../lib/io.mjs";
import { projectDir, hasHarness, pluginRoot } from "../lib/paths.mjs";
import { loadState, saveState } from "../lib/state.mjs";
import { loadProfile } from "../lib/profile.mjs";
import { appendEvent } from "../lib/events.mjs";

export async function bootstrap() {
  const input = await readStdinJson();
  const cwd = projectDir(input);
  if (!hasHarness(cwd)) return { input, cwd, active: false };
  let state, profile;
  try { state = loadState(cwd); profile = loadProfile(cwd); }
  catch (err) { process.stderr.write(`handoff-harness: ${err.message}\n`); return { input, cwd, active: false }; }
  return { input, cwd, state, profile, active: true, root: pluginRoot(), save: () => saveState(cwd, state), event: (e) => appendEvent(cwd, e) };
}

export function agentTypeOf(input) {
  return input.agent_type ? String(input.agent_type).replace(/^handoff-harness:/, "") : null;
}
