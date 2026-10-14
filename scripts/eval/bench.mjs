#!/usr/bin/env node
// Paid bench: N fresh headless runs of the fixture goal, each snapshotted with its metrics.
// usage: node scripts/eval/bench.mjs --label <name> [--runs 3] [--out evals/bench] [--jev] [--chrome]
//        [--model sonnet] [--change lantern-v0-2] [--sentence "..."] [--budget-usd 8] [--budget-minutes 45]
//        [--allow-double-hooks]
// Three runs cost a few dollars and see large effects, not small ones. Keys come from the
// environment only (AI_GATEWAY_API_KEY or TYPESAFE_API_KEY for --jev); nothing is written to the project.
import { spawnSync, execSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runMetrics } from "../lib/metrics.mjs";

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const has = (name) => args.includes(`--${name}`);
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const label = flag("label", null);
if (!label || !/^[\w.-]+$/.test(label)) { console.error("usage: bench.mjs --label <name> [--runs 3] ..."); process.exit(1); }
const runs = Number(flag("runs", 3));
const out = resolve(flag("out", join(pluginRoot, "evals", "bench")), label);
const model = flag("model", "sonnet");
const change = flag("change", "lantern-v0-2");
const sentence = flag("sentence", "build all of the handoff");
const cli = join(pluginRoot, "scripts", "cli.mjs");
const jev = has("jev");
if (jev && !process.env.AI_GATEWAY_API_KEY && !process.env.TYPESAFE_API_KEY && !process.env.OPENROUTER_API_KEY) { console.error("[bench] --jev needs a key in the environment"); process.exit(1); }
const provider = process.env.AI_GATEWAY_API_KEY ? "vercel" : process.env.OPENROUTER_API_KEY ? "openrouter" : "typesafe";

// With the marketplace copy enabled, every hook runs twice and the numbers are wrong.
try {
  const list = execSync("claude plugin list", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const block = list.split("\n").slice(list.split("\n").findIndex((l) => /handoff-harness@/.test(l))).slice(0, 5).join("\n");
  if (/handoff-harness@/.test(list) && /enabled/.test(block) && !has("allow-double-hooks")) { console.error("[bench] the marketplace copy of handoff-harness is enabled; hooks would run twice. Run `claude plugin disable handoff-harness@marron-uno` first, or pass --allow-double-hooks."); process.exit(1); }
} catch { /* no claude on PATH is caught by the driver */ }

if (existsSync(out)) { console.error(`[bench] ${out} exists; pick another label`); process.exit(1); }
mkdirSync(out, { recursive: true });
const version = JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8")).version;
let sha = null; try { sha = execSync("git rev-parse --short HEAD", { cwd: pluginRoot, encoding: "utf8" }).trim(); } catch { /* not a repo */ }
const summary = { label, version, sha, date: new Date().toISOString(), model, jev, chrome: has("chrome"), sentence, change, runs: [] };
const sh = (cmd, cwd) => { const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8" }); if (r.status !== 0) throw new Error(`${cmd}\n${r.stderr}`); return r.stdout; };

for (let i = 1; i <= runs; i++) {
  const base = join(out, String(i));
  const project = join(base, "project");
  mkdirSync(base, { recursive: true });
  cpSync(join(pluginRoot, "fixture"), project, { recursive: true });
  sh('git init -q -b main && git config user.email bench@example.com && git config user.name Bench && git config commit.gpgsign false && git add . && git commit -qm "fixture: initial"', project);
  sh(`node "${cli}" init >/dev/null`, project);
  if (jev) {
    const p = JSON.parse(readFileSync(join(project, ".harness", "profile.json"), "utf8"));
    p.jev = { enabled: true, provider };
    writeFileSync(join(project, ".harness", "profile.json"), JSON.stringify(p, null, 2) + "\n");
    sh('git add .harness/profile.json && git commit -qm "chore: jev on"', project);
  }
  sh(`node "${cli}" goal new --sentence "${sentence.replace(/"/g, '\\"')}" --source handoff/HANDOFF.md --openspec --change ${change} ${jev ? "--jev " : ""}--auto-approve --budget-usd ${flag("budget-usd", 8)} --budget-minutes ${flag("budget-minutes", 45)} >/dev/null`, project);
  const log = join(base, "drive.log");
  const started = Date.now();
  console.log(`[bench] ${label} run ${i} of ${runs}: starting`);
  const d = spawnSync(process.execPath, [join(pluginRoot, "scripts", "drive.mjs"), "--cwd", project, "--model", model, "--max-iterations", "12", "--log", log, "--allowed-tools", "Bash,Read,Write,Edit,MultiEdit,Glob,Grep,Agent,Skill,mcp__claude-in-chrome,mcp__claude-in-chrome__*", ...(has("chrome") ? ["--chrome"] : [])], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(base, "drive.out"), (d.stdout ?? "") + (d.stderr ?? ""));
  const snapshot = join(base, "snapshot");
  sh(`node "${cli}" snapshot --to "${snapshot}" --log "${log}" >/dev/null`, project);
  const metrics = runMetrics(snapshot);
  writeFileSync(join(base, "metrics.json"), JSON.stringify(metrics, null, 2) + "\n");
  summary.runs.push({ run: i, dir: snapshot, driveExit: d.status, seconds: Math.round((Date.now() - started) / 1000), metrics });
  writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(`[bench] run ${i}: ${metrics.stage}, ${metrics.slicesDone}/${metrics.slicesTotal} slices, ${metrics.minutes} min, $${metrics.costReported}, blocks ${metrics.blocks}, invalid verdicts ${metrics.invalidVerdicts}/${metrics.verdictWrites}`);
  // The project copy is large and reproducible from the snapshot; keep the bench folder small.
  if (!has("keep-projects")) rmSync(project, { recursive: true, force: true });
}
console.log(`[bench] done: ${out}/summary.json. Compare with: node scripts/eval/compare.mjs <baseline> ${out}`);
