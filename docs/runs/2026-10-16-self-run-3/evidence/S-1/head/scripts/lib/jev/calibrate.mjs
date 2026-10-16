// Calibration: compares logged probabilities with recorded outcomes, per question, in bins.
// This is the table that sets the thresholds and that the README can publish.
import { readLines } from "../io.mjs";
import { harnessPaths } from "../paths.mjs";
import { readEvents } from "../events.mjs";

export function calibrate(cwd) {
  const answers = new Map();
  for (const line of readLines(harnessPaths(cwd).jev)) {
    try { const r = JSON.parse(line); if (r.ok && r.answers) answers.set(r.id, r); } catch { /* skip */ }
  }
  const outcomes = readEvents(cwd, (e) => e.type === "jev" && e.purpose === "outcome");
  const table = {};
  for (const o of outcomes) {
    const a = answers.get(o.answerId);
    if (!a) continue;
    for (const [name, ans] of Object.entries(a.answers)) {
      if (typeof ans.noul !== "number") continue;
      if (o.question && o.question !== name) continue;
      const bin = Math.min(9, Math.floor(ans.noul * 10));
      table[name] ??= Array.from({ length: 10 }, (_, i) => ({ bin: `${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)}`, n: 0, predicted: 0, observed: 0 }));
      const cell = table[name][bin];
      cell.n += 1; cell.predicted += ans.noul; cell.observed += o.actual ? 1 : 0;
    }
  }
  const report = {};
  for (const [name, bins] of Object.entries(table)) {
    report[name] = bins.filter((b) => b.n).map((b) => ({ bin: b.bin, n: b.n, meanPredicted: Number((b.predicted / b.n).toFixed(3)), observedRate: Number((b.observed / b.n).toFixed(3)) }));
  }
  return { answers: answers.size, outcomes: outcomes.length, report };
}

export function renderCalibration(result) {
  const lines = [`Jev calibration: ${result.answers} answers, ${result.outcomes} outcomes`, ""];
  for (const [name, rows] of Object.entries(result.report)) {
    lines.push(`## ${name}`, "", "| Bin | n | Mean predicted | Observed rate |", "|---|---|---|---|");
    for (const r of rows) lines.push(`| ${r.bin} | ${r.n} | ${r.meanPredicted} | ${r.observedRate} |`);
    lines.push("");
  }
  return lines.join("\n");
}
