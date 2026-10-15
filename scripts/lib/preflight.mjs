// Deterministic checks that run before any model judges the slice. Each check returns
// { id, status: pass|fail|skip, details, durationMs }. The list is extended by the guards.
import { existsSync, mkdtempSync, mkdirSync, copyFileSync, symlinkSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { changedFiles, diffStat, workHash, currentBranch, git, headSha } from "./git.mjs";
import { harnessPaths, pluginRoot } from "./paths.mjs";
import { writeJsonAtomic, nowIso } from "./io.mjs";
import { appendEvent } from "./events.mjs";
import { currentSlice } from "./state.mjs";
import { globToRegExp } from "./glob.mjs";

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py|rb)$|(^|\/)tests?\//;

// Node's test runner exports NODE_TEST_CONTEXT and NODE_TEST_WORKER_ID to its children; a `node --test`
// spawned under them takes itself for a worker and exits 0 without running a test. Project checks and
// the discriminating-tests check run with those variables removed, so a test command tells the truth
// wherever preflight itself was started from.
function childEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("NODE_TEST_")) delete env[k];
  return env;
}

// The slice's changed tests, run against the tree as it was before the slice, must fail. A test
// that passes without the change does not cover it; a report-ranking test once passed with its fix
// reverted because directory order happened to agree. The old tree is a detached worktree at the
// slice's start commit with the changed test files copied in and the project's node_modules linked.
function testsDiscriminate(cwd, files, state, profile) {
  const cfg = profile.review ?? {};
  if (cfg.discriminatingTests === false) return { status: "skip", details: "disabled in the profile (review.discriminatingTests)" };
  const testFiles = files.filter((f) => TEST_FILE.test(f));
  const sourceFiles = files.filter((f) => !TEST_FILE.test(f));
  if (!testFiles.length) return { status: "skip", details: "no test files changed" };
  if (!sourceFiles.length) return { status: "skip", details: "only tests changed; nothing for them to discriminate" };
  const checkId = cfg.testCheck ?? "test";
  const check = (profile.checks ?? []).find((c) => c.id === checkId);
  if (!check) return { status: "skip", details: `no project check with id ${checkId} to run the tests with` };
  const base = state?.slice?.startHead ?? headSha(cwd);
  if (!base) return { status: "skip", details: "no commit to compare against" };
  const dir = mkdtempSync(join(tmpdir(), "hh-discriminate-"));
  try {
    const wt = git(cwd, ["worktree", "add", "--detach", "-q", dir, base]);
    if (wt.code !== 0) return { status: "skip", details: `could not create a worktree at ${base.slice(0, 7)}: ${wt.err.slice(-200)}` };
    for (const f of testFiles) {
      const src = join(cwd, f);
      if (!existsSync(src)) continue;
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      copyFileSync(src, join(dir, f));
    }
    const mods = join(cwd, "node_modules");
    if (existsSync(mods) && !existsSync(join(dir, "node_modules"))) symlinkSync(mods, join(dir, "node_modules"), "dir");
    const r = spawnSync("sh", ["-c", check.command], { cwd: dir, encoding: "utf8", env: childEnv(), timeout: (check.timeoutSec ?? 300) * 1000 });
    if (r.error || r.signal) return { status: "skip", details: `the test command did not finish on the old tree (${r.error?.code ?? r.signal})` };
    if (r.status === 0) return { status: "fail", details: `the changed tests pass without the slice's source changes (${testFiles.join(", ")}); a test that cannot fail does not cover the change. Write a test that fails on the old code first.` };
    const tail = ((r.stdout || "") + (r.stderr || "")).trim().split("\n").filter(Boolean).slice(-2).join(" | ");
    return { status: "pass", details: `${testFiles.length} changed test file(s) fail without the change: ${tail.slice(-240)}` };
  } finally {
    git(cwd, ["worktree", "remove", "--force", dir]);
    rmSync(dir, { recursive: true, force: true });
  }
}

function timed(id, fn) {
  const t0 = Date.now();
  try {
    const r = fn();
    return { id, durationMs: Date.now() - t0, ...r };
  } catch (err) {
    return { id, status: "fail", details: `check crashed: ${err.message}`, durationMs: Date.now() - t0 };
  }
}

