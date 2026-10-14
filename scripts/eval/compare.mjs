#!/usr/bin/env node
// Compares two bench arms metric by metric and checks a proposal's hypotheses against them.
// usage: node scripts/eval/compare.mjs <baseline dir> <candidate dir> [--proposal <file>] [--json]
// A dir is a bench label folder with summary.json, or any folder of run snapshots (each a
// subfolder with events.jsonl and state.json).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { runMetrics, metricValue, METRIC_DIRECTIONS } from "../lib/metrics.mjs";

export function loadArm(dir) {
  const summary = join(dir, "summary.json");
  if (existsSync(summary)) return JSON.parse(readFileSync(summary, "utf8"));
  const runs = readdirSync(dir).map((n) => join(dir, n)).filter((p) => statSync(p).isDirectory()).map((p) => existsSync(join(p, "snapshot")) ? join(p, "snapshot") : p).filter((p) => existsSync(join(p, "events.jsonl")));
  return { label: dir, runs: runs.map((p) => ({ dir: p, metrics: runMetrics(p) })) };
}

function stats(values) {
  const v = values.filter((x) => typeof x === "number");
  if (!v.length) return null;
  return { n: v.length, min: Math.min(...v), max: Math.max(...v), mean: Number((v.reduce((s, x) => s + x, 0) / v.length).toFixed(3)) };
}

// Supported: moved the hypothesized way and the ranges do not overlap. Weak: moved that way but
// the ranges overlap. Not supported: moved the wrong way or not at all. Three runs per arm see
// large effects, not small ones; the ranges are the honesty.
export function judge(base, cand, direction) {
  if (!base || !cand || !direction) return "report only";
  const delta = cand.mean - base.mean;
  const moved = direction === "down" ? delta < 0 : direction === "zero" ? cand.max === 0 && base.mean > 0 : delta > 0;
  if (!moved) return direction === "zero" && cand.max === 0 && base.mean === 0 ? "already zero" : "not supported";
  const overlap = cand.min <= base.max && base.min <= cand.max;
  return overlap ? "weak" : "supported";
}

export function compareArms(baseline, candidate, { proposal = null } = {}) {
  const keys = Object.keys(METRIC_DIRECTIONS);
  const rows = keys.map((key) => {
    const b = stats(baseline.runs.map((r) => metricValue(r.metrics, key)));
    const c = stats(candidate.runs.map((r) => metricValue(r.metrics, key)));
    const direction = METRIC_DIRECTIONS[key];
    return { key, direction, baseline: b, candidate: c, delta: b && c ? Number((c.mean - b.mean).toFixed(3)) : null, verdict: direction ? judge(b, c, direction) : "report only" };
  });
  const hypotheses = [];
  if (proposal) {
    for (const m of proposal.matchAll(/Hypothesis:\s*`([\w.]+):\s*(down|up|zero)`/g)) {
      const key = m[1], direction = m[2];
      const b = stats(baseline.runs.map((r) => metricValue(r.metrics, key)));
      const c = stats(candidate.runs.map((r) => metricValue(r.metrics, key)));
      hypotheses.push({ key, direction, baseline: b, candidate: c, verdict: judge(b, c, direction) });
    }
  }
  return { baseline: baseline.label, candidate: candidate.label, runs: { baseline: baseline.runs.length, candidate: candidate.runs.length }, rows, hypotheses };
}

export function renderComparison(c) {
  const f = (s) => (s ? `${s.min}..${s.max} (${s.mean})` : "n/a");
  const L = [`# Bench: ${c.candidate} against ${c.baseline}`, "", `Runs: ${c.runs.baseline} baseline, ${c.runs.candidate} candidate. A range is min..max with the mean in brackets.`, "", "| Metric | Better | Baseline | Candidate | Delta | Verdict |", "|---|---|---|---|---|---|"];
  for (const r of c.rows) L.push(`| ${r.key} | ${r.direction ?? ""} | ${f(r.baseline)} | ${f(r.candidate)} | ${r.delta ?? ""} | ${r.verdict} |`);
  if (c.hypotheses.length) {
    L.push("", "## Hypotheses", "", "| Metric | Direction | Baseline | Candidate | Verdict |", "|---|---|---|---|---|");
    for (const h of c.hypotheses) L.push(`| ${h.key} | ${h.direction} | ${f(h.baseline)} | ${f(h.candidate)} | ${h.verdict} |`);
  }
  return L.join("\n") + "\n";
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
  const dirs = args.filter((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1].startsWith("--")));
  if (dirs.length < 2) { console.error("usage: compare.mjs <baseline dir> <candidate dir> [--proposal <file>] [--json]"); process.exit(1); }
  const proposal = flag("proposal") ? readFileSync(flag("proposal"), "utf8") : null;
  const c = compareArms(loadArm(resolve(dirs[0])), loadArm(resolve(dirs[1])), { proposal });
  process.stdout.write(args.includes("--json") ? JSON.stringify(c, null, 2) + "\n" : renderComparison(c));
}
