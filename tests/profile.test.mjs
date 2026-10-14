import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpDir, write, PLUGIN_ROOT } from "./helpers.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";

test("project profile deep-merges over defaults, arrays replace", () => {
  const dir = tmpDir();
  const base = loadProfile(dir, PLUGIN_ROOT);
  assert.equal(base.caps.maxAttempts, 3);
  write(dir, ".harness/profile.json", JSON.stringify({ caps: { maxAttempts: 5 }, hosts: { prod: ["app.example.com"] }, checks: [{ id: "test", command: "npm test" }] }));
  const merged = loadProfile(dir, PLUGIN_ROOT);
  assert.equal(merged.caps.maxAttempts, 5);
  assert.equal(merged.caps.roundsAuthorized, 3);
  assert.deepEqual(merged.hosts.prod, ["app.example.com"]);
  assert.deepEqual(merged.hosts.fixture, base.hosts.fixture);
  assert.equal(merged.checks.length, 1);
});
