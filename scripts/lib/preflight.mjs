// Deterministic checks that run before any model judges the slice. Each check returns
// { id, status: pass|fail|skip, details, durationMs }. The list is extended by the guards.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { changedFiles, diffStat, workHash, currentBranch } from "./git.mjs";
import { harnessPaths, pluginRoot } from "./paths.mjs";
import { writeJsonAtomic, nowIso } from "./io.mjs";
import { appendEvent } from "./events.mjs";
import { currentSlice } from "./state.mjs";
import { globToRegExp } from "./glob.mjs";

function timed(id, fn) {
  const t0 = Date.now();
  try {
    const r = fn();
    return { id, durationMs: Date.now() - t0, ...r };
  } catch (err) {
    return { id, status: "fail", details: `check crashed: ${err.message}`, durationMs: Date.now() - t0 };
  }
}

// Each file named in budgets.bundleBytes must be at or under its byte cap. Missing files are skipped.
export function bundleSizeCheck(cwd, profile) {
  const caps = Object.entries(profile.budgets?.bundleBytes ?? {});
  if (!caps.length) return { status: "skip", details: "no budgets.bundleBytes set" };
  const over = [];
  const missing = [];
  let checked = 0;
  for (const [file, cap] of caps) {
    const path = join(cwd, file);
    if (!existsSync(path)) { missing.push(file); continue; }
    checked++;
    const size = statSync(path).size;
    if (size > cap) over.push(`${file} is ${size} bytes, cap ${cap}`);
  }
  const note = missing.length ? `; missing, skipped: ${missing.join(", ")}` : "";
  if (over.length) return { status: "fail", details: over.join("; ") + note };
  if (!checked) return { status: "skip", details: `no named file exists${note}` };
  return { status: "pass", details: `${checked} file(s) within cap${note}` };
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

  checks.push(timed("bundle_size", () => bundleSizeCheck(cwd, profile)));

  checks.push(timed("protected_paths", () => {
    const protectedRes = profile.lanes.protectedPaths.map(globToRegExp);
    const hits = files.filter((f) => protectedRes.some((re) => re.test(f)));
    return hits.length ? { status: "fail", details: `protected paths touched: ${hits.join(", ")}` } : { status: "pass", details: "none touched" };
  }));

  checks.push(timed("slice_paths", () => {
    if (!slice || !slice.paths.length) return { status: "skip", details: "slice declares no paths" };
    const allowed = slice.paths.map(globToRegExp);
    const outside = files.filter((f) => !allowed.some((re) => re.test(f)));
    return outside.length ? { status: "fail", details: `files outside slice paths: ${outside.join(", ")}` } : { status: "pass", details: `${files.length} files within declared paths` };
  }));

  checks.push(timed("openspec_validate", () => {
    if (!profile.openspec.validate || !existsSync(join(cwd, "openspec"))) return { status: "skip", details: "no openspec/ directory" };
    const bin = [join(cwd, "node_modules", ".bin", "openspec"), join(pluginRoot(), "node_modules", ".bin", "openspec")].find(existsSync);
    if (!bin) return { status: "skip", details: "openspec binary not installed (npm install in the plugin or project)" };
    const r = spawnSync(bin, ["validate", "--all", "--no-interactive"], { cwd, encoding: "utf8", timeout: 60000 });
    return r.status === 0 ? { status: "pass", details: (r.stdout || "").trim().split("\n").pop() } : { status: "fail", details: ((r.stdout || "") + (r.stderr || "")).trim().slice(-800) };
  }));

  for (const c of profile.checks ?? []) {
    checks.push(timed(`project:${c.id}`, () => {
      const r = spawnSync("sh", ["-c", c.command], { cwd, encoding: "utf8", timeout: (c.timeoutSec ?? 300) * 1000 });
      const tail = ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-15).join("\n");
      return r.status === 0 ? { status: "pass", details: tail.split("\n").pop() ?? "" } : { status: "fail", details: tail.slice(-1500) };
    }));
  }

  for (const extra of extraChecks) checks.push(timed(extra.id, () => extra.run(cwd, files, state, profile)));

  const passed = checks.every((c) => c.status !== "fail");
  const result = { diffHash: workHash(cwd), passed, at: nowIso(), durationMs: Date.now() - t0, checks };
  writeJsonAtomic(harnessPaths(cwd).preflight, result);
  state.preflight = result;
  appendEvent(cwd, { type: "preflight", slice: slice?.id ?? null, passed, failed: checks.filter((c) => c.status === "fail").map((c) => c.id), durationMs: result.durationMs });
  return result;
}
