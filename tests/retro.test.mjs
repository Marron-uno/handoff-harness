import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpDir, initRepo, runCli, PLUGIN_ROOT } from "./helpers.mjs";
import { fixtureRepo, writeIntake, stop } from "./fixture.mjs";

// A project whose .harness/ is the recorded run 3, as the retro would find it after the goal rested.
function recordedRun3() {
  const dir = initRepo(tmpDir("hh-retro-"));
  mkdirSync(join(dir, ".harness"), { recursive: true });
  cpSync(join(PLUGIN_ROOT, "docs", "runs", "2026-10-14-fixture-run-3"), join(dir, ".harness"), { recursive: true });
  return dir;
}

test("harness retro surfaces the held slice, the rejected verdicts, the critic's calls and the Jev near miss from run 3 without being told", () => {
  const dir = recordedRun3();
  const r = runCli(dir, ["retro"]);
  assert.equal(r.json.ok, true, r.stdout + r.stderr);
  assert.ok(r.json.path.endsWith("/.harness/proposals/" + new Date().toISOString().slice(0, 10) + "-G-1-retro.md"), r.json.path);
  const text = readFileSync(r.json.path, "utf8");
  const signals = r.json.signals.join("\n");
  assert.match(signals, /1 slice\(s\) left unbuilt behind a hold: S-3 "Note count on the page"/);
  assert.match(signals, /2 of 7 verdict writes were rejected by the validator: "\$\.<item>: expected object, got string"/);
  assert.match(signals, /Critic used 8 tool calls on S-1/);
  assert.match(signals, /Critic used 10 tool calls on S-2/);
  assert.match(signals, /2 judge stop\(s\) beyond the first/);
  assert.match(signals, /Jev near miss: verdict:finding:F-3 evidence_supports answered 0\.42 against the 0\.4 threshold/);
  assert.doesNotMatch(signals, /Price table at/, "0.88x is inside the accepted band");
  assert.doesNotMatch(signals, /Stop-hook block/, "run 3 had none");
  assert.match(text, /^---\nkind: retro\ngoal: G-1\nsentence: "build all of the handoff"\nharness: \d+\.\d+\.\d+\nfinalStage: done\n/);
  assert.match(text, /## Metrics\n\n```json\n\{\n  "goal": "G-1"/);
  assert.match(text, /"invalidVerdicts": 2/);
  assert.match(text, /## Findings, ranked[\s\S]*### R-1: <what went wrong, in one line>[\s\S]*- Hypothesis: `<metric>: <down\|up\|zero>`/);
  assert.match(text, /## Not changed/);
  assert.equal(r.json.metrics.slicesHeld, 1);
  assert.equal(r.json.metrics.costRatio, 0.88);
  // No event is written: the retro reads a run, it is not part of one.
  assert.equal(runCli(dir, ["events", "--type", "note"]).json.events.filter((e) => /retro/.test(e.text ?? "")).length, 0);
  const custom = runCli(dir, ["retro", "--out", join(dir, ".harness", "proposals", "custom.md")]).json;
  assert.ok(existsSync(custom.path));
});

test("harness retro refuses mid-run unless forced", () => {
  const dir = fixtureRepo();
  runCli(dir, ["init"]);
  runCli(dir, ["goal", "new", "--sentence", "Build all of the handoff"]);
  writeIntake(dir);
  stop(dir);
  runCli(dir, ["goal", "approve"]);
  stop(dir);
  const refused = runCli(dir, ["retro"]);
  assert.equal(refused.json.ok, false);
  assert.match(refused.json.error, /in building, not resting/);
  const forced = runCli(dir, ["retro", "--force"]);
  assert.equal(forced.json.ok, true, forced.stdout);
  assert.match(forced.json.signals.join("\n"), /The run rests in building/);
  assert.match(forced.json.signals.join("\n"), /No session cost recorded/);
});
