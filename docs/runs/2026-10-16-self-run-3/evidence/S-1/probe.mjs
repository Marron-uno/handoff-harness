// Probe for S-1 attempt 4: HEAD copy versus working tree of checkBashCommand, plus real-shell
// confirmation (bash and zsh, echo stand-ins and a git stub function) of the shapes that pass.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
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

const empty = mkdtempSync(join(tmpdir(), "hh-probe-"));
const repo = mkdtempSync(join(tmpdir(), "hh-probe-repo-"));
spawnSync("git", ["init", "-q", "-b", "goal/G-3"], { cwd: repo });
const wtProfile = wtLoad(empty, ROOT);
const hdProfile = hdLoad(empty, HEAD);
const building = { branch: "goal/G-3", defaultBranch: "main", stage: "building" };
const done = { branch: "goal/G-3", defaultBranch: "main", stage: "done" };

const fmt = (r) => (r.deny ? `DENY(${r.guard})` : "allow");
const L = (...l) => l.join("\n");

const cases = [
  // Heredoc stripping: intended allows and fail-safe controls.
  ["A0 control: cat heredoc of prose (intended allow)", L("cat > notes.md <<'EOF'", "Never run git push --force origin main.", "EOF")],
  ["A1 unquoted delim, body line 'E\\' then 'OF' (bash joins to EOF), reset after", L("cat > notes.md <<EOF", "E\\", "OF", "git reset --hard", "EOF")],
  ["A2 same with <<- and tab-led lines", L("cat > notes.md <<-EOF", "\tE\\", "OF", "git reset --hard", "\tEOF")],
  ["A3 same, force push to main after the joined terminator", L("cat > notes.md <<EOF", "E\\", "OF", "git push --force origin main", "EOF")],
  ["A4 same, sensitive read after the joined terminator", L("cat > notes.md <<EOF", "E\\", "OF", "cat config/secrets.json", "EOF")],
  ["A5 control: quoted delim with the same body (bash does not join)", L("cat > notes.md <<'EOF'", "E\\", "OF", "git reset --hard", "EOF")],
  ["A6 upper-case CAT (zsh/bash on darwin: command lookup is case-sensitive)", L("CAT > notes.md <<'EOF'", "git reset --hard", "EOF")],
  ["A7 tee to /dev/stdout only", L("tee /dev/stdout <<'EOF'", "git reset --hard", "EOF")],
  ["A8 cat to a parent-directory path", L("cat > ../../../x.md <<'EOF'", "git reset --hard", "EOF")],
  ["A9 cat writes a git hook (run later by git commit)", L("mkdir -p .git/hooks && cat > .git/hooks/pre-commit <<'EOF'", "git push --force origin main", "EOF")],
  ["A10 cd - prefix", L("cd - && cat > notes.md <<'EOF'", "git reset --hard", "EOF")],
  ["A11 fd copy after redirect, cat > notes.md >&3", L("cat > notes.md >&3 <<'EOF'", "git reset --hard", "EOF")],
  // Push rule and push deny pattern.
  ["B1 push goal branch, $( on line 1, main on line 2", L("git push origin goal/G-3 $(", "echo main", ")")],
  ["B2 push goal branch, $( on line 1, --force on line 2", L("git push origin goal/G-3 $(", "echo --force", ")")],
  ["B3 push goal branch, backtick on line 1, main on line 2", L("git push origin goal/G-3 `", "echo main", "`")],
  ["B4 push goal branch, $(cat heredoc) with main in the body", L("git push origin goal/G-3 \"$(cat <<'EOF'", "main", "EOF", ")\"")],
  ["B5 push goal branch, open quote in an option, main on line 2", L("git push origin goal/G-3 --push-option='a", "b' main")],
  ["B6 control: one-line push to main with global options", "git -C . --no-pager push origin main"],
  ["B7 control: push then prose line (intended allow)", L("git push origin goal/G-3", "then main is next")],
  ["B8 control: backslash-CRLF continuation to main", "git push origin goal/G-3 \\\r\nmain"],
  ["B9 pre-existing: one-line quoted main", "git push origin goal/G-3 'main'"],
  ["B10 pre-existing: one-line $(echo main)", "git push origin goal/G-3 $(echo main)"],
];

console.log("# Guard: HEAD vs working tree (state building, branch goal/G-3)");
for (const [name, cmd] of cases) {
  const h = hd.checkBashCommand(cmd, { profile: hdProfile, state: building, cwd: repo });
  const w = wt.checkBashCommand(cmd, { profile: wtProfile, state: building, cwd: repo });
  const flag = h.deny && !w.deny ? "  <-- REGRESSION (HEAD denies, worktree allows)" : "";
  console.log(`${name}: HEAD ${fmt(h)} | worktree ${fmt(w)}${flag}`);
}
console.log("\n# Dormant (stage done) on the multi-line push shapes");
for (const [name, cmd] of cases.filter(([n]) => /^B[1-5] /.test(n))) {
  const h = hd.checkBashCommand(cmd, { profile: hdProfile, state: done, cwd: repo });
  const w = wt.checkBashCommand(cmd, { profile: wtProfile, state: done, cwd: repo });
  console.log(`${name}: HEAD ${fmt(h)} | worktree ${fmt(w)}`);
}
console.log("\n# dropFileHeredocs output for A1");
console.log(JSON.stringify(wt.dropFileHeredocs(cases[1][1])));

console.log("\n# Write tool to .git/hooks/pre-commit (content never judged, pre-existing path)");
console.log(fmt(checkFileAccess({ tool: "Write", filePath: join(repo, ".git/hooks/pre-commit"), cwd: repo, profile: wtProfile, state: building, agentType: undefined, pluginRoot: ROOT })));

// Real shells. Destructive lines are replaced by echo markers; git is a stub function printing its args.
const sandbox = join(here, "sandbox");
mkdirSync(sandbox, { recursive: true });
const real = {
  "A1-shape": L("cat > notes.md <<EOF", "E\\", "OF", "echo RAN-AFTER-JOINED-TERMINATOR", "EOF"),
  "A2-shape": L("cat > notes2.md <<-EOF", "\tE\\", "OF", "echo RAN-AFTER-JOINED-TERMINATOR-DASH", "\tEOF"),
  "A5-shape": L("cat > notes3.md <<'EOF'", "E\\", "OF", "echo RAN-QUOTED-CONTROL", "EOF"),
  "B1-shape": L("git() { printf 'git-arg[%s]\\n' \"$@\"; }", "git push origin goal/G-3 $(", "echo main", ")"),
  "B4-shape": L("git() { printf 'git-arg[%s]\\n' \"$@\"; }", "git push origin goal/G-3 \"$(cat <<'EOF'", "main", "EOF", ")\""),
  "B5-shape": L("git() { printf 'git-arg[%s]\\n' \"$@\"; }", "git push origin goal/G-3 --push-option='a", "b' main"),
};
for (const shell of ["bash", "zsh"]) {
  console.log(`\n# Real ${shell} (${spawnSync(shell, ["--version"], { encoding: "utf8" }).stdout.split("\n")[0]})`);
  for (const [name, script] of Object.entries(real)) {
    const f = join(sandbox, `${name}.sh`);
    writeFileSync(f, script + "\n");
    const r = spawnSync(shell, [f], { cwd: sandbox, encoding: "utf8" });
    console.log(`${name}: stdout=${JSON.stringify(r.stdout.trim())} stderr=${JSON.stringify(r.stderr.trim().slice(0, 120))}`);
  }
}
