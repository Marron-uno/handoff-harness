import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpDir, initRepo, PLUGIN_ROOT, sh } from "./helpers.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";
import { checkBashCommand } from "../scripts/lib/guards/git-guard.mjs";

const profile = loadProfile(tmpDir(), PLUGIN_ROOT);
const state = { branch: "goal/G-3", defaultBranch: "main", stage: "building" };

function ctx() {
  const dir = initRepo(tmpDir());
  sh(dir, "git", ["checkout", "-q", "-b", "goal/G-3"]);
  return { profile, state, cwd: dir };
}

const lines = (...l) => l.join("\n");
const PROSE = ["Never run git push --force origin main.", "Do not read config/secrets.json.", "git reset --hard is off limits.", "rm -rf / is worse."];

test("a cat heredoc that only writes a file is prose, not a command line", () => {
  const c = ctx();
  for (const cmd of [
    lines("cat > notes.md <<'EOF'", ...PROSE, "EOF"),
    lines("cat >> notes.md <<\"EOF\"", ...PROSE, "EOF"),
    lines("cat <<'EOF' > notes.md", ...PROSE, "EOF"),
    lines("cat > notes.md <<\\EOF", ...PROSE, "EOF"),
    lines("cat > notes.md <<E'OF'", ...PROSE, "EOF"),
    lines("cd docs && cat > notes.md <<-'EOF'", ...PROSE.map((p) => `\t${p}`), "\tEOF"),
    lines("mkdir -p docs && cat > docs/notes.md <<'EOF' 2>&1", ...PROSE, "EOF", ""),
    lines("cat > a.md <<'EOF'", ...PROSE, "EOF", "", "cat > b.md <<'EOF'", ...PROSE, "EOF"),
  ]) assert.equal(checkBashCommand(cmd, c).deny, false, cmd);
});

test("a tee heredoc that names a file is prose, not a command line", () => {
  const c = ctx();
  for (const cmd of [
    lines("tee notes.md <<'EOF'", ...PROSE, "EOF"),
    lines("tee -a notes.md <<'EOF' >/dev/null", ...PROSE, "EOF"),
  ]) assert.equal(checkBashCommand(cmd, c).deny, false, cmd);
});

test("the command line that carries the heredoc, and what follows its terminator, is still judged", () => {
  const c = ctx();
  assert.equal(checkBashCommand(lines("cat > notes.md <<'EOF'", "text", "EOF", "git reset --hard"), c).guard, "git");
  assert.equal(checkBashCommand(lines("git reset --hard && cat > notes.md <<'EOF'", "text", "EOF"), c).guard, "git");
  assert.equal(checkBashCommand(lines("cat .env > notes.md <<'EOF'", "text", "EOF"), c).guard, "sensitive");
  assert.equal(checkBashCommand(lines("cat > notes.md <<'EOF'", "text"), c).deny, false, "a harmless body without a terminator");
  assert.equal(checkBashCommand(lines("cat > notes.md <<'EOF'", "git reset --hard"), c).guard, "git", "a body without a terminator is kept whole");
});

test("a heredoc followed by any other command, even one that leads into another heredoc, keeps its body", () => {
  const c = ctx();
  for (const cmd of [
    lines("cat > notes.md <<'EOF'", ...PROSE, "EOF", "git status"),
    lines("cat > run.sh <<'EOF'", "git reset --hard", "EOF", "cat run.sh"),
    lines("cat > run.sh <<'EOF'", "git reset --hard", "EOF", "bash < run.sh"),
    lines("cat > run.sh <<'EOF'", "git reset --hard", "EOF", "eval \"$(cat run.sh)\""),
    lines("cat > run.sh <<'EOF'", "git reset --hard", "EOF", "mv run.sh go.sh && bash go.sh"),
    lines("cat > run.sh <<'EOF'", "git reset --hard", "EOF", "bash ru*.sh"),
    lines("cat > run.sh <<'EOF'", "git reset --hard", "EOF", "chmod +x run.sh", "./run.sh"),
    lines("cat > RUN.sh <<'EOF'", "git reset --hard", "EOF", "cd sub && sh ../run.sh"),
    lines("tee run.py <<'EOF'", "import os; os.system('git reset --hard')", "EOF", "python3 run.py"),
    lines("cat > a.md <<'EOF'", "git reset --hard", "EOF", "bash <<'EOF'", "echo later", "EOF"),
    lines("cat > a.md <<'EOF'", "git reset --hard", "EOF", "cat > b.md <<EOF", "$(bash a.md)", "EOF"),
    lines("cat > run.sh <<'EOF'", "git reset --hard", "EOF", "bash run.sh && cat > notes.md <<'EOF'", "text", "EOF"),
    lines("cat > run.sh <<'EOF'", "git reset --hard", "EOF", "bash run.sh | tee notes.md <<'EOF'", "text", "EOF"),
  ]) assert.equal(checkBashCommand(cmd, c).guard, "git", cmd);
});

