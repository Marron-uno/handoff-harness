import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "./io.mjs";
import { pluginRoot } from "./paths.mjs";
import { validate } from "./schema.mjs";

let cache = null;
export function verdictSchema() {
  if (!cache) cache = readJson(join(pluginRoot(), "schemas", "verdict.schema.json"));
  return cache;
}

// Returns { ok, errors, stale, verdict }.
export function validateVerdict(cwd, verdict, { state, profile, workHash, role } = {}) {
  const errors = [];
  if (!verdict || typeof verdict !== "object") return { ok: false, errors: ["verdict file is not a JSON object"], stale: false };
  errors.push(...validate(verdictSchema(), verdict));
  if (errors.length) return { ok: false, errors, stale: false };

  let stale = false;
  if (workHash && verdict.diffHash !== workHash) { stale = true; errors.push(`diffHash ${verdict.diffHash} does not match the current work hash ${workHash}; the verdict judged a different change set`); }
  if (state) {
    if (verdict.goal !== state.goal.id) errors.push(`goal ${verdict.goal} is not the active goal ${state.goal.id}`);
    if (state.slice && verdict.slice !== state.slice.id) errors.push(`slice ${verdict.slice} is not the active slice ${state.slice.id}`);
    if (state.slice && verdict.attempt !== state.slice.attempt) errors.push(`attempt ${verdict.attempt} is not the active attempt ${state.slice.attempt}`);
  }
  if (role === "critic" && !["critic", "critic-strong"].includes(verdict.agent)) errors.push(`expected a critic verdict, got ${verdict.agent}`);
  if (role === "review" && !["reviewer", "reviewer-strong"].includes(verdict.agent)) errors.push(`expected a reviewer verdict, got ${verdict.agent}`);
  if (role === "spec") {
    if (verdict.agent !== "spec-reviewer") errors.push(`expected a spec-reviewer verdict, got ${verdict.agent}`);
    if (verdict.slice !== null) errors.push(`a spec verdict has slice null, got ${verdict.slice}`);
    if (state?.spec && verdict.attempt !== state.spec.attempt) errors.push(`attempt ${verdict.attempt} is not the active spec attempt ${state.spec.attempt}`);
    if (verdict.criteria.length) errors.push("a spec verdict leaves criteria empty; coverage goes in findings, criteria are judged after the code exists");
  }

  const blocks = verdict.findings.filter((f) => f.severity === "block");
  if (verdict.verdict === "pass" && blocks.length) errors.push(`verdict is pass but carries ${blocks.length} block finding(s): ${blocks.map((f) => f.id).join(", ")}`);
  if (verdict.verdict === "block" && !blocks.length) errors.push("verdict is block but no finding has severity block");
  const unmet = verdict.criteria.filter((c) => c.status === "unmet");
  if (verdict.verdict === "pass" && unmet.length) errors.push(`verdict is pass but criteria unmet: ${unmet.map((c) => c.id).join(", ")}`);

  // A guard-bearing slice is judged by probes, not by reading: a met criterion and a block or major
  // finding rest on evidence of type command or test, the probe or the test the judge ran.
  if (state?.preflight?.guardBearing && state.slice && verdict.slice === state.slice.id) {
    const probed = (list) => (list ?? []).some((e) => e.type === "command" || e.type === "test");
    for (const c of verdict.criteria) if (c.status === "met" && !probed(c.evidence)) errors.push(`${c.id}: on a guard-bearing slice a met criterion needs evidence of type command or test (a probe or a test you ran), not a file quote alone`);
    for (const f of verdict.findings) if ((f.severity === "block" || f.severity === "major") && !probed(f.evidence)) errors.push(`${f.id}: on a guard-bearing slice a ${f.severity} finding needs evidence of type command or test showing the input that gets through`);
  }

  const ids = new Set();
  for (const f of verdict.findings) {
    if (ids.has(f.id)) errors.push(`duplicate finding id ${f.id}`);
    ids.add(f.id);
    // A decision authority must name a decision that was made (`harness decide`, or an answered hold).
    const decision = /^decision:(D-\d+)$/.exec(f.authority ?? "");
    if (decision && state && !state.defaults.some((d) => d.id === decision[1])) errors.push(`${f.id}: authority ${f.authority} names no recorded decision; the packet lists the D-n ids that exist`);
    for (const e of f.evidence ?? []) errors.push(...checkEvidence(cwd, e, f.id));
  }
  for (const c of verdict.criteria) {
    for (const e of c.evidence ?? []) errors.push(...checkEvidence(cwd, e, c.id));
    if (c.status === "met" && !(c.evidence ?? []).length) errors.push(`${c.id}: a met criterion needs at least one evidence entry`);
  }
  return { ok: errors.length === 0, errors, stale, verdict };
}

const PATH_TYPES = new Set(["file", "test", "diff", "screenshot", "gif"]);
const QUOTE_TYPES = new Set(["command", "console", "network"]);
function checkEvidence(cwd, e, owner) {
  const errors = [];
  if (PATH_TYPES.has(e.type) && !e.path) errors.push(`${owner}: evidence of type ${e.type} needs a path`);
  if (QUOTE_TYPES.has(e.type) && !e.quote && !e.path) errors.push(`${owner}: evidence of type ${e.type} needs a quote or a path`);
  if (e.path && !existsSync(join(cwd, e.path)) && !existsSync(e.path)) errors.push(`${owner}: evidence path does not exist: ${e.path}`);
  if ((e.type === "screenshot" || e.type === "gif") && e.path && !e.host) errors.push(`${owner}: screenshot evidence needs the host it was captured on`);
  return errors;
}
