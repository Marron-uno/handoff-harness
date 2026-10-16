// Facts about the machine a run is judged on, written into the judge's packet. Judges reason about
// paths and commands; whether two spellings of a name open the same file is the fact an
// independent reviewer once had to discover by probing, after a case-flipped path had escaped a lane.
import { writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { platform, release, arch } from "node:os";
import { spawnSync } from "node:child_process";
import { harnessPaths } from "./paths.mjs";

// True when a differently capitalized name opens the file just written; null when the probe fails.
export function caseInsensitiveFs(dir) {
  const lower = join(dir, `.case-probe-${process.pid}`);
  const upper = join(dir, `.CASE-PROBE-${process.pid}`);
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(lower, "");
    return existsSync(upper);
  } catch { return null; }
  finally { rmSync(lower, { force: true }); }
}

export function environmentFacts(cwd) {
  const g = spawnSync("git", ["--version"], { encoding: "utf8" });
  return {
    os: `${platform()} ${release()} ${arch()}`,
    node: process.version,
    git: g.status === 0 ? g.stdout.trim().replace(/^git version /, "") : "unknown",
    caseInsensitiveFs: caseInsensitiveFs(harnessPaths(cwd).dir),
  };
}

export function renderEnvironment(facts) {
  const fs = facts.caseInsensitiveFs === null ? "case sensitivity unknown" : facts.caseInsensitiveFs ? "case-insensitive: two spellings of a path open the same file" : "case-sensitive";
  return [`- OS: ${facts.os}`, `- Node: ${facts.node}`, `- git: ${facts.git}`, `- Filesystem: ${fs}`];
}
