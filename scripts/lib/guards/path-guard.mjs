// File tool guard: lanes per stage and per agent, protected paths, sensitive reads,
// no edits on the default branch, harness files only through proposals.
import { relative, isAbsolute } from "node:path";
import { globToRegExp } from "../glob.mjs";
import { currentBranch } from "../git.mjs";

const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const NO_EDIT_STAGES = new Set(["spec_review", "awaiting_approval", "awaiting_human", "budget_exceeded", "halted", "done", "preflight", "critic", "review", "record", "report"]);
const SUBAGENT_JUDGES = new Set(["critic", "critic-strong", "reviewer", "reviewer-strong", "spec-reviewer", "reconciler"]);

function rel(cwd, filePath) {
  if (!filePath) return "";
  const r = isAbsolute(filePath) ? relative(cwd, filePath) : filePath;
  return r.replace(/^\.\//, "");
}

export function checkFileAccess({ tool, filePath, cwd, profile, state, agentType, pluginRoot }) {
  const path = rel(cwd, filePath);
  const base = path.split("/").pop() ?? "";
  const isWrite = WRITE_TOOLS.has(tool);
  const match = (globs) => globs.some((g) => { const re = globToRegExp(g); return re.test(path) || re.test(base); });

  if (!isWrite) {
    if (path && !path.endsWith(".example") && !path.endsWith(".sample") && match(profile.lanes.sensitivePaths)) {
      return { deny: true, guard: "sensitive", reason: `Blocked: ${path} matches a sensitive path. Agents never read secrets.` };
    }
    return { deny: false };
  }

  if (pluginRoot && isAbsolute(filePath) && filePath.startsWith(pluginRoot)) {
    return { deny: true, guard: "harness-files", reason: `Blocked: the harness's own files are read-only from inside a run. Write a proposal to ${profile.lanes.proposalsDir}/ instead.` };
  }
  if (match(profile.lanes.protectedPaths)) {
    return { deny: true, guard: "protected", reason: `Blocked: ${path} is protected (specs, harness state, Claude config). Propose changes in ${profile.lanes.proposalsDir}/.` };
  }
  if (agentType && SUBAGENT_JUDGES.has(agentType.replace(/^handoff-harness:/, ""))) {
    if (!match(profile.lanes.subagentWritable)) {
      return { deny: true, guard: "lane", reason: `Blocked: ${agentType} is read-only except ${profile.lanes.subagentWritable.join(", ")}. Report the problem as a finding instead of fixing it.` };
    }
    return { deny: false };
  }
  if (state) {
    const inHarness = path.startsWith(".harness/");
    if (profile.git.noWorkOnDefaultBranch && !inHarness && currentBranch(cwd) === state.defaultBranch) {
      return { deny: true, guard: "branch", reason: `Blocked: editing on the default branch ${state.defaultBranch}. Switch to ${state.branch}.` };
    }
    if (NO_EDIT_STAGES.has(state.stage) && !inHarness) {
      return { deny: true, guard: "lane", reason: `Blocked: stage ${state.stage} does not edit source. Follow the stage brief (\`harness resume\` prints it).` };
    }
  }
  return { deny: false };
}
