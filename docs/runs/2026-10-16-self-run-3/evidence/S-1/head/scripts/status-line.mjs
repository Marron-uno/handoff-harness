#!/usr/bin/env node
// Status line: `stage | slice attempt | blocks | $cost`. Configure in settings.json:
//   "statusLine": { "type": "command", "command": "node <plugin-root>/scripts/status-line.mjs" }
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
let cwd = process.cwd();
try { cwd = JSON.parse(Buffer.concat(chunks).toString("utf8")).workspace?.current_dir ?? JSON.parse(Buffer.concat(chunks).toString("utf8")).cwd ?? cwd; } catch { /* plain */ }
const statePath = join(cwd, ".harness", "state.json");
if (!existsSync(statePath)) process.exit(0);
const s = JSON.parse(readFileSync(statePath, "utf8"));
const usagePath = join(cwd, ".harness", "usage.json");
const usd = existsSync(usagePath) ? JSON.parse(readFileSync(usagePath, "utf8")).totalUsd : null;
const done = s.slices.filter((x) => x.status === "done").length;
const parts = [`${s.goal.id} ${s.stage}`, s.slice ? `${s.slice.id} a${s.slice.attempt}` : `${done}/${s.slices.length} slices`, `blocks ${s.guards.blocks}`];
if (usd !== null) parts.push(`$${usd.toFixed(2)}`);
if (s.halt) parts.push(`HALT ${s.halt.code}`);
process.stdout.write(parts.join(" | "));
