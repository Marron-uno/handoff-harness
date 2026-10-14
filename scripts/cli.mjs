#!/usr/bin/env node
// harness CLI. Every command prints one JSON object so the model and tests parse the same thing.
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeJsonAtomic, nowIso } from "./lib/io.mjs";
import { harnessPaths, hasHarness, pluginRoot } from "./lib/paths.mjs";
import { newState, loadState, saveState, transition, currentSlice, RESTING } from "./lib/state.mjs";
import { loadProfile } from "./lib/profile.mjs";
import { git, isRepo, currentBranch, defaultBranch, changedFiles, workHash, headSha, hasCommits } from "./lib/git.mjs";
import { appendEvent, readEvents } from "./lib/events.mjs";
import { runPreflight } from "./lib/preflight.mjs";
import { prepareReconcile, loadReconcile } from "./lib/reconcile.mjs";
import { renderReport } from "./lib/report.mjs";
import { goalCheck } from "./lib/goal-check.mjs";
import { briefFor, loadPlanIntoState } from "./lib/machine.mjs";
import { validateVerdict } from "./lib/verdict.mjs";
import { guardChecks } from "./lib/guards/index.mjs";

const cwd = process.env.HARNESS_CWD || process.cwd();
const argv = process.argv.slice(2);

function parse(args) {
  const flags = {}; const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) { flags[key] = flags[key] === undefined ? next : [].concat(flags[key], next); i++; }
      else flags[key] = true;
    } else rest.push(a);
  }
  return { flags, rest };
}

function out(obj, code = 0) { process.stdout.write(JSON.stringify(obj, null, 2) + "\n"); process.exit(code); }
function fail(message, extra = {}) { out({ ok: false, error: message, ...extra }, 1); }

function requireState() {
  if (!hasHarness(cwd)) fail("no .harness/state.json here; run `harness init` then `harness goal new`");
  return loadState(cwd);
}

const GITIGNORE_BLOCK = [
  "# handoff-harness run artifacts (profile, lessons, proposals and reports are kept)",
  ".harness/*",
  "!.harness/profile.json",
  "!.harness/lessons.md",
  "!.harness/proposals/",
  "!.harness/reports/",
];