test("a heredoc fed to a shell is still scanned in full", () => {
  const c = ctx();
  for (const sh_ of ["bash", "sh", "zsh", "bash -s", "sudo bash"]) {
    assert.equal(checkBashCommand(lines(`${sh_} <<'EOF'`, "git reset --hard", "EOF"), c).guard, "git", sh_);
    assert.equal(checkBashCommand(lines(`${sh_} <<'EOF'`, "rm -rf /", "EOF"), c).guard, "shell", sh_);
  }
  assert.equal(checkBashCommand(lines("bash <<'EOF'", "cat config/secrets.json", "EOF"), c).guard, "sensitive");
});

test("a heredoc fed to an interpreter is still scanned in full", () => {
  const c = ctx();
  for (const head of ["node", "node -", "python3", "python3 -", "ruby", "perl", "osascript -l JavaScript", "some-unknown-tool"]) {
    assert.equal(checkBashCommand(lines(`${head} <<'EOF'`, "run('git reset --hard')", "EOF"), c).guard, "git", head);
  }
});

test("a heredoc that reaches a shell by another route is still scanned", () => {
  const c = ctx();
  assert.equal(checkBashCommand(lines("cat <<'EOF' | bash", "git reset --hard", "EOF"), c).guard, "git");
  assert.equal(checkBashCommand(lines("cat > run.sh <<'EOF' && bash run.sh", "git reset --hard", "EOF"), c).guard, "git", "a file written and run on one line");
  assert.equal(checkBashCommand(lines("cat > run.sh <<'EOF'; bash run.sh", "git reset --hard", "EOF"), c).guard, "git", "a file written and run on one line");
  assert.equal(checkBashCommand(lines("cat > >(bash) <<'EOF'", "git reset --hard", "EOF"), c).guard, "git", "process substitution as the target");
  assert.equal(checkBashCommand(lines("tee /dev/null >(bash) <<'EOF'", "git reset --hard", "EOF"), c).guard, "git", "process substitution as a tee argument");
  assert.equal(checkBashCommand(lines("cat > notes.md <<'EOF' \\", "| bash", "git reset --hard", "EOF"), c).guard, "git", "a heredoc line continued by a backslash");
  assert.equal(checkBashCommand(lines("cat <<'EOF'", "git reset --hard", "EOF"), c).guard, "git", "cat without a redirect writes to the terminal");
  assert.equal(checkBashCommand(lines("tee <<'EOF'", "git reset --hard", "EOF"), c).guard, "git", "tee without a file writes to the terminal");
  assert.equal(checkBashCommand(lines("cat > a.md <<'ONE'; bash <<'TWO'", "x", "ONE", "git reset --hard", "TWO"), c).guard, "git", "two heredocs on one line are not stripped");
});

