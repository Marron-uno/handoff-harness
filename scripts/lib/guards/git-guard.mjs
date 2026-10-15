// Bash command guard: history is never rewritten, pushes stay on the goal branch,
// state files are written only through the CLI, sensitive files are never read.
import { currentBranch } from "../git.mjs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isSensitivePath } from "./path-guard.mjs";

const STATE_FILES = /\.harness\/(state\.json|events\.jsonl|plugin-root)/;

function stripQuotes(s) { return s.replace(/^["']|["']$/g, ""); }

// True when a state file is the target of a write, not merely read by a command that writes
// elsewhere (`jq . .harness/state.json > /tmp/out.json` is a read). Run 2's reconciler was
// denied for exactly that shape.
function writesStateFile(text) {
  if (/(?:>>?|\btee\b(?:\s+-a)?)\s*["']?[^\s"'|;&]*\.harness\/(state\.json|events\.jsonl|plugin-root)/.test(text)) return true;
  if (/\bsed\s+-i[^|;&]*\.harness\/(state\.json|events\.jsonl|plugin-root)/.test(text)) return true;
  if (/\brm\b[^|;&]*\.harness\/(state\.json|events\.jsonl|plugin-root)/.test(text)) return true;
  for (const seg of text.split(/[|;&]+/)) {
    const m = seg.match(/\b(mv|cp)\b(.*)$/);
    if (!m) continue;
    const args = m[2].trim().split(/\s+/).filter((a) => a && !a.startsWith("-"));
    if (args.length && STATE_FILES.test(args[args.length - 1])) return true;
  }
  return false;
}

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
    // A goal resting in done is dormant: branches may be switched and pushed as in any repository,
    // except that the default branch is never pushed from a session.
    const dormant = state.stage === "done";
    const push = text.match(/git\s+push\b([^|;&]*)/);
    if (push && profile.git.pushOnlyGoalBranch) {
      const args = push[1].trim().split(/\s+/).filter((a) => a && !a.startsWith("-"));
      const named = args.slice(1);
      if (named.some((a) => a === def || a.endsWith(`/${def}`))) return { deny: true, guard: "git", reason: `Blocked: pushing to the default branch ${def} is not allowed from a session.${dormant ? "" : ` Push ${state.branch} only.`}` };
      if (dormant) {
        if (!named.length && branch === def) return { deny: true, guard: "git", reason: `Blocked: pushing the default branch ${def} is not allowed from a session.` };
      } else {
        if (named.length && !named.includes(state.branch)) return { deny: true, guard: "git", reason: `Blocked: push only the goal branch ${state.branch}, not ${named.join(" ")}.` };
        if (!named.length && branch !== state.branch) return { deny: true, guard: "git", reason: `Blocked: current branch ${branch} is not the goal branch ${state.branch}.` };
      }
    }
    const sw = text.match(/git\s+(checkout|switch)\s+([^\s;&|]+)/);
    if (sw && !dormant && profile.git.noWorkOnDefaultBranch && (sw[2] === def || sw[2] === "-")) return { deny: true, guard: "git", reason: `Blocked: switching to ${def} during a goal. Work stays on ${state.branch}.` };
  }
  if (STATE_FILES.test(text) && !/cli\.mjs|(?:^|[\s;&|])harness\s/.test(text) && writesStateFile(text)) {
    return { deny: true, guard: "state", reason: "Blocked: .harness/state.json, events.jsonl and plugin-root are written only by the harness CLI." };
  }
  // Only path-like tokens are tested: a word such as "secrets" inside a grep pattern is not a file.
  for (const token of text.split(/\s+/).map(stripQuotes)) {
    const rel = token.replace(/^\.\//, "");
    if (!rel) continue;
    const pathLike = rel.includes("/") || rel.startsWith(".") || /\.[a-z0-9]{1,5}$/i.test(rel) || existsSync(join(cwd, rel));
    if (!pathLike) continue;
    if (isSensitivePath(rel, profile.lanes.sensitivePaths)) return { deny: true, guard: "sensitive", reason: `Blocked: ${rel} matches a sensitive path. Agents never read secrets; use fixture values from .harness/profile.json.` };
  }
  return { deny: false };
}