const commands = {
  init() {
    if (!isRepo(cwd)) fail("not a git repository; run git init first");
    const p = harnessPaths(cwd);
    mkdirSync(p.verdicts, { recursive: true });
    mkdirSync(p.evidence, { recursive: true });
    mkdirSync(join(p.dir, "proposals"), { recursive: true });
    if (!existsSync(p.profile)) writeJsonAtomic(p.profile, { version: 1, checks: [], hosts: { preview: [], prod: [] } });
    writeFileSync(p.pluginRoot, pluginRoot() + "\n");
    const gi = join(cwd, ".gitignore");
    const current = existsSync(gi) ? readFileSync(gi, "utf8") : "";
    if (!current.includes(".harness/*")) appendFileSync(gi, (current.endsWith("\n") || !current ? "" : "\n") + GITIGNORE_BLOCK.join("\n") + "\n");
    // Commit the harness's own files so they never show up inside a slice diff.
    let committed = null;
    if (hasCommits(cwd)) {
      const own = [".gitignore", ".harness/profile.json"].filter((f) => git(cwd, ["status", "--porcelain", "--", f]).out !== "");
      if (own.length) {
        git(cwd, ["add", "--", ...own]);
        const c = git(cwd, ["commit", "-q", "-m", "chore: handoff-harness init", "--", ...own]);
        committed = c.code === 0 ? headSha(cwd) : null;
      }
    }
    out({ ok: true, harnessDir: p.dir, profile: p.profile, pluginRoot: pluginRoot(), committed });
  },

  hash() { out({ ok: true, diffHash: workHash(cwd), head: headSha(cwd), changedFiles: changedFiles(cwd) }); },

  goal(sub, { flags }) {
    if (sub === "new") {
      if (!flags.sentence) fail("--sentence is required");
      if (!isRepo(cwd) || !hasCommits(cwd)) fail("needs a git repository with at least one commit");
      if (!existsSync(harnessPaths(cwd).profile)) commandsInitQuiet();
      if (hasHarness(cwd)) {
        const old = loadState(cwd);
        if (!RESTING.has(old.stage)) fail(`goal ${old.goal.id} is in stage ${old.stage}; finish or abort it first`);
      }
      const prior = readEvents(cwd, (e) => e.type === "goal" && e.action === "new").length;
      const id = `G-${prior + 1}`;
      const base = currentBranch(cwd);
      const def = defaultBranch(cwd);
      const branch = `goal/${id}`;
      if (base !== branch) {
        const r = git(cwd, ["checkout", "-q", "-b", branch]);
        if (r.code !== 0) fail(`could not create branch ${branch}: ${r.err}`);
      }
      const sources = [].concat(flags.source ?? []);
      const state = newState({
        id, sentence: String(flags.sentence), mode: flags.mode === "feature" ? "feature" : "handoff", sources,
        budget: { usd: Number(flags["budget-usd"] ?? 20), minutes: Number(flags["budget-minutes"] ?? 120), maxSlices: Number(flags["max-slices"] ?? 20) },
        autoApprove: Boolean(flags["auto-approve"]), environments: { prod: Boolean(flags.prod), preview: flags.preview ?? null }, jev: Boolean(flags.jev),
        branch, defaultBranch: def,
      });
      // Pre-populate verdicts/evidence folders and clear prior per-goal artifacts.
      const p = harnessPaths(cwd);
      for (const f of [p.plan, p.inventory, p.goalCard, p.preflight, p.report, join(p.dir, "reconcile-input.json")]) {
        if (existsSync(f)) { writeFileSync(f + ".prev", readFileSync(f)); rmSync(f, { force: true }); }
      }
      saveState(cwd, state);
      appendEvent(cwd, { type: "goal", action: "new", id, sentence: state.goal.sentence, mode: state.goal.mode, sources, budget: state.goal.budget, branch });
      out({ ok: true, goal: state.goal, branch, next: "Intake: write .harness/inventory.json, .harness/plan.json and .harness/goal-card.md, then stop." });
    }
    if (sub === "approve") {
      const state = requireState();
      if (state.stage !== "awaiting_approval") fail(`stage is ${state.stage}, not awaiting_approval`);
      const errs = loadPlanIntoState(cwd, state, loadProfile(cwd));
      if (errs.length) fail("plan.json invalid", { errors: errs });
      state.goal.approvedAt = nowIso();
      transition(cwd, state, "planning", "approved");
      saveState(cwd, state);
      appendEvent(cwd, { type: "goal", action: "approved", id: state.goal.id });
      out({ ok: true, stage: state.stage, slices: state.slices.length, holds: state.holds.length, next: "Stop now; the Stop hook starts the first slice." });
    }
    if (sub === "status") {
      const state = requireState();
      out({ ok: true, goal: state.goal.id, sentence: state.goal.sentence, stage: state.stage, slice: state.slice, slices: state.slices.map((s) => ({ id: s.id, status: s.status, attempts: s.attempts })), review: state.review, holds: state.holds, halt: state.halt, guards: state.guards });
    }
    if (sub === "check") {
      const state = requireState();
      out({ ok: true, ...goalCheck(cwd, state, loadProfile(cwd)) });
    }
    if (sub === "budget") {
      const state = requireState();
      if (flags.usd) state.goal.budget.usd = Number(flags.usd);
      if (flags.minutes) state.goal.budget.minutes = Number(flags.minutes);
      if (flags["max-slices"]) state.goal.budget.maxSlices = Number(flags["max-slices"]);
      if (state.stage === "budget_exceeded") transition(cwd, state, state.slice ? "building" : "planning", "budget_raised");
      saveState(cwd, state);
      appendEvent(cwd, { type: "goal", action: "budget", budget: state.goal.budget });
      out({ ok: true, budget: state.goal.budget, stage: state.stage });
    }
    if (sub === "abort") {
      const state = requireState();
      transition(cwd, state, "halted", "aborted");
      state.halt = { reason: flags.reason ?? "aborted by human", at: nowIso(), code: "aborted" };
      saveState(cwd, state);
      appendEvent(cwd, { type: "halt", code: "aborted", reason: state.halt.reason });
      out({ ok: true, stage: state.stage });
    }
    fail(`unknown goal subcommand ${sub}`);
  },

  slice(sub, { flags }) {
    const state = requireState();
    if (sub === "done") {
      if (state.stage !== "building" || !state.slice) fail(`stage is ${state.stage}; slice done only applies while building`);
      state.slice.buildDone = true;
      saveState(cwd, state);
      appendEvent(cwd, { type: "note", slice: state.slice.id, text: "build declared done", diffHash: workHash(cwd), files: changedFiles(cwd).length });
      out({ ok: true, slice: state.slice.id, attempt: state.slice.attempt, next: "Stop now; the Stop hook moves to preflight." });
    }
    if (sub === "skip") {
      const slice = currentSlice(state) ?? state.slices.find((s) => s.id === flags.id);
      if (!slice) fail("no active slice and no --id given");
      slice.status = "skipped";
      if (state.slice?.id === slice.id) state.slice = null;
      if (!RESTING.has(state.stage) || state.stage === "awaiting_human") transition(cwd, state, "record", "slice_skipped");
      saveState(cwd, state);
      appendEvent(cwd, { type: "note", slice: slice.id, text: `slice skipped: ${flags.reason ?? "no reason given"}` });
      out({ ok: true, skipped: slice.id, next: "Stop now; the Stop hook advances." });
    }
    fail(`unknown slice subcommand ${sub}`);
  },

  preflight() {
    const state = requireState();
    if (!["preflight", "building"].includes(state.stage)) fail(`stage is ${state.stage}; preflight runs in the preflight stage`);
    const profile = loadProfile(cwd);
    const result = runPreflight(cwd, state, profile, { extraChecks: guardChecks(profile) });
    saveState(cwd, state);
    out({ ok: result.passed, passed: result.passed, diffHash: result.diffHash, checks: result.checks.map((c) => ({ id: c.id, status: c.status, details: c.details })), next: result.passed ? "Stop now; the Stop hook starts the critic." : "Stop now; the Stop hook sends the failures back to build." });
  },

  record() {
    const state = requireState();
    if (state.stage !== "record" || !state.slice) fail(`stage is ${state.stage}; record runs in the record stage`);
    const slice = currentSlice(state);
    const files = changedFiles(cwd).filter((f) => !f.startsWith(".harness/") || f.startsWith(".harness/proposals/") || f === ".harness/profile.json" || f === ".harness/lessons.md");
    if (!files.length && headSha(cwd) === state.slice.startHead) fail("nothing to record: no changed files and no new commit");
    if (files.length) {
      const add = git(cwd, ["add", "--", ...files]);
      if (add.code !== 0) fail(`git add failed: ${add.err}`);
      const body = [`Goal ${state.goal.id}: ${state.goal.sentence}`, `Criteria: ${slice.criteria.join(", ") || "none declared"}`, `Attempt ${state.slice.attempt}, review rounds ${state.review.rounds + 1}`].join("\n");
      const commit = git(cwd, ["commit", "-q", "-m", `feat: ${slice.title} [${slice.id}] (${state.goal.id})`, "-m", body]);
      if (commit.code !== 0) fail(`git commit failed: ${commit.err}`);
    }
    const sha = headSha(cwd);
    let push = { attempted: false };
    if (git(cwd, ["remote", "get-url", "origin"]).code === 0) {
      const r = git(cwd, ["push", "-q", "-u", "origin", state.branch]);
      push = { attempted: true, ok: r.code === 0, detail: r.code === 0 ? "" : r.err.slice(-300) };
    }
    appendEvent(cwd, { type: "record", slice: slice.id, commit: sha, files, push });
    out({ ok: true, commit: sha, files, push, next: "Stop now; the Stop hook advances to the next slice." });
  },

  reconcile(sub) {
    const state = requireState();
    const profile = loadProfile(cwd);
    if (sub === "prepare") {
      const r = prepareReconcile(cwd, state);
      const decided = r.items.filter((i) => i.decided).length;
      out({ ok: true, items: r.items.length, decidedDeterministically: decided, forModel: r.items.length - decided, input: join(harnessPaths(cwd).dir, "reconcile-input.json") });
    }
    if (sub === "load") {
      const r = loadReconcile(cwd, state, profile);
      if (!r.ok) fail("reconcile result rejected", { errors: r.errors });
      saveState(cwd, state);
      out({ ok: true, missing: r.missing, added: r.added, next: "Stop now; the Stop hook continues with new slices or the report." });
    }
    fail(`unknown reconcile subcommand ${sub}`);
  },

  report() {
    const state = requireState();
    const text = renderReport(cwd, state);
    // The report and lessons are the only run artifacts that belong in the branch.
    const own = [`.harness/reports/${state.goal.id}.md`, ".harness/lessons.md"].filter((f) => existsSync(join(cwd, f)) && git(cwd, ["status", "--porcelain", "--", f]).out !== "");
    let commit = null;
    if (own.length) {
      git(cwd, ["add", "--", ...own]);
      const c = git(cwd, ["commit", "-q", "-m", `docs: harness report [${state.goal.id}]`, "--", ...own]);
      if (c.code === 0) { commit = headSha(cwd); if (git(cwd, ["remote", "get-url", "origin"]).code === 0) git(cwd, ["push", "-q", "-u", "origin", state.branch]); }
    }
    out({ ok: true, path: harnessPaths(cwd).report, bytes: text.length, commit, next: "Stop now; the Stop hook runs the goal check." });
  },

  resume() {
    const state = requireState();
    out({ ok: true, stage: state.stage, slice: state.slice, halt: state.halt, brief: briefFor(cwd, state, loadProfile(cwd)) });
  },

  "authorize-rounds"(n) {
    const state = requireState();
    const rounds = Number(n);
    if (!Number.isInteger(rounds) || rounds < 1) fail("give a positive integer");
    state.review.roundsAuthorized = rounds;
    if (state.stage === "awaiting_human" && state.halt?.code === "rounds_cap") { state.halt = null; transition(cwd, state, "building", "rounds_authorized"); state.slice.buildDone = false; }
    saveState(cwd, state);
    appendEvent(cwd, { type: "note", text: `review rounds authorized: ${rounds}` });
    out({ ok: true, roundsAuthorized: rounds, stage: state.stage });
  },

  retry() {
    const state = requireState();
    if (!["awaiting_human", "halted"].includes(state.stage)) fail(`stage is ${state.stage}`);
    const to = state.slice ? "building" : "planning";
    state.halt = null; state.guards.blocks = 0; state.guards.diffHashes = [];
    if (state.slice) { state.slice.buildDone = false; state.slice.attempt = 1; state.slice.rejections = 0; state.slice.staleVerdicts = 0; }
    transition(cwd, state, to, "human_retry");
    saveState(cwd, state);
    out({ ok: true, stage: to });
  },

  hold(_, { flags }) {
    const state = requireState();
    const id = `H-${state.holds.length + 1}`;
    state.holds.push({ id, question: String(flags.question ?? ""), blocks: [].concat(flags.blocks ?? []), raisedAt: nowIso() });
    saveState(cwd, state);
    appendEvent(cwd, { type: "hold", id, question: flags.question, blocks: [].concat(flags.blocks ?? []) });
    out({ ok: true, hold: id });
  },

  verdict(sub, { rest }) {
    if (sub !== "validate") fail("usage: verdict validate <path>");
    const state = hasHarness(cwd) ? loadState(cwd) : null;
    const path = rest[0];
    if (!path || !existsSync(path)) fail(`missing verdict file ${path}`);
    const r = validateVerdict(cwd, readJson(path, null), { state, profile: loadProfile(cwd), workHash: workHash(cwd) });
    out({ ok: r.ok, errors: r.errors, stale: r.stale }, r.ok ? 0 : 1);
  },

  events(_, { flags }) {
    const events = readEvents(cwd, (e) => !flags.type || e.type === flags.type);
    out({ ok: true, count: events.length, events: events.slice(-Number(flags.last ?? 50)) });
  },
};

function commandsInitQuiet() {
  const p = harnessPaths(cwd);
  mkdirSync(p.verdicts, { recursive: true }); mkdirSync(p.evidence, { recursive: true });
  if (!existsSync(p.profile)) writeJsonAtomic(p.profile, { version: 1, checks: [], hosts: { preview: [], prod: [] } });
  writeFileSync(p.pluginRoot, pluginRoot() + "\n");
}

const { flags, rest } = parse(argv);
const [name, sub, ...more] = rest;
const cmd = commands[name];
if (!cmd) {
  out({ ok: false, error: `unknown command ${name ?? ""}`, commands: Object.keys(commands) }, 1);
}
try {
  cmd(sub, { flags, rest: more });
} catch (err) {
  fail(err.message, { stack: process.env.HARNESS_DEBUG ? err.stack : undefined });
}
