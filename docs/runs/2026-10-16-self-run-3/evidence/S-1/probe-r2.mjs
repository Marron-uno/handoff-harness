// Escalated review probe, S-1 attempt 4 round 2 (diffHash eec460a2f46b9025).
// HEAD copy (.harness/evidence/S-1/head, verified identical to `git show HEAD:`) versus the working
// tree of checkBashCommand, then real bash 3.2 and zsh 5.9 runs of the shapes the worktree allows,
// with destructive lines replaced by echo markers and git replaced by a stub on PATH.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync, chmodSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "..", "..");
const HEAD = join(here, "head");
const wt = await import(join(ROOT, "scripts/lib/guards/git-guard.mjs"));
const hd = await import(join(HEAD, "scripts/lib/guards/git-guard.mjs"));
const { loadProfile: wtLoad } = await import(join(ROOT, "scripts/lib/profile.mjs"));
const { loadProfile: hdLoad } = await import(join(HEAD, "scripts/lib/profile.mjs"));
const { checkFileAccess } = await import(join(ROOT, "scripts/lib/guards/path-guard.mjs"));

const empty = mkdtempSync(join(tmpdir(), "hh-r2-"));
const repo = mkdtempSync(join(tmpdir(), "hh-r2-repo-"));
spawnSync("git", ["init", "-q", "-b", "goal/G-3"], { cwd: repo });
const wtP = wtLoad(empty, ROOT);
const hdP = hdLoad(empty, HEAD);
const building = { branch: "goal/G-3", defaultBranch: "main", stage: "building" };
const done = { branch: "goal/G-3", defaultBranch: "main", stage: "done" };
const fmt = (r) => (r.deny ? `DENY(${r.guard})` : "allow");
const L = (...l) => l.join("\n");

const cases = [
  // --- R: earlier blocks (a4-r1 reviewer F-1, F-2) re-run: must now be denied.
  ["R1 a4r1-F1: unquoted delim, 'E\\' 'OF' join, reset after", L("cat > n.md <<EOF", "E\\", "OF", "git reset --hard", "EOF")],
  ["R2 a4r1-F2: push goal $( / echo main / )", L("git push origin goal/G-3 $(", "echo main", ")")],
  ["R3 a4r1-F2: push goal ` / echo --force / `", L("git push origin goal/G-3 `", "echo --force", "`")],
  ["R4 a3-F1: cat > >(bash)", L("cat > >(bash) <<'EOF'", "git reset --hard", "EOF")],
  ["R5 a3-F3: write then bash < file", L("cat > run.sh <<'EOF'", "git reset --hard", "EOF", "bash < run.sh")],
  // --- C: CR handling. The guard strips a trailing \r before comparing a terminator; bash and zsh do not.
  ["C1 terminator 'EOF\\r' ends heredoc 1 for the guard only; reset runs after the real EOF", L("cat > a.md <<'EOF'", "x", "EOF\r", "cat > b.md <<'X'", "EOF", "git reset --hard", "X")],
  ["C2 same, force push to main", L("cat > a.md <<'EOF'", "x", "EOF\r", "cat > b.md <<'X'", "EOF", "git push --force origin main", "X")],
  ["C3 same, secrets read", L("cat > a.md <<'EOF'", "x", "EOF\r", "cat > b.md <<'X'", "EOF", "cat config/secrets.json", "X")],
  ["C4 same, rm -rf /", L("cat > a.md <<'EOF'", "x", "EOF\r", "cat > b.md <<'X'", "EOF", "rm -rf /", "X")],
  ["C5 \\r on the heredoc line (bash delimiter is EOF\\r), plain EOF is body for bash", L("cat > a.md <<'EOF'\r", "EOF", "cat > b.md <<'X'", "EOF\r", "git reset --hard", "X")],
  ["C6 tee variant of C1", L("tee a.md <<'EOF'", "x", "EOF\r", "tee b.md <<'X'", "EOF", "git reset --hard", "X")],
  ["C7 control: all-CRLF prose heredoc (test line 225, intended allow)", L("cat > n.md <<'EOF'\r", "Never run git push --force origin main.\r", "EOF\r")],
  // --- X: a heredoc that feeds the push its arguments through xargs. The push line has none of
  //     joinOpenPush's open characters, so the push rule stops at the newline.
  ["X1 xargs push goal branch, heredoc supplies main", L("xargs git push origin goal/G-3 <<'EOF'", "main", "EOF")],
  ["X2 xargs push goal branch, heredoc supplies --force", L("xargs git push origin goal/G-3 <<'EOF'", "--force", "EOF")],
  ["X3 xargs push goal branch, heredoc supplies a refspec HEAD:main", L("xargs git push origin goal/G-3 <<'EOF'", "HEAD:main", "EOF")],
  ["X4 xargs push, unquoted delimiter", L("xargs git push origin goal/G-3 <<EOF", "main", "EOF")],
  ["X5 git global options before push", L("xargs git -C . --no-pager push origin goal/G-3 <<'EOF'", "main", "EOF")],
  // --- P: path and spelling variants of the heredoc allow path (write targets).
  ["P1 write target with parent segments outside project", L("cat > ../../../../tmp/n.md <<'EOF'", "git reset --hard", "EOF")],
  ["P2 write target git hook (runs at the next commit)", L("mkdir -p .git/hooks && cat > .git/hooks/pre-commit <<'EOF'", "git push --force origin main", "EOF")],
  ["P3 write target shell startup file", L("cat >> ~/.zshrc <<'EOF'", "git reset --hard", "EOF")],
  ["P4 upper-case CAT (not cat; must stay scanned)", L("CAT > n.md <<'EOF'", "git reset --hard", "EOF")],
  ["P5 state file, upper-case spelling (case-insensitive FS)", L("cat > .HARNESS/state.json <<'EOF'", "{}", "EOF")],
  ["P6 state file, doubled slash", L("cat > .harness//state.json <<'EOF'", "{}", "EOF")],
  ["P7 sensitive target, upper-case .ENV", L("cat > .ENV <<'EOF'", "x", "EOF")],
  ["P8 tee -a with fd copy then cat redirect 0<&3", L("tee -a n.md <<'EOF' 0<&3", "git reset --hard", "EOF")],
  // --- G: push rule spellings (global options, HEAD, bulk/short flags), single line.
  ["G1 git -P push --force (pager short flag not in GLOBAL_OPTIONS)", "git -P push --force origin goal/G-3"],
  ["G2 git --bare push origin main", "git --bare push origin main"],
  ["G3 combined short flags -fu", "git push -fu origin goal/G-3"],
  ["G4 alias via -c", "git -c alias.p=push p origin main"],
  ["G5 push HEAD:main", "git push origin HEAD:main"],
  ["G6 push --all", "git push --all origin"],
  ["G7 control: push then prose line (intended allow)", L("git push origin goal/G-3", "then main is next")],
  ["G8 control: two pushes, second to main", L("git push origin goal/G-3", "git push origin main")],
];