test("a command elsewhere in the call can open a reader for the written file, so any other line keeps every body", () => {
  const c = ctx();
  for (const cmd of [
    lines("exec 3> >(bash)", "cat > /dev/fd/3 <<'EOF'", "git reset --hard", "EOF"),
    lines("exec > >(bash)", "cat > /dev/stdout <<'EOF'", "git reset --hard", "EOF"),
    lines("mkfifo p", "bash < p &", "cat > p <<'EOF'", "git reset --hard", "EOF"),
    lines("(sleep 1; bash run.sh) &", "cat > run.sh <<'EOF'", "git reset --hard", "EOF"),
    lines("perl -e 'fork or exec \"bash\", \"-c\", \"sleep 1; bash run.sh\"'", "cat > run.sh <<'EOF'", "git reset --hard", "EOF"),
    lines("coproc bash", "cat > /dev/fd/${COPROC[1]} <<'EOF'", "git reset --hard", "EOF"),
    lines("echo start", "cat > notes.md <<'EOF'", "git reset --hard", "EOF"),
    lines("bash < p & cat > p <<'EOF'", "git reset --hard", "EOF"),
    lines("exec 3> >(bash); cat > /dev/fd/3 <<'EOF'", "git reset --hard", "EOF"),
    lines("bash -c \"bash; cat\" > out.txt <<'EOF'", "git reset --hard", "EOF", "a separator inside quotes"),
    lines("X=/dev/fd/3 cat > $X <<'EOF'", "git reset --hard", "EOF"),
    lines("cat > \"$(echo /dev/fd/3)\" <<'EOF'", "git reset --hard", "EOF"),
  ]) assert.equal(checkBashCommand(cmd, c).guard, "git", cmd);
});

test("only cd and mkdir may lead the heredoc line, and only plain words may follow the write", () => {
  const c = ctx();
  for (const cmd of [
    lines("mkdir -p docs && cd docs && cat > notes.md <<'EOF'", ...PROSE, "EOF"),
    lines("cd docs; cat > notes.md <<'EOF'", ...PROSE, "EOF"),
    lines("  cat > notes.md <<'EOF'", ...PROSE, "EOF"),
    lines("cat 1> notes.md <<'EOF' 2>/dev/null", ...PROSE, "EOF"),
  ]) assert.equal(checkBashCommand(cmd, c).deny, false, cmd);
  for (const cmd of [
    lines("true && cat > notes.md <<'EOF'", ...PROSE, "EOF"),
    lines("cd && cat > notes.md <<'EOF'", ...PROSE, "EOF"),
    lines("cat > 'notes.md' <<'EOF'", ...PROSE, "EOF"),
    lines("cat > $HOME/notes.md <<'EOF'", ...PROSE, "EOF"),
    lines("cat > notes.md <<'EOF' # note", ...PROSE, "EOF"),
    lines("cat 2> notes.md <<'EOF'", ...PROSE, "EOF"),
    lines("cat > notes.md <<'EOF' || true", ...PROSE, "EOF"),
  ]) assert.equal(checkBashCommand(cmd, c).deny, true, cmd);
});

test("the terminator is found where bash finds it, so no command after the body is swallowed", () => {
  const c = ctx();
  assert.equal(checkBashCommand(lines("cat > notes.md <<'EOF'", "text \\", "EOF", "git reset --hard"), c).guard, "git", "a body line ending in a backslash");
  assert.equal(checkBashCommand(lines("cat > notes.md <<E'OF'", "text", "EOF", "git reset --hard"), c).guard, "git", "a partly quoted delimiter");
  assert.equal(checkBashCommand(lines("cat > notes.md <<\"E\"OF", "text", "EOF", "git reset --hard"), c).guard, "git", "a partly quoted delimiter");
  assert.equal(checkBashCommand(lines("cat > notes.md <<'EOF'", "text", "EOF\r", "git reset --hard"), c).guard, "git", "CRLF line endings");
});

test("a delimiter with a quote or a backslash inside it is read by the shell as written, so only plain parts are accepted", () => {
  const c = ctx();
  for (const cmd of [
    lines("cat > a.md <<'E\\OF'", "E\\OF", "git reset --hard", "EOF"),
    lines("cat > a.md <<\"E'OF\"", "E'OF", "git reset --hard", "EOF"),
    lines("cat > a.md <<'E\"OF'", "E\"OF", "git push --force origin main", "EOF"),
    lines("tee a.md <<'E\\OF'", "E\\OF", "git push origin main", "EOF"),
    lines("cat > a.md <<E\\\\OF", "E\\OF", "git reset --hard", "EOF"),
  ]) assert.equal(checkBashCommand(cmd, c).guard, "git", cmd);
  assert.equal(checkBashCommand(lines("cat > a.md <<\"E\\\\OF\"", "E\\OF", "cat config/secrets.json", "EOF"), c).guard, "sensitive");
  assert.equal(checkBashCommand(lines("cat > a.md <<\\'EOF", "'EOF", "rm -rf /", "EOF"), c).guard, "shell");
  const dormant = { ...c, state: { ...state, stage: "done" } };
  assert.equal(checkBashCommand(lines("cat > a.md <<'E\\OF'", "E\\OF", "git push origin main", "EOF"), dormant).deny, true, "a dormant goal still never pushes the default branch");
});