export function runPreflight(cwd, state, profile, { extraChecks = [] } = {}) {
  const t0 = Date.now();
  const files = changedFiles(cwd).filter((f) => !f.startsWith(".harness/"));
  const slice = currentSlice(state);
  const checks = [];

  checks.push(timed("branch", () => {
    const b = currentBranch(cwd);
    if (profile.git.noWorkOnDefaultBranch && b === state.defaultBranch) return { status: "fail", details: `on default branch ${b}; goal work belongs on ${state.branch}` };
    if (b !== state.branch) return { status: "fail", details: `on ${b}, expected ${state.branch}` };
    return { status: "pass", details: b };
  }));

  checks.push(timed("diff_budget", () => {
    const s = diffStat(cwd);
    const total = s.added + s.deleted;
    const cap = profile.budgets.diffLinesPerSlice;
    return total > cap ? { status: "fail", details: `${total} lines changed, cap ${cap}` } : { status: "pass", details: `${total} lines in ${files.length} files` };
  }));

  checks.push(timed("protected_paths", () => {
    const protectedRes = profile.lanes.protectedPaths.map(globToRegExp);
    const hits = files.filter((f) => protectedRes.some((re) => re.test(f)));
    return hits.length ? { status: "fail", details: `protected paths touched: ${hits.join(", ")}` } : { status: "pass", details: "none touched" };
  }));

  checks.push(timed("slice_paths", () => {
    if (!slice || !slice.paths.length) return { status: "skip", details: "slice declares no paths" };
    const allowed = slice.paths.map(globToRegExp);
    const outside = files.filter((f) => !allowed.some((re) => re.test(f)));
    return outside.length ? { status: "fail", details: `files outside slice paths: ${outside.join(", ")}. If the plan missed them, a human widens the slice: harness slice amend --id ${slice.id} --paths <glob>... --add` } : { status: "pass", details: `${files.length} files within declared paths` };
  }));

  checks.push(timed("openspec_validate", () => {
    if (!profile.openspec.validate || !existsSync(join(cwd, "openspec"))) return { status: "skip", details: "no openspec/ directory" };
    const bin = [join(cwd, "node_modules", ".bin", "openspec"), join(pluginRoot(), "node_modules", ".bin", "openspec")].find(existsSync);
    if (!bin) return { status: "skip", details: "openspec binary not installed (npm install in the plugin or project)" };
    const r = spawnSync(bin, ["validate", "--all", "--no-interactive"], { cwd, encoding: "utf8", timeout: 60000 });
    return r.status === 0 ? { status: "pass", details: (r.stdout || "").trim().split("\n").pop() } : { status: "fail", details: ((r.stdout || "") + (r.stderr || "")).trim().slice(-800) };
  }));

  checks.push(timed("tests_discriminate", () => testsDiscriminate(cwd, files, state, profile)));

  for (const c of profile.checks ?? []) {
    checks.push(timed(`project:${c.id}`, () => {
      const r = spawnSync("sh", ["-c", c.command], { cwd, encoding: "utf8", env: childEnv(), timeout: (c.timeoutSec ?? 300) * 1000 });
      const tail = ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-15).join("\n");
      return r.status === 0 ? { status: "pass", details: tail.split("\n").pop() ?? "" } : { status: "fail", details: tail.slice(-1500) };
    }));
  }

  for (const extra of extraChecks) checks.push(timed(extra.id, () => extra.run(cwd, files, state, profile)));

  const passed = checks.every((c) => c.status !== "fail");
  // A slice that touches a path in review.guardPaths changes what the harness allows or denies. It is
  // guard-bearing: the adversarial review brief, the strong reviewer from round one, and verdicts
  // whose claims rest on probes follow from this flag.
  const guardRes = (profile.review?.guardPaths ?? []).map(globToRegExp);
  const guardFiles = files.filter((f) => guardRes.some((re) => re.test(f)));
  const result = { diffHash: workHash(cwd), passed, at: nowIso(), durationMs: Date.now() - t0, checks, guardBearing: guardFiles.length > 0, guardFiles };
  writeJsonAtomic(harnessPaths(cwd).preflight, result);
  state.preflight = result;
  appendEvent(cwd, { type: "preflight", slice: slice?.id ?? null, passed, failed: checks.filter((c) => c.status === "fail").map((c) => c.id), durationMs: result.durationMs, guardBearing: result.guardBearing });
  return result;
}
