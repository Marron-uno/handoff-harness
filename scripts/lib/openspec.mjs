// OpenSpec change support: the change folder a goal builds from, its delta specs and tasks,
// the pinned validator, and the deterministic coverage check between the change and the
// inventory. Nothing here calls a model. The inventory stays the authority for ids (I-n, C-n);
// the change cites them, and this module checks that every in-scope criterion is cited and
// every task cites an id, so the spec reviewer judges meaning, not bookkeeping.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { readJson } from "./io.mjs";
import { harnessPaths, pluginRoot } from "./paths.mjs";
import { git, headSha } from "./git.mjs";

export const DELTA_OPS = ["ADDED", "MODIFIED", "REMOVED", "RENAMED"];
const ID_RE = /\b[IC]-\d+\b/g;

// openspec change names are kebab-case; the goal id keeps two goals from colliding.
export function changeSlug(goalId, sentence) {
  const s = String(sentence).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "");
  return `${goalId.toLowerCase()}-${s || "goal"}`;
}

export function changeRel(state) { return `openspec/changes/${state.spec.change}`; }
export function changeDir(cwd, state) { return join(cwd, changeRel(state)); }

export function openspecBin(cwd) {
  return [join(cwd, "node_modules", ".bin", "openspec"), join(pluginRoot(), "node_modules", ".bin", "openspec")].find(existsSync) ?? null;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

export function deltaFiles(dir) { return walk(join(dir, "specs")).sort(); }

// Parses a delta spec into [{ op, requirements: [{ name, text, scenarios: [{ name, when, then, raw }] }] }].
// The format is OpenSpec's: `## ADDED Requirements`, `### Requirement: <name>`, a SHALL sentence,
// `#### Scenario: <name>` with `- **WHEN**` and `- **THEN**` bullets.
export function parseDelta(markdown) {
  const ops = [];
  let op = null, req = null, sc = null;
  for (const raw of String(markdown).split(/\r?\n/)) {
    const line = raw.trimEnd();
    let m;
    if ((m = line.match(/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i))) { op = { op: m[1].toUpperCase(), requirements: [] }; ops.push(op); req = null; sc = null; continue; }
    if ((m = line.match(/^###\s+Requirement:\s*(.+?)\s*$/))) {
      if (!op) { op = { op: "UNKNOWN", requirements: [] }; ops.push(op); }
      req = { name: m[1], text: "", scenarios: [] }; op.requirements.push(req); sc = null; continue;
    }
    if ((m = line.match(/^####\s+Scenario:\s*(.+?)\s*$/))) { if (req) { sc = { name: m[1], when: "", then: "", raw: "" }; req.scenarios.push(sc); } continue; }
    if (line.startsWith("## ") || line.startsWith("# ")) { op = null; req = null; sc = null; continue; }
    if (sc) {
      sc.raw += (sc.raw ? "\n" : "") + line;
      if ((m = line.match(/^-\s+\*\*WHEN\*\*\s*(.*)$/i))) sc.when = m[1];
      else if ((m = line.match(/^-\s+\*\*THEN\*\*\s*(.*)$/i))) sc.then = m[1];
      continue;
    }
    if (req && line.trim()) req.text += (req.text ? " " : "") + line.trim();
  }
  return ops;
}

// Parses tasks.md into [{ id, text, done, line }]. A task line is `- [ ] 1.2 text`; a task
// without a numeric id gets id null so the check can name it.
export function parseTasks(markdown) {
  const tasks = [];
  String(markdown).split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^\s*-\s+\[( |x|X)\]\s+(.*)$/);
    if (!m) return;
    const rest = m[2].trim();
    const id = rest.match(/^(\d+(?:\.\d+)*)\s+(.*)$/);
    tasks.push({ id: id ? id[1] : null, text: id ? id[2].trim() : rest, done: m[1] !== " ", line: i + 1 });
  });
  return tasks;
}

// Ticks the named tasks. Returns the new text and the ids it changed.
export function tickTasks(markdown, ids) {
  const want = new Set(ids);
  const ticked = [];
  const text = String(markdown).split(/\r?\n/).map((line) => {
    const m = line.match(/^(\s*-\s+\[) (\]\s+)(\d+(?:\.\d+)*)(\s.*|)$/);
    if (m && want.has(m[3])) { ticked.push(m[3]); return `${m[1]}x${m[2]}${m[3]}${m[4]}`; }
    return line;
  }).join("\n");
  return { text, ticked };
}

export function citedIds(text) { return new Set(String(text).match(ID_RE) ?? []); }

// `openspec validate <change> --strict --json`. Skipped when the binary is not installed.
export function runValidate(cwd, change) {
  const bin = openspecBin(cwd);
  if (!bin) return { status: "skip", details: "openspec binary not installed (npm install in the plugin or project)", issues: [] };
  const r = spawnSync(bin, ["validate", change, "--strict", "--json", "--no-interactive"], { cwd, encoding: "utf8", timeout: 60000 });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch { parsed = null; }
  const item = parsed?.items?.find((i) => i.id === change) ?? parsed?.items?.[0] ?? null;
  const issues = item?.issues ?? [];
  if (r.status === 0 && (!item || item.valid)) return { status: "pass", details: `change ${change} is valid`, issues };
  const details = issues.length ? issues.map((i) => `[${i.level}] ${i.path}: ${i.message}`).join("; ") : ((r.stdout || "") + (r.stderr || "")).trim().slice(-800);
  return { status: "fail", details, issues };
}

// The deterministic check. Returns { ok, problems, ... } and never throws on a missing file.
export function specCheck(cwd, state) {
  const problems = [];
  const change = state.spec.change;
  const dir = changeDir(cwd, state);
  const rel = changeRel(state);
  const result = { ok: false, change, dir: rel, problems, validate: null, requirements: 0, scenarios: 0, coverage: null, tasks: [] };
  if (!existsSync(join(cwd, "openspec", "config.yaml"))) problems.push("openspec/config.yaml is missing: create it with the line `schema: spec-driven`");
  if (!existsSync(dir)) { problems.push(`${rel}/ does not exist (proposal.md, specs/<capability>/spec.md, tasks.md)`); return result; }

  const proposalPath = join(dir, "proposal.md");
  const tasksPath = join(dir, "tasks.md");
  if (!existsSync(proposalPath)) problems.push(`${rel}/proposal.md is missing`);
  const deltas = deltaFiles(dir);
  if (!deltas.length) problems.push(`${rel}/specs/<capability>/spec.md is missing: at least one delta spec`);
  const texts = [];
  for (const f of deltas) {
    const text = readFileSync(f, "utf8");
    texts.push(text);
    const frel = relative(cwd, f);
    const ops = parseDelta(text);
    if (!ops.length || ops.every((o) => o.op === "UNKNOWN")) problems.push(`${frel}: no delta header (## ADDED Requirements, ## MODIFIED Requirements, ## REMOVED Requirements or ## RENAMED Requirements)`);
    for (const o of ops) for (const r of o.requirements) {
      result.requirements += 1;
      result.scenarios += r.scenarios.length;
      if (o.op === "REMOVED") continue;
      if (!r.scenarios.length) problems.push(`${frel}: requirement "${r.name}" has no #### Scenario`);
      if (!/\b(SHALL|MUST)\b/.test(r.text)) problems.push(`${frel}: requirement "${r.name}" needs a SHALL or MUST sentence`);
      for (const s of r.scenarios) if (!s.when || !s.then) problems.push(`${frel}: scenario "${s.name}" needs **WHEN** and **THEN** bullets`);
    }
  }
  if (!problems.some((p) => p.includes("does not exist"))) {
    result.validate = runValidate(cwd, change);
    if (result.validate.status === "fail") problems.push(`openspec validate --strict: ${result.validate.details}`);
  }

  let tasksText = "";
  if (!existsSync(tasksPath)) problems.push(`${rel}/tasks.md is missing`);
  else {
    tasksText = readFileSync(tasksPath, "utf8");
    result.tasks = parseTasks(tasksText);
    if (!result.tasks.length) problems.push(`${rel}/tasks.md has no task lines (\`- [ ] 1.1 text (I-n, C-n)\`)`);
    const seen = new Set();
    for (const t of result.tasks) {
      if (!t.id) { problems.push(`${rel}/tasks.md line ${t.line}: task has no id (write \`- [ ] 1.1 text\`)`); continue; }
      if (seen.has(t.id)) problems.push(`${rel}/tasks.md: task id ${t.id} appears twice`);
      seen.add(t.id);
    }
  }

  const inventoryPath = harnessPaths(cwd).inventory;
  const inventory = existsSync(inventoryPath) ? readJson(inventoryPath, null) : null;
  if (!inventory?.items) problems.push("no .harness/inventory.json yet, so coverage is not checked");
  else {
    const proposal = existsSync(proposalPath) ? readFileSync(proposalPath, "utf8") : "";
    const cited = citedIds([proposal, ...texts, tasksText].join("\n"));
    const known = new Set();
    const inScope = [];
    for (const item of inventory.items) {
      known.add(item.id);
      for (const c of item.criteria) { known.add(c.id); if (item.inScope !== false) inScope.push(c.id); }
    }
    const uncited = inScope.filter((id) => !cited.has(id));
    const unknown = [...cited].filter((id) => !known.has(id)).sort();
    result.coverage = { criteria: inScope.length, cited: inScope.length - uncited.length, uncited, unknown };
    if (uncited.length) problems.push(`in-scope criteria cited nowhere in the change: ${uncited.join(", ")} (cite them in a scenario or a task)`);
    if (unknown.length) problems.push(`ids cited in the change but absent from the inventory: ${unknown.join(", ")}`);
    for (const t of result.tasks) {
      if (!t.id) continue;
      if (!citedIds(t.text).size) problems.push(`${rel}/tasks.md task ${t.id} cites no inventory id`);
    }
  }
  result.ok = problems.length === 0;
  return result;
}

// Every task belongs to exactly one slice, or the goal predicate can never be satisfied.
export function planTaskProblems(plan, tasks) {
  const ids = new Set(tasks.map((t) => t.id).filter(Boolean));
  const owner = new Map();
  const problems = [];
  for (const s of plan.slices ?? []) {
    for (const t of s.tasks ?? []) {
      if (!ids.has(t)) problems.push(`slice ${s.id} names task ${t}, which is not in tasks.md`);
      if (owner.has(t)) problems.push(`task ${t} belongs to both ${owner.get(t)} and ${s.id}`);
      else owner.set(t, s.id);
    }
  }
  const orphans = [...ids].filter((id) => !owner.has(id));
  if (orphans.length) problems.push(`tasks owned by no slice: ${orphans.join(", ")} (list each under one slice's "tasks")`);
  return problems;
}

export function summarize(check) {
  const cov = check.coverage ? `${check.coverage.cited}/${check.coverage.criteria} criteria cited` : "coverage unchecked";
  return `${check.requirements} requirement(s), ${check.scenarios} scenario(s), ${check.tasks.length} task(s), ${cov}, validate ${check.validate?.status ?? "skip"}`;
}

// Task status against the plan: which tasks are open and which slice owns each.
export function taskStatus(cwd, state) {
  const path = join(changeDir(cwd, state), "tasks.md");
  if (!existsSync(path)) return { path, exists: false, total: 0, done: 0, open: [] };
  const tasks = parseTasks(readFileSync(path, "utf8"));
  const owner = new Map();
  for (const s of state.slices) for (const t of s.tasks ?? []) owner.set(t, s);
  const open = tasks.filter((t) => !t.done).map((t) => ({ id: t.id, text: t.text, slice: owner.get(t.id)?.id ?? null, sliceStatus: owner.get(t.id)?.status ?? null }));
  return { path, exists: true, total: tasks.length, done: tasks.filter((t) => t.done).length, open };
}

// `harness record` ticks the slice's tasks before staging, so the tick lands in the slice commit.
export function tickSliceTasks(cwd, state, slice) {
  const ids = slice.tasks ?? [];
  if (!state.spec || !ids.length) return { ticked: [], file: null };
  const path = join(changeDir(cwd, state), "tasks.md");
  if (!existsSync(path)) return { ticked: [], file: null };
  const { text, ticked } = tickTasks(readFileSync(path, "utf8"), ids);
  if (ticked.length) writeFileSync(path, text);
  return { ticked, file: ticked.length ? `${changeRel(state)}/tasks.md` : null };
}

// Approval lands the reviewed change in the goal branch, so the first slice starts clean and
// preflight's slice_paths check never sees spec files as stray edits.
export function commitChange(cwd, state) {
  const candidates = [changeRel(state), "openspec/config.yaml"].filter((p) => existsSync(join(cwd, p)) && git(cwd, ["status", "--porcelain", "--", p]).out !== "");
  if (!candidates.length) return { committed: null, reason: "nothing to commit" };
  const add = git(cwd, ["add", "--", ...candidates]);
  if (add.code !== 0) return { committed: null, reason: add.err };
  const body = `Goal ${state.goal.id}: ${state.goal.sentence}\nSpec verdict: ${state.spec.verdict ?? "none"}`;
  const c = git(cwd, ["commit", "-q", "-m", `spec: ${state.spec.change} (${state.goal.id})`, "-m", body, "--", ...candidates]);
  return c.code === 0 ? { committed: headSha(cwd), reason: "" } : { committed: null, reason: c.err };
}