test("a carriage return anywhere keeps the text whole, as the shell compares the terminator as written", () => {
  const c = ctx();
  for (const cmd of [
    lines("cat > a.md <<'EOF'", "x", "EOF\r", "cat > b.md <<'X'", "EOF", "git reset --hard", "X"),
    lines("cat > a.md <<'EOF'", "x", "EOF\r", "cat > b.md <<'X'", "EOF", "git push --force origin main", "X"),
    lines("cat > a.md <<'EOF'\r", "EOF", "cat > b.md <<'X'", "EOF\r", "git reset --hard", "X"),
    lines("tee a.md <<'EOF'", "x", "EOF\r", "tee b.md <<'X'", "EOF", "git reset --hard", "X"),
  ]) assert.equal(checkBashCommand(cmd, c).guard, "git", cmd);
  assert.equal(checkBashCommand(lines("cat > a.md <<'EOF'", "x", "EOF\r", "cat > b.md <<'X'", "EOF", "cat config/secrets.json", "X"), c).guard, "sensitive");
  assert.equal(checkBashCommand(lines("cat > a.md <<'EOF'", "x", "EOF\r", "cat > b.md <<'X'", "EOF", "rm -rf /", "X"), c).guard, "shell");
  assert.equal(checkBashCommand(lines("cat > notes.md <<'EOF'\r", ...PROSE.map((p) => `${p}\r`), "EOF\r"), c).deny, true, "an all-CRLF prose heredoc is judged whole");
});

test("an unquoted delimiter lets the shell expand the body, so an expansion stays scanned", () => {
  const c = ctx();
  assert.equal(checkBashCommand(lines("cat > notes.md <<EOF", ...PROSE, "EOF"), c).deny, false);
  assert.equal(checkBashCommand(lines("cat > notes.md <<EOF", "$(git reset --hard)", "EOF"), c).guard, "git");
  assert.equal(checkBashCommand(lines("cat > notes.md <<EOF", "`git reset --hard`", "EOF"), c).guard, "git");
  assert.equal(checkBashCommand(lines("cat > notes.md <<'EOF'", "$(git reset --hard)", "EOF"), c).deny, false, "a quoted delimiter expands nothing");
});

test("an unquoted delimiter lets the shell join a backslash-newline in the body, which can form the terminator early", () => {
  const c = ctx();
  assert.equal(checkBashCommand(lines("cat > notes.md <<EOF", "E\\", "OF", "git reset --hard", "EOF"), c).guard, "git");
  assert.equal(checkBashCommand(lines("cat > notes.md <<-EOF", "\tE\\", "OF", "git reset --hard", "\tEOF"), c).guard, "git");
  assert.equal(checkBashCommand(lines("cat > notes.md <<EOF", "E\\", "OF", "git push --force origin main", "EOF"), c).guard, "git");
  assert.equal(checkBashCommand(lines("cat > notes.md <<EOF", "E\\", "OF", "cat config/secrets.json", "EOF"), c).guard, "sensitive");
  assert.equal(checkBashCommand(lines("cat > notes.md <<EOF", "a backslash \\ anywhere keeps the body", "git reset --hard", "EOF"), c).guard, "git");
  assert.equal(checkBashCommand(lines("cat > notes.md <<'EOF'", "E\\", "OF", "git reset --hard", "EOF"), c).deny, false, "a quoted delimiter joins nothing");
});

test("a here-string is not a heredoc", () => {
  const c = ctx();
  assert.equal(checkBashCommand(lines("cat > notes.md <<< 'x'", "git reset --hard"), c).guard, "git");
});

