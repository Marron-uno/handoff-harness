#!/usr/bin/env node
// PostToolUse: fast checks on the file just written (language, secrets, prose) and tool telemetry.
import { existsSync, readFileSync } from "node:fs";
import { relative, isAbsolute } from "node:path";
import { bootstrap, agentTypeOf } from "./_common.mjs";
import { checkFileLanguage } from "../lib/guards/language-guard.mjs";
import { lintProse } from "../lib/guards/prose-lint.mjs";
import { scanText } from "../lib/guards/secret-scan.mjs";

const ctx = await bootstrap();
if (!ctx.active) process.exit(0);
const { input, cwd, state, profile } = ctx;
const tool = input.tool_name ?? "";
const agentType = agentTypeOf(input);

if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (filePath && existsSync(filePath)) {
    const rel = isAbsolute(filePath) ? relative(cwd, filePath) : filePath;
    const content = readFileSync(filePath, "utf8");
    const problems = [];
    for (const h of checkFileLanguage(rel, content, profile.language)) problems.push(`line ${h.line} reads as ${h.lang} (${h.hits} function words vs ${h.englishHits} English): "${h.sample}". Everything agents write is English; only non-English locale files and verbatim client copy are exempt.`);
    for (const h of scanText(content, { allow: profile.secrets.allow, extraPatterns: profile.secrets.extraPatterns })) problems.push(`line ${h.line}: ${h.pattern} ${h.match}. Never write credentials; use an obviously fake placeholder or the fixture value.`);
    for (const h of lintProse(rel, content, profile.prose)) problems.push(`line ${h.line}: ${h.rule} "${h.sample}".`);
    if (problems.length) {
      ctx.event({ type: "guard", guard: "post-write", tool, file: rel, stage: state.stage, slice: state.slice?.id ?? null, agent: agentType ?? undefined, count: problems.length });
      ctx.save();
      process.stdout.write(JSON.stringify({ decision: "block", reason: `${rel}: ${problems.length} issue(s) to fix now:\n- ${problems.slice(0, 8).join("\n- ")}` }));
      process.exit(0);
    }
  }
}
if (typeof input.duration_ms === "number" && input.duration_ms > 5000) {
  ctx.event({ type: "tool", tool, durationMs: input.duration_ms, stage: state.stage, slice: state.slice?.id ?? null, agent: agentType ?? undefined });
}
process.exit(0);
