#!/usr/bin/env node
// Headless driver for unattended runs. Claude Code caps consecutive Stop-hook continuations at
// eight, so a long goal needs an outer loop: each iteration starts one headless session that
// follows the current brief, then this script reads state.json and decides whether to go again.
//
// usage: node scripts/drive.mjs [--cwd <project>] [--max-iterations 40] [--model <id>]
//        [--permission-mode acceptEdits] [--allowed-tools "Bash,Read,Write,Edit,Agent"] [--chrome] [--log <file>]
// Headless sessions cannot answer permission prompts, so pass --allowed-tools with what the run
// needs; the harness hooks still deny what the rules forbid.
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { appendEvent } from "./lib/events.mjs";

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const cwd = resolve(flag("cwd", process.cwd()));
const maxIterations = Number(flag("max-iterations", 40));
const model = flag("model", null);
const permissionMode = flag("permission-mode", "acceptEdits");
const allowedTools = flag("allowed-tools", null);
const chrome = args.includes("--chrome");
const logFile = flag("log", null);
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
  const cliArgs = ["-p", prompt, "--plugin-dir", pluginRoot, "--permission-mode", permissionMode, "--settings", JSON.stringify({ advisorModel: "none" }), "--output-format", "json"];
  if (model) cliArgs.push("--model", model);
  if (allowedTools) cliArgs.push("--allowedTools", allowedTools);
  if (chrome) cliArgs.push("--chrome");
  const started = Date.now();
  const r = spawnSync("claude", cliArgs, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) { console.error(`[drive] cannot run claude: ${r.error.message}`); process.exit(1); }
  let summary = { turns: null, usd: null, isError: null, result: "" };
  try { const d = JSON.parse(r.stdout); summary = { turns: d.num_turns, usd: d.total_cost_usd, isError: d.is_error, result: String(d.result ?? "").slice(0, 300) }; } catch { summary.result = r.stdout.slice(-300); }
  const line = `[drive] session ${i}: ${Math.round((Date.now() - started) / 1000)}s, turns ${summary.turns}, $${summary.usd?.toFixed?.(3) ?? "?"}, error ${summary.isError}${r.stderr.trim() ? `, stderr: ${r.stderr.trim().split("\n").pop().slice(0, 200)}` : ""}`;
  console.log(line);
  if (logFile) appendFileSync(logFile, `${new Date().toISOString()} iteration ${i} stage ${state.stage} ${JSON.stringify(summary)}\n`);
  // Claude Code's own figure for the session is the number of record; the report prints it next
  // to the harness price table.
  try { appendEvent(cwd, { type: "session", scope: "driver", iteration: i, stage: state.stage, seconds: Math.round((Date.now() - started) / 1000), turns: summary.turns, usd: summary.usd, isError: summary.isError }); } catch (err) { console.error(`[drive] cannot record the session: ${err.message}`); }
  // The report was written inside the session, before this figure existed: re-render it now that
  // the run rests, so the committed report carries the number of record.
  try {
    const after = JSON.parse(readFileSync(statePath, "utf8"));
    if (RESTING.has(after.stage)) {
      const rr = spawnSync(process.execPath, [join(pluginRoot, "scripts", "cli.mjs"), "report", "--refresh"], { cwd, encoding: "utf8" });
      let refreshed = null; try { refreshed = JSON.parse(rr.stdout); } catch { /* reported below */ }
      console.log(`[drive] report refreshed: ${refreshed?.ok ? `commit ${refreshed.commit ? refreshed.commit.slice(0, 7) : "none"}` : (rr.stderr || rr.stdout).trim().slice(0, 200)}`);
    }
  } catch (err) { console.error(`[drive] cannot refresh the report: ${err.message}`); }
}
console.log(`[drive] stopped after ${maxIterations} iterations`);
process.exit(3);
