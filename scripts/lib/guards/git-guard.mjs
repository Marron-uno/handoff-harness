// Bash command guard: history is never rewritten, pushes stay on the goal branch,
// state files are written only through the CLI, sensitive files are never read.
import { currentBranch } from "../git.mjs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isSensitivePath } from "./path-guard.mjs";

const STATE_FILES = /\.harness\/(state\.json|events\.jsonl|plugin-root)/;

function stripQuotes(s) { return s.replace(/^["']|["']$/g, ""); }

// True when a state file is the target of a write, not merely read by a command that writes
// elsewhere (`jq . .harness/state.json > /tmp/out.json` is a read). Run 2's reconciler was
// denied for exactly that shape.
function writesStateFile(text) {
  if (/(?:>>?|\btee\b(?:\s+-a)?)\s*["']?[^\s"'|;&]*\.harness\/(state\.json|events\.jsonl|plugin-root)/.test(text)) return true;
  if (/\bsed\s+-i[^|;&]*\.harness\/(state\.json|events\.jsonl|plugin-root)/.test(text)) return true;
  if (/\brm\b[^|;&]*\.harness\/(state\.json|events\.jsonl|plugin-root)/.test(text)) return true;
  for (const seg of text.split(/[|;&]+/)) {
    const m = seg.match(/\b(mv|cp)\b(.*)$/);
    if (!m) continue;
    const args = m[2].trim().split(/\s+/).filter((a) => a && !a.startsWith("-"));
    if (args.length && STATE_FILES.test(args[args.length - 1])) return true;
  }
  return false;
}

// Global git options between `git` and the subcommand (-C <dir>, --git-dir, --work-tree, -c k=v,
// pager flags) are dropped before matching, so a command aimed at another directory or worktree is
// judged as the subcommand it runs.
const GLOBAL_OPTIONS = /\bgit(?:\s+(?:-C\s+\S+|--git-dir(?:=\S+|\s+\S+)|--work-tree(?:=\S+|\s+\S+)|-c\s+\S+|--no-pager|-p|--paginate))+(?=\s)/g;

// The body of a heredoc that a command only writes to a file is prose, not a command line:
// `cat > notes.md <<'EOF'` with a body that talks about a forced push runs nothing. Such bodies are
// left out of the judged text, but only when the whole call is that shape: every line is blank or
// is a heredoc line that `cat` (with a stdout redirect) or `tee` (with a file argument) runs, made
// of plain words, led at most by `cd` or `mkdir` segments, with its terminator present and, under
// an unquoted delimiter, no `$`, backtick or backslash in the body. Any other line, before or after the write,
// could open a reader for what is written (`exec 3> >(bash)` then `cat > /dev/fd/3`, a fifo, a
// backgrounded runner) or run the file later, under a spelling no list would catch, so the text is
// then judged whole and the guard fails safe. A heredoc fed to a shell, an interpreter or any other
// command is not that shape and stays in the text. The delimiter is the word after `<<` with its
// quotes removed, as bash reads `E'OF'` or `\EOF`, and the terminator is the first line equal to
// it. Only a word of plain parts is accepted, bare, single-quoted, double-quoted or backslash-
// escaped word characters, dots and dashes, for which removing the quotes is exactly what the
// shell does; a backslash inside single quotes or a quote inside the other kind stays in the
// shell's delimiter, so such a word keeps the text whole.
const HEREDOC = /(?<!<)<<(?!<)(-?)[ \t]*([^\s<>|;&()]+)/g;
const DELIM = /^(?:[\w.-]+|'[\w.-]*'|"[\w.-]*"|\\[\w.-])+$/;
// A plain word is taken by the shell as written: no quote, expansion, glob, brace or operator.
const WORD = String.raw`[\w./~+=,:@%-]+`;
// After the write: plain words, output redirects (`> f`, `2>/dev/null`) and fd copies (`2>&1`).
const ITEM = String.raw`(?:${WORD}|\d?>>?[ \t]*${WORD}|\d*[<>]&\d)`;
const PLAIN_WRITE = new RegExp(String.raw`^[ \t]*(?:(?:cd|mkdir)(?:[ \t]+${WORD})+[ \t]*(?:&&|;)[ \t]*)*(cat|tee)((?:[ \t]+${ITEM})*)[ \t]*$`);

// The file a plain write line writes to: the stdout redirect of `cat`, the first file argument
// of `tee`. Null when the body would reach the terminal instead.
function writtenFile(cmd, items) {
  const toks = items.trim().split(/[ \t]+/).filter(Boolean);
  let redirect = null;
  const words = [];
  for (let i = 0; i < toks.length; i++) {
    if (/^\d*[<>]&\d$/.test(toks[i])) continue;
    const r = /^(\d?)>>?(.*)$/.exec(toks[i]);
    if (r) {
      const target = r[2] || toks[++i];
      if (r[1] === "" || r[1] === "1") redirect = target;
      continue;
    }
    words.push(toks[i]);
  }
  return cmd === "cat" ? redirect : words.find((w) => !w.startsWith("-")) ?? null;
}

export function dropFileHeredocs(text) {
  // The shell compares a terminator line as written, carriage return included, so a text that
  // holds any `\r` is judged whole rather than ended early at a line the shell reads as body.
  if (/\r/.test(text)) return text;
  const lines = text.split("\n");
  const body = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const marks = [...line.matchAll(HEREDOC)];
    if (marks.length !== 1 || !DELIM.test(marks[0][2])) return text;
    const [mark, dash, word] = marks[0];
    const quoted = /["'\\]/.test(word);
    const delim = word.replace(/["'\\]/g, "");
    let end = -1;
    for (let j = i + 1; j < lines.length && end < 0; j++) {
      if ((dash ? lines[j].replace(/^\t+/, "") : lines[j]) === delim) end = j;
    }
    if (end < 0) return text;
    const w = PLAIN_WRITE.exec(`${line.slice(0, marks[0].index)} ${line.slice(marks[0].index + mark.length)}`);
    if (!w || !writtenFile(w[1], w[2])) return text;
    // An unquoted delimiter lets the shell expand `$(...)` and backticks in the body and join a
    // backslash-newline before it looks for the terminator, so `E\` then `OF` ends the heredoc
    // early; such a body is dropped only when it holds none of the three characters.
    if (!quoted && lines.slice(i + 1, end).some((b) => /[$`\\]/.test(b))) return text;
    for (let j = i + 1; j < end; j++) body.add(j);
    i = end;
  }
  return lines.filter((_, j) => !body.has(j)).join("\n");
}

export function checkBashCommand(command, { profile, state, cwd }) {
  // Backslash-newlines are joined after the heredoc pass, so a body line ending in a backslash
  // cannot swallow its terminator.
  const text = dropFileHeredocs(String(command ?? "")).replace(/\\\r?\n/g, " ").replace(GLOBAL_OPTIONS, "git");
  for (const p of profile.git.denyPatterns) {
    if (new RegExp(p).test(text)) return { deny: true, guard: "git", reason: `Blocked by the git guard: history rewrites, bulk staging and discard commands are not allowed (${p}). Stage files explicitly and let \`harness record\` commit.` };
  }
  for (const p of profile.shell.denyPatterns) {
    if (new RegExp(p).test(text)) return { deny: true, guard: "shell", reason: `Blocked by the shell guard: destructive command pattern (${p}).` };
  }
  if (state) {
    const branch = currentBranch(cwd);
    const def = state.defaultBranch;
    // A goal resting in done is dormant: branches may be switched and pushed as in any repository,
    // except that the default branch is never pushed from a session.
    const dormant = state.stage === "done";
    // Every push in the text is judged. The match runs to the next `|`, `;` or `&` across
    // newlines, as the deny pattern does: a push followed by prose on a later line is read as one
    // push with those words as arguments, and a push that a later line rebuilds from heredoc lines
    // or an open expansion still meets it. Goal G-3 tried a one-line match and cut it; its
    // proposal says why.
    for (const push of profile.git.pushOnlyGoalBranch ? text.matchAll(/git\s+push\b([^|;&]*)/g) : []) {
      const args = push[1].trim().split(/\s+/).filter((a) => a && !a.startsWith("-"));
      // A push of HEAD is a push of the current branch; judge it as that branch.
      const named = args.slice(1).map((a) => (a === "HEAD" ? branch ?? a : a));
      if (named.some((a) => a === def || a.endsWith(`/${def}`))) return { deny: true, guard: "git", reason: `Blocked: pushing to the default branch ${def} is not allowed from a session.${dormant ? "" : ` Push ${state.branch} only.`}` };
      if (dormant) {
        if (!named.length && branch === def) return { deny: true, guard: "git", reason: `Blocked: pushing the default branch ${def} is not allowed from a session.` };
      } else {
        if (named.length && !named.includes(state.branch)) return { deny: true, guard: "git", reason: `Blocked: push only the goal branch ${state.branch}, not ${named.join(" ")}.` };
        if (!named.length && branch !== state.branch) return { deny: true, guard: "git", reason: `Blocked: current branch ${branch} is not the goal branch ${state.branch}.` };
      }
    }
    const sw = text.match(/git\s+(checkout|switch)\s+([^\s;&|]+)/);
    if (sw && !dormant && profile.git.noWorkOnDefaultBranch && (sw[2] === def || sw[2] === "-")) return { deny: true, guard: "git", reason: `Blocked: switching to ${def} during a goal. Work stays on ${state.branch}.` };
  }
  if (STATE_FILES.test(text) && !/cli\.mjs|(?:^|[\s;&|])harness\s/.test(text) && writesStateFile(text)) {
    return { deny: true, guard: "state", reason: "Blocked: .harness/state.json, events.jsonl and plugin-root are written only by the harness CLI." };
  }
  // Only path-like tokens are tested: a word such as "secrets" inside a grep pattern is not a file.
  for (const token of text.split(/\s+/).map(stripQuotes)) {
    const rel = token.replace(/^\.\//, "");
    if (!rel) continue;
    const pathLike = rel.includes("/") || rel.startsWith(".") || /\.[a-z0-9]{1,5}$/i.test(rel) || existsSync(join(cwd, rel));
    if (!pathLike) continue;
    if (isSensitivePath(rel, profile.lanes.sensitivePaths)) return { deny: true, guard: "sensitive", reason: `Blocked: ${rel} matches a sensitive path. Agents never read secrets; use fixture values from .harness/profile.json.` };
  }
  return { deny: false };
}
