import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { PLUGIN_ROOT } from "./helpers.mjs";
import { runMetrics, normalizeError, metricValue } from "../scripts/lib/metrics.mjs";

const run = (n) => runMetrics(join(PLUGIN_ROOT, "docs", "runs", `2026-10-14-fixture-run-${n}`));

test("metrics reproduce the numbers written up for the three recorded runs", () => {
  const r1 = run(1);
  assert.equal(r1.stage, "done"); assert.equal(r1.slicesDone, 3); assert.equal(r1.blocks, 24); assert.equal(r1.halts, 1); assert.deepEqual(r1.haltCodes, ["runaway"]);
  assert.equal(r1.sessions, 2, "two headless sessions, from the drive log"); assert.equal(r1.costReported, 1.241);
  assert.equal(r1.verdictWrites, 6); assert.equal(r1.invalidVerdicts, 0); assert.equal(r1.screenshots, 1); assert.equal(r1.guardDenials, 1);
  assert.equal(r1.criticCalls.max, 25, "old runs recorded cumulative calls; the last figure is the total");

  const r2 = run(2);
  assert.equal(r2.slicesDone, 4); assert.equal(r2.slicesFromReconcile, 1); assert.equal(r2.blocks, 0); assert.equal(r2.halts, 0);
  assert.equal(r2.verdictWrites, 14); assert.equal(r2.invalidVerdicts, 5); assert.equal(r2.guardDenials, 2); assert.deepEqual(r2.guardsByGuard, { state: 2 });
  assert.equal(r2.screenshots, 2); assert.equal(r2.costReported, 1.737); assert.equal(r2.reconcilePasses, 2); assert.equal(r2.specAttempts, 1); assert.equal(r2.specFindings, 4);
  assert.deepEqual(r2.criticCallsPerSlice.map((c) => c.calls), [17, 18, 27, 19], "cumulative stops collapse to the last figure per slice");
  assert.equal(r2.criticCalls.max, 27);

  const r3 = run(3);
  assert.equal(r3.stage, "done", "as recorded, before the holds_open fix"); assert.equal(r3.slicesDone, 2); assert.equal(r3.slicesHeld, 1); assert.equal(r3.holdsOpen, 1);
  assert.equal(r3.verdictWrites, 7); assert.equal(r3.invalidVerdicts, 2); assert.equal(r3.judgeStopsExtra, 2);
  assert.deepEqual(r3.criticCallsPerSlice, [{ slice: "S-1", calls: 8 }, { slice: "S-2", calls: 10 }], "deltas add up across the critic's three stops");
  assert.deepEqual(r3.reviewerCallsPerSlice.map((c) => c.calls), [2, 3]);
  assert.equal(r3.sessions, 1); assert.equal(r3.costReported, 0.884); assert.equal(r3.costTable, 0.774); assert.equal(r3.costRatio, 0.88);
  assert.equal(r3.jevAnswers, 11); assert.deepEqual(r3.jevRoutes, { accept: 5 }, "one gate per valid verdict: spec, two critics, two reviewers"); assert.equal(r3.jevCost, 0.00034);
  assert.ok(Object.keys(r3.invalidByError).some((k) => /expected object, got string/.test(k)), JSON.stringify(r3.invalidByError));
  assert.ok(r3.minutes > 5 && r3.minutes < 6, `session rows do not stretch the wall clock: ${r3.minutes}`);
  assert.equal(metricValue(r3, "criticCalls.max"), 10);
});

test("normalizeError strips paths, hashes, ids and array indexes", () => {
  assert.equal(normalizeError("$.criteria[0].evidence[1]: expected object, got string"), "$.<item>: expected object, got string");
  assert.equal(normalizeError("diffHash dbd42d434caa0d56 does not match the current work hash d3fe502f25b7ca4e"), "diffHash <hash> does not match the current work hash <hash>");
  assert.equal(normalizeError("F-1: evidence path does not exist: /tmp/x/src/a.mjs"), "<id>: evidence path does not exist: <path>");
});
