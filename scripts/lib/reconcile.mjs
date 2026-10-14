import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeJsonAtomic, nowIso } from "./io.mjs";
import { harnessPaths, pluginRoot } from "./paths.mjs";
import { git, workHash } from "./git.mjs";
import { validate } from "./schema.mjs";
import { appendEvent } from "./events.mjs";

const SKIP_DIRS = new Set([".git", "node_modules", ".harness", "dist", "build", ".next", "coverage"]);

function walk(dir, out = [], rel = "") {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out, r);
    else if (st.size < 512 * 1024) out.push(r);
  }
  return out;
}

// Deterministic evidence: an inventory id or criterion id mentioned in a commit subject,
// a source or test file, a verdict with the criterion met, or an evidence file.
export function prepareReconcile(cwd, state) {
  const p = harnessPaths(cwd);
  const inventory = readJson(p.inventory);
  const files = walk(cwd);
  const contents = new Map(files.map((f) => [f, (() => { try { return readFileSync(join(cwd, f), "utf8"); } catch { return ""; } })()]));
  const log = git(cwd, ["log", "--pretty=%s%n%b", "-n", "500"]).out;
  const met = new Set();
  if (existsSync(p.verdicts)) {
    for (const name of readdirSync(p.verdicts)) {
      if (!name.endsWith(".json") || name.startsWith("reconcile")) continue;
      const v = readJson(join(p.verdicts, name), null);
      if (v?.verdict === "pass") for (const c of v.criteria ?? []) if (c.status === "met") met.add(c.id);
    }
  }
  const items = inventory.items.map((item) => {
    const ids = [item.id, ...item.criteria.map((c) => c.id)];
    const evidence = [];
    for (const id of ids) {
      if (log.includes(id)) evidence.push({ type: "commit", quote: id });
      for (const [f, text] of contents) if (text.includes(id)) evidence.push({ type: "file", path: f, quote: id });
    }
    const allMet = item.criteria.length > 0 && item.criteria.every((c) => met.has(c.id));
    if (allMet) evidence.push({ type: "verdict", quote: item.criteria.map((c) => c.id).join(",") });
    const bucket = allMet ? "deterministic" : "model";
    return { id: item.id, kind: item.kind, title: item.title, criteria: item.criteria, ui: item.ui, inScope: item.inScope ?? true, evidence: evidence.slice(0, 20), bucket, decided: allMet ? "done" : null };
  });
  const out = { goal: state.goal.id, diffHash: workHash(cwd), at: nowIso(), items };
  writeJsonAtomic(join(p.dir, "reconcile-input.json"), out);
  return out;
}

export function loadReconcile(cwd, state, profile, path = join(harnessPaths(cwd).verdicts, "reconcile.json")) {
  const schema = readJson(join(pluginRoot(), "schemas", "reconcile.schema.json"));
  if (!existsSync(path)) return { ok: false, errors: [`missing ${path}`] };
  const result = readJson(path);
  const errors = validate(schema, result);
  const wh = workHash(cwd);
  if (result.diffHash !== wh) errors.push(`diffHash ${result.diffHash} is stale, current ${wh}`);
  if (errors.length) return { ok: false, errors };
  const inputPath = join(harnessPaths(cwd).dir, "reconcile-input.json");
  const input = existsSync(inputPath) ? readJson(inputPath) : { items: [] };
  const decided = new Map(input.items.filter((i) => i.decided).map((i) => [i.id, i.decided]));
  const statuses = new Map(result.items.map((i) => [i.id, i.status]));
  for (const [id, s] of decided) if (!statuses.has(id)) statuses.set(id, s);
  const missing = [...statuses.values()].filter((s) => s === "missing" || s === "partial").length;
  let nextId = state.slices.reduce((m, s) => Math.max(m, Number(s.id.slice(2))), 0) + 1;
  const added = [];
  for (const ns of result.newSlices) {
    if (state.slices.length >= state.goal.budget.maxSlices) { appendEvent(cwd, { type: "note", text: `slice budget reached, dropped proposed slice "${ns.title}"` }); break; }
    const id = `S-${nextId++}`;
    state.slices.push({ id, title: ns.title, status: "pending", dependsOn: ns.dependsOn ?? [], criteria: ns.criteria, paths: ns.paths, attempts: 0, ui: ns.ui, diffHash: null, commit: null, origin: "reconcile" });
    added.push(id);
  }
  state.reconcile = { diffHash: wh, at: nowIso(), missing, path };
  state.reconcilePasses = (state.reconcilePasses ?? 0) + 1;
  appendEvent(cwd, { type: "stage", from: "reconcile", to: "reconcile", reason: "reconcile_loaded", missing, added, pass: state.reconcilePasses });
  return { ok: true, missing, added, statuses: Object.fromEntries(statuses) };
}