console.log("# Guard: HEAD vs working tree (stage building, branch goal/G-3)");
for (const [name, cmd] of cases) {
  const h = hd.checkBashCommand(cmd, { profile: hdP, state: building, cwd: repo });
  const w = wt.checkBashCommand(cmd, { profile: wtP, state: building, cwd: repo });
  const flag = h.deny && !w.deny ? "  <-- REGRESSION (HEAD denies, worktree allows)" : !h.deny && !w.deny && !/control/.test(name) ? "  (both allow)" : "";
  console.log(`${name}: HEAD ${fmt(h)} | worktree ${fmt(w)}${flag}`);
}
console.log("\n# Dormant (stage done)");
for (const [name, cmd] of cases.filter(([n]) => /^(X1|X3|C2|G2)/.test(n)).concat([["D1 dormant delete main :main", "git push origin :main"]])) {
  const h = hd.checkBashCommand(cmd, { profile: hdP, state: done, cwd: repo });
  const w = wt.checkBashCommand(cmd, { profile: wtP, state: done, cwd: repo });
  console.log(`${name}: HEAD ${fmt(h)} | worktree ${fmt(w)}${h.deny && !w.deny ? "  <-- REGRESSION" : ""}`);
}

console.log("\n# What the guard judges after dropFileHeredocs (C1, C5)");
console.log("C1:", JSON.stringify(wt.dropFileHeredocs(cases.find(([n]) => n.startsWith("C1"))[1])));
console.log("C5:", JSON.stringify(wt.dropFileHeredocs(cases.find(([n]) => n.startsWith("C5"))[1])));
console.log("X1 joinOpenPush:", JSON.stringify(wt.joinOpenPush(cases.find(([n]) => n.startsWith("X1"))[1])));

console.log("\n# Write tool to .git/hooks/pre-commit and ~/.zshrc (path guard, content never judged)");
console.log("hook:", fmt(checkFileAccess({ tool: "Write", filePath: join(repo, ".git/hooks/pre-commit"), cwd: repo, profile: wtP, state: building, agentType: undefined, pluginRoot: ROOT })));

// Real shells. Destructive lines become echo markers; git is a stub that prints its argv.
const sb = join(here, "sandbox-r2");
rmSync(sb, { recursive: true, force: true });
mkdirSync(join(sb, "bin"), { recursive: true });
writeFileSync(join(sb, "bin", "git"), "#!/bin/sh\nfor a in \"$@\"; do printf 'git-arg[%s] ' \"$a\"; done; echo\n");
chmodSync(join(sb, "bin", "git"), 0o755);
const real = {
  "C1-shape": L("cat > a.md <<'EOF'", "x", "EOF\r", "cat > b.md <<'X'", "EOF", "echo RAN-AFTER-CR-TERMINATOR", "X"),
  "C2-shape (git stub)": L("cat > a.md <<'EOF'", "x", "EOF\r", "cat > b.md <<'X'", "EOF", "git push --force origin main", "X"),
  "C5-shape": L("cat > a.md <<'EOF'\r", "EOF", "cat > b.md <<'X'", "EOF\r", "echo RAN-AFTER-CR-DELIMITER", "X"),
  "C6-shape (tee)": L("tee a.md <<'EOF' >/dev/null", "x", "EOF\r", "tee b.md <<'X' >/dev/null", "EOF", "echo RAN-AFTER-CR-TERMINATOR-TEE", "X"),
  "X1-shape (git stub)": L("xargs git push origin goal/G-3 <<'EOF'", "main", "EOF"),
  "X2-shape (git stub)": L("xargs git push origin goal/G-3 <<'EOF'", "--force", "EOF"),
  "X3-shape (git stub)": L("xargs git push origin goal/G-3 <<'EOF'", "HEAD:main", "EOF"),
};
for (const shell of ["/bin/bash", "/bin/zsh"]) {
  console.log(`\n# Real ${shell} (${spawnSync(shell, ["-c", "echo ${BASH_VERSION:-$ZSH_VERSION}"]).stdout.toString().trim()})`);
  for (const [name, script] of Object.entries(real)) {
    const f = join(sb, `${name.split(" ")[0]}.sh`);
    writeFileSync(f, script);
    const r = spawnSync(shell, [f], { cwd: sb, env: { ...process.env, PATH: `${join(sb, "bin")}:${process.env.PATH}` } });
    console.log(`${name}: stdout=${JSON.stringify(r.stdout.toString().trim())} stderr=${JSON.stringify(r.stderr.toString().trim().slice(0, 120))}`);
  }
}
