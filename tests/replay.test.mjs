// Replay evals: the current code against the recorded runs. Every retro finding that became a
// fix should leave an expectation here, so the failure class cannot come back unnoticed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLUGIN_ROOT } from "./helpers.mjs";
import { runMetrics, metricValue } from "../scripts/lib/metrics.mjs";
import { heldPendingSlices } from "../scripts/lib/goal-check.mjs";
import { verdictSchema } from "../scripts/lib/verdict.mjs";
import { validate } from "../scripts/lib/schema.mjs";

const runsDir = join(PLUGIN_ROOT, "docs", "runs");
const snapshots = readdirSync(runsDir).filter((n) => existsSync(join(runsDir, n, "expect.json"))).sort();

test("there are recorded runs with expectations", () => { assert.ok(snapshots.length >= 3, snapshots.join(", ")); });

for (const name of snapshots) {
  test(`replay ${name}`, () => {
    const dir = join(runsDir, name);
    const expect = JSON.parse(readFileSync(join(dir, "expect.json"), "utf8"));
    const metrics = runMetrics(dir);
    for (const [key, value] of Object.entries(expect.metrics ?? {})) assert.deepEqual(metricValue(metrics, key), value, `${name}: ${key}`);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    assert.deepEqual(heldPendingSlices(state), expect.heldPending ?? [], `${name}: held pending slices`);
    if (expect.schemaValidVerdicts) {
      const vdir = join(dir, "verdicts");
      for (const f of readdirSync(vdir).filter((n) => n.endsWith(".json") && !n.startsWith("reconcile"))) {
        const errors = validate(verdictSchema(), JSON.parse(readFileSync(join(vdir, f), "utf8")));
        assert.deepEqual(errors, [], `${name}: ${f} no longer passes the verdict schema`);
      }
      const rejected = join(vdir, "rejected");
      if (existsSync(rejected)) for (const f of readdirSync(rejected).filter((n) => n.endsWith(".json"))) {
        const errors = validate(verdictSchema(), JSON.parse(readFileSync(join(rejected, f), "utf8")));
        assert.ok(errors.length > 0, `${name}: rejected/${f} now passes the schema; the fumble it records would go unnoticed`);
      }
    }
  });
}
