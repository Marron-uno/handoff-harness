import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpDir, write } from "./helpers.mjs";
import { bundleSizeCheck } from "../scripts/lib/preflight.mjs";

const profile = (bundleBytes) => ({ budgets: { bundleBytes } });

test("a file over its cap fails and the details name file, size and cap", () => {
  const dir = tmpDir();
  write(dir, "dist/app.js", "x".repeat(1001));
  const r = bundleSizeCheck(dir, profile({ "dist/app.js": 1000 }));
  assert.equal(r.status, "fail");
  assert.match(r.details, /dist\/app\.js/);
  assert.match(r.details, /1001/);
  assert.match(r.details, /1000/);
});

test("a file at its cap passes", () => {
  const dir = tmpDir();
  write(dir, "dist/app.js", "x".repeat(1000));
  assert.equal(bundleSizeCheck(dir, profile({ "dist/app.js": 1000 })).status, "pass");
});

test("an empty or absent map is skipped", () => {
  const dir = tmpDir();
  assert.equal(bundleSizeCheck(dir, profile({})).status, "skip");
  assert.equal(bundleSizeCheck(dir, { budgets: {} }).status, "skip");
});

test("a missing file is skipped, listed, and does not hide another file over its cap", () => {
  const dir = tmpDir();
  write(dir, "dist/big.js", "x".repeat(10));
  const only = bundleSizeCheck(dir, profile({ "dist/gone.js": 5 }));
  assert.equal(only.status, "skip");
  assert.match(only.details, /dist\/gone\.js/);
  const both = bundleSizeCheck(dir, profile({ "dist/gone.js": 5, "dist/big.js": 5 }));
  assert.equal(both.status, "fail");
  assert.match(both.details, /dist\/gone\.js/);
});
