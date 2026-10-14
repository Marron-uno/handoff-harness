import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runCli, PLUGIN_ROOT } from "./helpers.mjs";
import { fixtureRepo, writeIntake, stop } from "./fixture.mjs";

test("preflight runs the pinned OpenSpec validator on the fixture's change and spec", () => {
  const dir = fixtureRepo();
  assert.ok(existsSync(join(dir, "openspec/config.yaml")), "fixture ships an openspec folder");
  runCli(dir, ["init"]);
  runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff"]);
  writeIntake(dir);
  stop(dir); runCli(dir, ["goal", "approve"]); stop(dir);
  runCli(dir, ["slice", "done"]); stop(dir);
  const pf = runCli(dir, ["preflight"]);
  const check = pf.json.checks.find((c) => c.id === "openspec_validate");
  const installed = existsSync(join(PLUGIN_ROOT, "node_modules", ".bin", "openspec"));
  if (installed) {
    assert.equal(check.status, "pass", JSON.stringify(check));
    assert.match(check.details, /2 passed, 0 failed/);
  } else {
    assert.equal(check.status, "skip");
  }
});
