#!/usr/bin/env node
// Headless driver for unattended runs. Claude Code caps consecutive Stop-hook continuations at
// eight, so a long goal needs an outer loop: each iteration starts one headless session that
// follows the current brief, then this script reads state.json and decides whether to go again.
//
// usage: node scripts/drive.mjs [--cwd <project>] [--max-iterations 40] [--model <id>] [--permission-mode acceptEdits]
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const cwd = resolve(flag("cwd", process.cwd()));
const maxIterations = Number(flag("max-iterations", 40));
const model = flag("model", null);
const permissionMode = flag("permission-mode", "acceptEdits");
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const statePath = join(cwd, ".harness", "state.json");
const RESTING = new Set(["awaiting_approval", "awaiting_human", "budget_exceeded", "halted", "done"]);

if (!existsSync(statePath)) { console.error("no .harness/state.json; start a goal first"); process.exit(1); }

for (let i = 1; i <= maxIterations; i++) {
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  if (RESTING.has(state.stage)) {
    console.log(`[drive] resting in ${state.stage}${state.halt ? `: ${state.halt.reason}` : ""}`);
    process.exit(state.stage === "done" ? 0 : 2);
  }
  console.log(`[drive] iteration ${i}: stage ${state.stage}${state.slice ? `, slice ${state.slice.id} attempt ${state.slice.attempt}` : ""}`);
  const prompt = `handoff-harness: continue goal ${state.goal.id}. Run \`node "${pluginRoot}/scripts/cli.mjs" resume\`, follow the brief literally, and stop when it says to stop.`;
  const cliArgs = ["-p", prompt, "--plugin-dir", pluginRoot, "--permission-mode", permissionMode, "--settings", JSON.stringify({ advisorModel: "none" })];
  if (model) cliArgs.push("--model", model);
  const r = spawnSync("claude", cliArgs, { cwd, stdio: ["ignore", "inherit", "inherit"] });
  if (r.error) { console.error(`[drive] cannot run claude: ${r.error.message}`); process.exit(1); }
}
console.log(`[drive] stopped after ${maxIterations} iterations`);
process.exit(3);
