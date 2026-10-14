import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT;

export function tmpDir(prefix = "hh-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function sh(cwd, cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", ...opts });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr}`);
  return r;
}

export function initRepo(dir, { branch = "main" } = {}) {
  sh(dir, "git", ["init", "-q", "-b", branch]);
  sh(dir, "git", ["config", "user.email", "test@example.com"]);
  sh(dir, "git", ["config", "user.name", "Test"]);
  sh(dir, "git", ["config", "commit.gpgsign", "false"]);
  write(dir, "README.md", "# fixture\n");
  sh(dir, "git", ["add", "README.md"]);
  sh(dir, "git", ["commit", "-q", "-m", "init"]);
  return dir;
}

export function write(dir, rel, content) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
}

export function commitAll(dir, message, files) {
  sh(dir, "git", ["add", ...files]);
  sh(dir, "git", ["commit", "-q", "-m", message]);
}

// Runs a hook script with a JSON stdin payload and returns parsed stdout plus exit code.
export function runHook(name, input, { env = {} } = {}) {
  const r = spawnSync(process.execPath, [join(PLUGIN_ROOT, "scripts", "hooks", `${name}.mjs`)], {
    input: JSON.stringify(input), encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, ...env },
  });
  let json = null;
  try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { json = null; }
  return { code: r.status, json, stdout: r.stdout, stderr: r.stderr };
}

export function runCli(cwd, args, { env = {}, input } = {}) {
  const r = spawnSync(process.execPath, [join(PLUGIN_ROOT, "scripts", "cli.mjs"), ...args], {
    cwd, encoding: "utf8", input,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, ...env },
  });
  let json = null;
  try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { json = null; }
  return { code: r.status, json, stdout: r.stdout, stderr: r.stderr };
}
