import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { PLUGIN_ROOT } from "./helpers.mjs";
import { compareArms, renderComparison, judge, loadArm } from "../scripts/eval/compare.mjs";

const arm = (label, rows) => ({ label, runs: rows.map((m) => ({ metrics: { criticCalls: { max: m.critic, mean: m.critic }, reviewerCalls: { mean: 3 }, invalidVerdicts: m.invalid, blocks: m.blocks, minutes: m.minutes, costReported: m.cost, slicesDone: 3, jevCost: 0 } })) });

test("compare judges hypotheses from direction and range overlap", () => {
  const baseline = arm("v0.3.1", [{ critic: 17, invalid: 5, blocks: 0, minutes: 11.5, cost: 1.74 }, { critic: 20, invalid: 4, blocks: 1, minutes: 12, cost: 1.8 }, { critic: 27, invalid: 6, blocks: 0, minutes: 11, cost: 1.7 }]);
  const candidate = arm("v0.3.3", [{ critic: 8, invalid: 2, blocks: 0, minutes: 5.5, cost: 0.88 }, { critic: 10, invalid: 3, blocks: 0, minutes: 6, cost: 0.9 }, { critic: 9, invalid: 0, blocks: 0, minutes: 6.5, cost: 1.0 }]);
  const proposal = "### R-1\n- Hypothesis: `criticCalls.max: down` from 27\n### R-2\n- Hypothesis: `invalidVerdicts: zero` from 5\n### R-3\n- Hypothesis: `blocks: down` from 0\n";
  const c = compareArms(baseline, candidate, { proposal });
  const by = Object.fromEntries(c.hypotheses.map((h) => [h.key, h.verdict]));
  assert.equal(by["criticCalls.max"], "supported", "8..10 against 17..27, no overlap");
  assert.equal(by.invalidVerdicts, "not supported", "zero asked, candidate max is 3");
  assert.equal(by.blocks, "weak", "the candidate is all zero but one baseline run was zero too, so the ranges overlap");
  const rows = Object.fromEntries(c.rows.map((r) => [r.key, r]));
  assert.equal(rows.minutes.verdict, "supported");
  assert.equal(rows.invalidVerdicts.verdict, "supported", "0..3 against 4..6, no overlap");
});

test("compare: weak when ranges overlap, report-only metrics carry no verdict", () => {
  assert.equal(judge({ min: 4, max: 6, mean: 5 }, { min: 3, max: 5, mean: 4 }, "down"), "weak");
  assert.equal(judge({ min: 4, max: 6, mean: 5 }, { min: 1, max: 3, mean: 2 }, "down"), "supported");
  assert.equal(judge({ min: 4, max: 6, mean: 5 }, { min: 5, max: 7, mean: 6 }, "down"), "not supported");
  assert.equal(judge({ min: 0, max: 0, mean: 0 }, { min: 0, max: 0, mean: 0 }, "zero"), "already zero");
  assert.equal(judge({ min: 2, max: 5, mean: 3 }, { min: 0, max: 0, mean: 0 }, "zero"), "supported");
  assert.equal(judge(null, null, "down"), "report only");
  const text = renderComparison(compareArms(arm("a", [{ critic: 1, invalid: 0, blocks: 0, minutes: 1, cost: 1 }]), arm("b", [{ critic: 1, invalid: 0, blocks: 0, minutes: 1, cost: 1 }])));
  assert.match(text, /# Bench: b against a/);
  assert.match(text, /\| costRatio \|  \| n\/a \| n\/a \|  \| report only \|/);
});

test("loadArm reads a folder of recorded snapshots", () => {
  const a = loadArm(join(PLUGIN_ROOT, "docs", "runs"));
  assert.ok(a.runs.length >= 3);
  assert.ok(a.runs.every((r) => typeof r.metrics.blocks === "number"));
});