test("the heredoc pass opens no push bypass: every push the whole-text rule denied is still denied", () => {
  const c = ctx();
  for (const cmd of [
    lines("xargs <<EOF git", "push origin goal/G-3", "main", "EOF"),
    lines("xargs <<EOF git", "push --force origin goal/G-3", "EOF"),
    lines("xargs <<'EOF' git", "push", "origin", "main", "EOF"),
    lines("xargs <<EOF git", "push origin HEAD:main", "EOF"),
    lines("tr '\\n' ' ' <<'EOF' | bash", "git", "push origin main", "EOF"),
    lines("paste -sd ' ' - <<'EOF' | sh", "git", "push --force origin goal/G-3", "EOF"),
    lines("xargs git push origin goal/G-3 <<'EOF'", "main", "EOF"),
    lines("xargs git push origin goal/G-3 <<'EOF'", "--force", "EOF"),
    lines("xargs git push origin goal/G-3 <<'EOF'", "HEAD:main", "EOF"),
    lines("xargs git push origin goal/G-3 <<EOF", "main", "EOF"),
    lines("xargs git -C . --no-pager push origin goal/G-3 <<'EOF'", "main", "EOF"),
    lines("xargs git -C .<<EOF push origin goal/G-3", "main", "EOF"),
    lines("xargs git -C .<<EOF push origin goal/G-3", "--force", "EOF"),
    lines("xargs git -C .<<EOF push origin goal/G-3", "HEAD:main", "EOF"),
    lines("xargs git -C .<<EOF", "push origin main", "EOF"),
    lines("xargs git -c x.y=<<'EOF' push origin goal/G-3", "main", "EOF"),
    lines("xargs git --work-tree=.<<EOF push origin goal/G-3", "main", "EOF"),
    lines("git push origin goal/G-3 $(", "echo main", ")"),
    lines("git push origin goal/G-3 $(", "echo --force", ")"),
    lines("git push origin goal/G-3 `", "echo main", "`"),
    lines("git push origin goal/G-3 \"$(cat <<'EOF'", "main", "EOF", ")\""),
    lines("git push origin goal/G-3 --push-option='a", "b' main"),
    lines("git push origin goal/G-3 $(", "echo main # )", ")"),
    lines("git push origin goal/G-3 ${X:-", "--force}"),
    lines("echo start", "git push --force origin goal/G-3"),
    lines("echo start", "git push origin main"),
    lines("echo start", "git push origin HEAD:other"),
    lines("git push origin goal/G-3", "git push origin main"),
    "git push origin goal/G-3 && git push origin main",
    lines("git push origin goal/G-3", "git push --force origin goal/G-3"),
    "git push \\\n  --force origin goal/G-3",
    "git push origin \\\n  main",
    lines("cat > notes.md <<'EOF'", ...PROSE, "EOF", "git push origin main"),
    lines("git push origin main && cat > notes.md <<'EOF'", ...PROSE, "EOF"),
  ]) assert.equal(checkBashCommand(cmd, c).deny, true, cmd);
  const dormant = { ...c, state: { ...state, stage: "done" } };
  assert.equal(checkBashCommand(lines("git push origin goal/G-3 $(", "echo main", ")"), dormant).deny, true, "a dormant goal still never pushes the default branch");
  assert.equal(checkBashCommand(lines("xargs git push origin goal/G-3 <<'EOF'", "main", "EOF"), dormant).deny, true, "a dormant goal still never pushes the default branch through a heredoc");
  assert.equal(checkBashCommand(lines("xargs <<EOF git", "push origin main", "EOF"), dormant).deny, true, "git and push on separate heredoc lines still meet");
  assert.equal(checkBashCommand(lines("xargs -L 9 <<EOF git", "push", "origin", "main", "EOF"), dormant).deny, true, "git and push on separate heredoc lines still meet");
  assert.equal(checkBashCommand(lines("xargs git -C .<<EOF", "push origin main", "EOF"), dormant).deny, true, "a global option value cannot hide the heredoc operator");
});

test("the push rule reads the whole text, so a push followed by prose on a later line is still one push", () => {
  // The one-line match was cut from goal G-3; this is the false positive that stays.
  const c = ctx();
  assert.equal(checkBashCommand(lines("git push origin goal/G-3", "then run it --all the way"), c).deny, true);
  assert.equal(checkBashCommand("git push origin goal/G-3", c).deny, false);
});
