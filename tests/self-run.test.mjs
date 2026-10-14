import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpDir, initRepo, runCli, PLUGIN_ROOT } from "./helpers.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";
import { checkFileAccess } from "../scripts/lib/guards/path-guard.mjs";

function harnessCheckout() {
  const dir = initRepo(tmpDir("hh-self-"));
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  writeFileSync(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "handoff-harness", version: "0.0.0" }));
  mkdirSync(join(dir, "scripts", "lib"), { recursive: true });
  writeFileSync(join(dir, "scripts", "cli.mjs"), "// stand-in\n");
  return dir;
}

test("a checkout of the harness is editable when a different copy enforces, read-only when the same copy does", () => {
  const dir = harnessCheckout();
  const profile = loadProfile(dir, PLUGIN_ROOT);
  const frozen = checkFileAccess({ tool: "Write", filePath: join(dir, "scripts", "lib", "preflight.mjs"), cwd: dir, profile, state: null, agentType: null, pluginRoot: PLUGIN_ROOT });
  assert.equal(frozen.deny, false, JSON.stringify(frozen));
  const stillDenied = checkFileAccess({ tool: "Write", filePath: join(PLUGIN_ROOT, "scripts", "cli.mjs"), cwd: dir, profile, state: null, agentType: null, pluginRoot: PLUGIN_ROOT });
  assert.equal(stillDenied.guard, "harness-files", "the enforcing copy stays read-only");
  const self = checkFileAccess({ tool: "Write", filePath: join(dir, "scripts", "lib", "preflight.mjs"), cwd: dir, profile, state: null, agentType: null, pluginRoot: dir });
  assert.equal(self.guard, "harness-files");
  assert.match(self.reason, /this project is the harness itself/);
  assert.match(self.reason, /--plugin-root/);
});

test("harness init names the self-run route when the project is the harness", () => {
  const dir = harnessCheckout();
  const r = runCli(dir, ["init"], { env: { CLAUDE_PLUGIN_ROOT: dir } });
  assert.equal(r.json.ok, true, r.stdout);
  assert.match(r.json.selfRun, /enforce a run with a frozen copy/);
  const other = runCli(initRepo(tmpDir()), ["init"]);
  assert.equal(other.json.selfRun, undefined, "an ordinary project gets no note");
});

test("the driver refuses to enforce a run on its own checkout and to use a root without a cli", () => {
  const dir = harnessCheckout();
  mkdirSync(join(dir, ".harness"), { recursive: true });
  writeFileSync(join(dir, ".harness", "state.json"), "{}");
  const drive = join(PLUGIN_ROOT, "scripts", "drive.mjs");
  let r = spawnSync(process.execPath, [drive, "--cwd", PLUGIN_ROOT], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /the project is the harness itself/);
  assert.match(r.stderr, /--plugin-root/);
  r = spawnSync(process.execPath, [drive, "--cwd", dir, "--plugin-root", join(dir, "nowhere")], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no harness at .*nowhere/);
});
