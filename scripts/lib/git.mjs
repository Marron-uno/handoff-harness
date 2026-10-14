import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export function git(cwd, args, opts = {}) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.error) throw r.error;
  return { code: r.status ?? 1, out: (r.stdout || "").trimEnd(), err: (r.stderr || "").trimEnd() };
}

export function isRepo(cwd) {
  return git(cwd, ["rev-parse", "--is-inside-work-tree"]).code === 0;
}

export function currentBranch(cwd) {
  const r = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return r.code === 0 ? r.out : null;
}

export function defaultBranch(cwd) {
  const r = git(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (r.code === 0) return r.out.replace("refs/remotes/origin/", "");
  for (const name of ["main", "master"]) {
    if (git(cwd, ["show-ref", "--verify", "--quiet", `refs/heads/${name}`]).code === 0) return name;
  }
  return "main";
}

export function headSha(cwd) {
  const r = git(cwd, ["rev-parse", "HEAD"]);
  return r.code === 0 ? r.out : null;
}

export function hasCommits(cwd) {
  return headSha(cwd) !== null;
}

export function untrackedFiles(cwd, { includeHarness = false } = {}) {
  const r = git(cwd, ["ls-files", "--others", "--exclude-standard"]);
  const files = r.code === 0 && r.out ? r.out.split("\n") : [];
  return includeHarness ? files : files.filter((f) => !f.startsWith(".harness/"));
}

export function changedFiles(cwd) {
  const tracked = hasCommits(cwd) ? git(cwd, ["diff", "--name-only", "HEAD"]).out : git(cwd, ["diff", "--name-only", "--cached"]).out;
  const set = new Set([...(tracked ? tracked.split("\n") : []), ...untrackedFiles(cwd)]);
  return [...set].filter(Boolean).sort();
}

export function stagedFiles(cwd) {
  const r = git(cwd, ["diff", "--name-only", "--cached"]);
  return r.out ? r.out.split("\n") : [];
}

export function isClean(cwd) {
  return git(cwd, ["status", "--porcelain"]).out === "";
}

// The harness's own folder never counts as work: diffs, hashes and untracked lists exclude it.
const EXCLUDE_HARNESS = ["--", ".", ":(exclude).harness"];

export function diffText(cwd) {
  if (!hasCommits(cwd)) return git(cwd, ["diff", "--cached", ...EXCLUDE_HARNESS]).out;
  return git(cwd, ["diff", "HEAD", ...EXCLUDE_HARNESS]).out;
}

// Hash of the committed tree minus .harness/, so a commit that only records harness artifacts
// does not change it.
export function treeHash(cwd) {
  const r = git(cwd, ["ls-tree", "-r", "HEAD"]);
  if (r.code !== 0) return "no-head";
  const lines = r.out.split("\n").filter((l) => l && !/\t\.harness\//.test(l));
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}

export function diffStat(cwd) {
  const r = hasCommits(cwd) ? git(cwd, ["diff", "--numstat", "HEAD"]) : git(cwd, ["diff", "--numstat", "--cached"]);
  let added = 0, deleted = 0;
  const files = [];
  for (const line of r.out.split("\n").filter(Boolean)) {
    const [a, d, file] = line.split("\t");
    const ai = a === "-" ? 0 : Number(a), di = d === "-" ? 0 : Number(d);
    added += ai; deleted += di;
    files.push({ file, added: ai, deleted: di });
  }
  for (const file of untrackedFiles(cwd)) {
    const p = join(cwd, file);
    if (!existsSync(p) || !statSync(p).isFile()) continue;
    const lines = readFileSync(p, "utf8").split("\n").length;
    added += lines;
    files.push({ file, added: lines, deleted: 0, untracked: true });
  }
  return { added, deleted, files };
}

// Hash of the working tree delta against HEAD, including untracked file contents.
// Two states with the same hash have the same pending change set.
export function diffHash(cwd) {
  const h = createHash("sha256");
  h.update(diffText(cwd));
  for (const file of untrackedFiles(cwd)) {
    const p = join(cwd, file);
    if (!existsSync(p) || !statSync(p).isFile()) continue;
    h.update(`\n--untracked:${file}\n`);
    h.update(readFileSync(p));
  }
  return h.digest("hex").slice(0, 16);
}

export function lastCommitSubject(cwd) {
  const r = git(cwd, ["log", "-1", "--pretty=%s"]);
  return r.code === 0 ? r.out : "";
}

export function aheadBehind(cwd) {
  const r = git(cwd, ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]);
  if (r.code !== 0) return { ahead: null, behind: null, upstream: false };
  const [behind, ahead] = r.out.split(/\s+/).map(Number);
  return { ahead, behind, upstream: true };
}

export function sha256(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

// Hash of HEAD plus the pending delta. Unlike diffHash, it changes when a commit lands,
// so it is the freshness key for verdicts, preflight and reconcile results.
export function workHash(cwd) {
  const h = createHash("sha256");
  h.update(treeHash(cwd));
  h.update("\n");
  h.update(diffHash(cwd));
  return h.digest("hex").slice(0, 16);
}
