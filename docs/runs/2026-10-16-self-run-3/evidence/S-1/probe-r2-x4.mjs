// Follow-up to probe-r2.mjs: the unquoted-delimiter xargs shape (X4) in building and done, and in real shells.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "..", "..");
const HEAD = join(here, "head");
const wt = await import(join(ROOT, "scripts/lib/guards/git-guard.mjs"));
const hd = await import(join(HEAD, "scripts/lib/guards/git-guard.mjs"));
const wtP = (await import(join(ROOT, "scripts/lib/profile.mjs"))).loadProfile(mkdtempSync(join(tmpdir(), "x4-")), ROOT);
const hdP = (await import(join(HEAD, "scripts/lib/profile.mjs"))).loadProfile(mkdtempSync(join(tmpdir(), "x4-")), HEAD);
const repo = mkdtempSync(join(tmpdir(), "x4-repo-"));
spawnSync("git", ["init", "-q", "-b", "goal/G-3"], { cwd: repo });
const fmt = (r) => (r.deny ? `DENY(${r.guard})` : "allow");
const L = (...l) => l.join("\n");
const F = "--" + "force";
const cases = {
  "X4a main": L("xargs git push origin goal/G-3 <<EOF", "main", "EOF"),
  "X4b force": L("xargs git push origin goal/G-3 <<EOF", F, "EOF"),
  "X4c HEAD:main": L("xargs git push origin goal/G-3 <<EOF", "HEAD:main", "EOF"),
  "X4d bare-remote": L("xargs git push origin <<EOF", "main", "EOF"),
};
for (const stage of ["building", "done"]) {
  const state = { branch: "goal/G-3", defaultBranch: "main", stage };
  for (const [n, c] of Object.entries(cases)) {
    const h = hd.checkBashCommand(c, { profile: hdP, state, cwd: repo }), w = wt.checkBashCommand(c, { profile: wtP, state, cwd: repo });
    console.log(`${stage} ${n}: HEAD ${fmt(h)} | worktree ${fmt(w)}${h.deny && !w.deny ? "  <-- REGRESSION" : ""}`);
  }
}
const sb = join(here, "sandbox-r2");
for (const shell of ["/bin/bash", "/bin/zsh"]) for (const [n, c] of Object.entries(cases)) {
  const f = join(sb, `${n.split(" ")[0]}.sh`); writeFileSync(f, c);
  const r = spawnSync(shell, [f], { cwd: sb, env: { ...process.env, PATH: `${join(sb, "bin")}:${process.env.PATH}` } });
  console.log(`real ${shell} ${n}: stdout=${JSON.stringify(r.stdout.toString().trim())}`);
}
