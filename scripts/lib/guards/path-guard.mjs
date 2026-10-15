// File tool guard: lanes per stage and per agent, protected paths, sensitive reads,
// no edits on the default branch, harness files only through proposals. Lanes apply to paths
// inside the project only; the session scratchpad and other repositories are never denied.
import { relative, isAbsolute, resolve, dirname, basename, join } from "node:path";
import { existsSync, realpathSync } from "node:fs";
import { samePath } from "../paths.mjs";
import { globToRegExp } from "../glob.mjs";
import { currentBranch } from "../git.mjs";

const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const NO_EDIT_STAGES = new Set(["spec_review", "awaiting_approval", "awaiting_human", "budget_exceeded", "halted", "preflight", "critic", "review", "record", "report"]);
const SUBAGENT_JUDGES = new Set(["critic", "critic-strong", "reviewer", "reviewer-strong", "spec-reviewer", "reconciler"]);
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

// A credential file by name: .env, keys, anything called *secret*. A test file named after what
// it tests (browser-secret.test.mjs) is source, not a credential, and so are .example samples.
export function isSensitivePath(path, globs) {
  if (!path) return false;
  const base = basename(path);
  if (path.endsWith(".example") || path.endsWith(".sample") || TEST_FILE.test(base)) return false;
  return globs.some((g) => { const re = globToRegExp(g); return re.test(path) || re.test(base); });
}

// Real path of the deepest existing ancestor plus the rest, so a file about to be created under a
// symlinked directory (macOS keeps /var and /private/var apart) still resolves where it will land.
function realPathLoose(p) {
  let cur = resolve(p);
  const tail = [];
  while (!existsSync(cur)) {
    const parent = dirname(cur);
    if (parent === cur) break;
    tail.unshift(basename(cur));
    cur = parent;
  }
  try { cur = realpathSync(cur); } catch { /* keep the resolved path */ }
  return join(cur, ...tail);
}

// Project-relative path, or null when the file lives outside the project.
export function projectRelative(cwd, filePath) {
  if (!filePath) return "";
  if (!isAbsolute(filePath)) return filePath.replace(/^\.\//, "");
  const r = relative(realPathLoose(cwd), realPathLoose(filePath));
  if (!r) return "";
  if (r.startsWith("..") || isAbsolute(r)) return null;
  return r;
}

export function checkFileAccess({ tool, filePath, cwd, profile, state, agentType, pluginRoot }) {
  const rel = projectRelative(cwd, filePath);
  const path = rel ?? "";
  const base = path.split("/").pop() ?? "";
  const isWrite = WRITE_TOOLS.has(tool);
  const match = (globs) => globs.some((g) => { const re = globToRegExp(g); return re.test(path) || re.test(base); });

  if (!isWrite) {
    // Secrets are never read, inside or outside the project.
    const probe = rel ?? String(filePath ?? "");
    if (isSensitivePath(probe, profile.lanes.sensitivePaths)) {
      return { deny: true, guard: "sensitive", reason: `Blocked: ${probe} matches a sensitive path. Agents never read secrets.` };
    }
    return { deny: false };
  }

  if (pluginRoot && isAbsolute(filePath) && filePath.startsWith(pluginRoot)) {
    // The project may be a checkout of the harness; that is fine as long as a different, frozen
    // copy is the one enforcing the run. The same copy editing itself is what this rule forbids.
    const self = samePath(pluginRoot, cwd);
    return { deny: true, guard: "harness-files", reason: self
      ? `Blocked: this project is the harness itself and the same copy is enforcing the run, so its files are read-only. Drive it with a frozen copy: node scripts/drive.mjs --cwd . --plugin-root <copy of the plugin>.`
      : `Blocked: the harness's own files are read-only from inside a run. Write a proposal to ${profile.lanes.proposalsDir}/ instead.` };
  }
  // Outside the project (the session scratchpad, another repository) the lanes do not apply:
  // they protect this project's source between judge and record, nothing else.
  if (rel === null) return { deny: false };
  if (match(profile.lanes.protectedPaths)) {
    return { deny: true, guard: "protected", reason: `Blocked: ${path} is protected (specs, harness state, Claude config). Propose changes in ${profile.lanes.proposalsDir}/.` };
  }
  if (agentType && SUBAGENT_JUDGES.has(agentType.replace(/^handoff-harness:/, ""))) {
    if (!match(profile.lanes.subagentWritable)) {
      return { deny: true, guard: "lane", reason: `Blocked: ${agentType} is read-only except ${profile.lanes.subagentWritable.join(", ")}. Report the problem as a finding instead of fixing it.` };
    }
    return { deny: false };
  }
  if (state && !path.startsWith(".harness/")) {
    const branch = currentBranch(cwd);
    if (state.stage === "done") {
      // A finished goal is dormant: follow-up work is allowed on any branch except the default
      // branch, which stays protected, and the goal branch, which the judges already signed off.
      if (profile.git.noWorkOnDefaultBranch && branch === state.defaultBranch) {
        return { deny: true, guard: "branch", reason: `Blocked: goal ${state.goal.id} is done and ${branch} is the default branch. Create a branch for follow-up work (git checkout -b <name>) or start a new goal.` };
      }
      if (branch === state.branch) {
        return { deny: true, guard: "lane", reason: `Blocked: goal ${state.goal.id} is done and ${branch} is its reviewed goal branch. Follow-up work goes on a new branch (git checkout -b <name>) or a new goal.` };
      }
      return { deny: false };
    }
    if (profile.git.noWorkOnDefaultBranch && branch === state.defaultBranch) {
      return { deny: true, guard: "branch", reason: `Blocked: editing on the default branch ${state.defaultBranch}. Switch to ${state.branch}.` };
    }
    if (NO_EDIT_STAGES.has(state.stage)) {
      return { deny: true, guard: "lane", reason: `Blocked: stage ${state.stage} does not edit source. Follow the stage brief (\`harness resume\` prints it).` };
    }
  }
  return { deny: false };
}
