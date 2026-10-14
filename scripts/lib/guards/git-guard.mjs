// Bash command guard: history is never rewritten, pushes stay on the goal branch,
// state files are written only through the CLI, sensitive files are never read.
import { currentBranch } from "../git.mjs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { globToRegExp } from "../glob.mjs";

const STATE_FILES = /\.harness\/(state\.json|events\.jsonl|plugin-root)/;

function stripQuotes(s) { return s.replace(/^["']|["']$/g, ""); }

export function checkBashCommand(command, { profile, state, cwd }) {
  const text = String(command ?? "");
  for (const p of profile.git.denyPatterns) {
    if (new RegExp(p).test(text)) return { deny: true, guard: "git", reason: `Blocked by the git guard: history rewrites, bulk staging and discard commands are not allowed (${p}). Stage files explicitly and let \`harness record\` commit.` };
  }
  for (const p of profile.shell.denyPatterns) {
    if (new RegExp(p).test(text)) return { deny: true, guard: "shell", reason: `Blocked by the shell guard: destructive command pattern (${p}).` };
  }
  if (state) {
    const branch = currentBranch(cwd);
    const def = state.defaultBranch;
    const push = text.match(/git\s+push\b([^|;&]*)/);
    if (push && profile.git.pushOnlyGoalBranch) {
      const args = push[1].trim().split(/\s+/).filter((a) => a && !a.startsWith("-"));
      const named = args.slice(1);
      if (named.some((a) => a === def || a.endsWith(`/${def}`))) return { deny: true, guard: "git", reason: `Blocked: pushing to the default branch ${def} is not allowed during a goal. Push ${state.branch} only.` };
      if (named.length && !named.includes(state.branch)) return { deny: true, guard: "git", reason: `Blocked: push only the goal branch ${state.branch}, not ${named.join(" ")}.` };
      if (!named.length && branch !== state.branch) return { deny: true, guard: "git", reason: `Blocked: current branch ${branch} is not the goal branch ${state.branch}.` };
    }
    const sw = text.match(/git\s+(checkout|switch)\s+([^\s;&|]+)/);
    if (sw && profile.git.noWorkOnDefaultBranch && (sw[2] === def || sw[2] === "-")) return { deny: true, guard: "git", reason: `Blocked: switching to ${def} during a goal. Work stays on ${state.branch}.` };
  }
  if (STATE_FILES.test(text) && !/cli\.mjs|(?:^|[\s;&|])harness\s/.test(text) && /(>|>>|\btee\b|sed\s+-i|\bmv\b|\brm\b|\bcp\b)/.test(text)) {
    return { deny: true, guard: "state", reason: "Blocked: .harness/state.json, events.jsonl and plugin-root are written only by the harness CLI." };
  }
  // Only path-like tokens are tested: a word such as "secrets" inside a grep pattern is not a file.
  const sensitive = profile.lanes.sensitivePaths.map(globToRegExp);
  for (const token of text.split(/\s+/).map(stripQuotes)) {
    const rel = token.replace(/^\.\//, "");
    if (!rel || rel.endsWith(".example") || rel.endsWith(".sample")) continue;
    const pathLike = rel.includes("/") || rel.startsWith(".") || /\.[a-z0-9]{1,5}$/i.test(rel) || existsSync(join(cwd, rel));
    if (!pathLike) continue;
    if (sensitive.some((re) => re.test(rel) || re.test(rel.split("/").pop()))) return { deny: true, guard: "sensitive", reason: `Blocked: ${rel} matches a sensitive path. Agents never read secrets; use fixture values from .harness/profile.json.` };
  }
  return { deny: false };
}
