// Verdict plausibility gate. Jev answers yes/no questions about each finding and about the
// verdict as a whole. Low probabilities route the verdict back to the judge. It never grants a pass.
import { askJev, noul, choice } from "./client.mjs";
import { loadQuestions } from "./questions.mjs";
import { appendEvent } from "../events.mjs";

export async function jevVerdictGate(cwd, verdict, { state, profile, fetchImpl, env } = {}) {
  const q = loadQuestions(profile);
  const th = profile.jev.thresholds;
  const reasons = [];
  const details = { findings: {}, verdict: null, skipped: [] };
  const opts = { profile, fetchImpl, env };

  for (const f of verdict.findings) {
    const r = await askJev(cwd, { finding: f, slice: verdict.slice, criteriaUnderReview: verdict.criteria }, q.verdict.per_finding, { ...opts, purpose: `verdict:finding:${f.id}` });
    if (!r.ok) { details.skipped.push(r.reason); continue; }
    const ev = noul(r.answers, "evidence_supports");
    const sev = noul(r.answers, "severity_consistent");
    const kind = choice(r.answers, "kind");
    details.findings[f.id] = { answerId: r.id, evidence_supports: ev, severity_consistent: sev, kind };
    if (ev !== null && ev < th.evidence_supports) reasons.push(`${f.id}: evidence may not support the issue (p=${ev.toFixed(2)})`);
    if (sev !== null && sev < th.severity_consistent) reasons.push(`${f.id}: severity may not match the impact (p=${sev.toFixed(2)})`);
  }
  const r = await askJev(cwd, { verdict: verdict.verdict, summary: verdict.summary, findings: verdict.findings.map((f) => ({ id: f.id, severity: f.severity, issue: f.issue })), criteria: verdict.criteria }, q.verdict.per_verdict, { ...opts, purpose: "verdict:summary" });
  if (r.ok) {
    const sc = noul(r.answers, "summary_consistent");
    details.verdict = { answerId: r.id, summary_consistent: sc };
    if (sc !== null && sc < th.summary_consistent) reasons.push(`summary may contradict the findings (p=${sc.toFixed(2)})`);
  } else details.skipped.push(r.reason);

  const route = reasons.length ? "re-review" : "accept";
  appendEvent(cwd, { type: "jev", purpose: "verdict:gate", route, reasons, slice: verdict.slice, agent: verdict.agent, skipped: details.skipped.length });
  return { route, reasons, details, skipped: details.skipped.length > 0 && Object.keys(details.findings).length === 0 && !details.verdict };
}
