import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";

export function nowIso() { return new Date().toISOString(); }

export function readJson(path, fallback) {
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing file: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  renameSync(tmp, path);
}

export function appendLine(path, line) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, line.endsWith("\n") ? line : line + "\n");
}

export function readLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean);
}

export async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

// Hook output helpers. Each prints one JSON object and exits 0 unless noted.
export function hookAllow(extra = {}) {
  if (Object.keys(extra).length) process.stdout.write(JSON.stringify(extra));
  process.exit(0);
}
export function hookDeny(reason, event = "PreToolUse") {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: event, permissionDecision: "deny", permissionDecisionReason: reason }
  }));
  process.exit(0);
}
export function hookBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}
export function hookContext(event, additionalContext, extra = {}) {
  process.stdout.write(JSON.stringify({ ...extra, hookSpecificOutput: { hookEventName: event, additionalContext } }));
  process.exit(0);
}
