#!/usr/bin/env node
// harness CLI. Every command prints one JSON object so the model and tests parse the same thing.
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, rmSync, cpSync } from "node:fs";
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
import { briefFor, loadPlanIntoState, advanceFromCli, approveGoal, verdictTemplate } from "./lib/machine.mjs";
import { writePacket } from "./lib/packet.mjs";
import { changeSlug, specCheck, planTaskProblems, taskStatus, tickSliceTasks } from "./lib/openspec.mjs";
import { validateVerdict } from "./lib/verdict.mjs";
import { guardChecks } from "./lib/guards/index.mjs";
import { attributeByStage } from "./lib/usage.mjs";
import { analyzeRun, renderAnalysis } from "./lib/analyze.mjs";
import { jevVerdictGate } from "./lib/jev/verdict-gate.mjs";
import { jevPrefilter } from "./lib/jev/inventory-prefilter.mjs";
import { jevClassifyTrace } from "./lib/jev/trace-classify.mjs";
import { calibrate, renderCalibration } from "./lib/jev/calibrate.mjs";

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
      // The spec stage: on by profile (openspec.author) or per goal with --openspec / --no-openspec.
      // --change adopts an existing change folder instead of authoring one named after the goal.
      const profile = loadProfile(cwd);
      const specOn = flags.openspec ? true : flags["no-openspec"] ? false : Boolean(profile.openspec?.author);
      if (flags.change && !specOn) fail("--change needs the spec stage: pass --openspec or set openspec.author in the profile");
      const spec = specOn ? { change: flags.change ? String(flags.change) : changeSlug(id, String(flags.sentence)) } : null;
      if (spec && !/^[a-z0-9][a-z0-9._-]*$/.test(spec.change)) fail(`change name ${spec.change} must be kebab-case`);
      const state = newState({
        id, sentence: String(flags.sentence), mode: flags.mode === "feature" ? "feature" : "handoff", sources,
        budget: { usd: Number(flags["budget-usd"] ?? 20), minutes: Number(flags["budget-minutes"] ?? 120), maxSlices: Number(flags["max-slices"] ?? 20) },
        autoApprove: Boolean(flags["auto-approve"]), environments: { prod: Boolean(flags.prod), preview: flags.preview ?? null }, jev: Boolean(flags.jev), spec,
        branch, defaultBranch: def,
      });
      // Pre-populate verdicts/evidence folders and clear prior per-goal artifacts.
      const p = harnessPaths(cwd);
      for (const f of [p.plan, p.inventory, p.goalCard, p.preflight, p.report, join(p.dir, "reconcile-input.json")]) {
        if (existsSync(f)) { writeFileSync(f + ".prev", readFileSync(f)); rmSync(f, { force: true }); }
      }
      saveState(cwd, state);
      appendEvent(cwd, { type: "goal", action: "new", id, sentence: state.goal.sentence, mode: state.goal.mode, sources, budget: state.goal.budget, branch, spec: spec?.change ?? null });
      const next = spec
        ? `Intake with the spec stage: write .harness/inventory.json, then the OpenSpec change at openspec/changes/${spec.change}/ (or amend the adopted one), run \`harness spec check\`, write .harness/plan.json with a "tasks" list per slice and .harness/goal-card.md, then run \`harness next\`.`
        : "Intake: write .harness/inventory.json, .harness/plan.json and .harness/goal-card.md, then stop.";
      out({ ok: true, goal: state.goal, spec: state.spec, branch, next });
    }
    if (sub === "approve") {
      const state = requireState();
      if (state.stage !== "awaiting_approval") fail(`stage is ${state.stage}, not awaiting_approval`);
      const errs = loadPlanIntoState(cwd, state, loadProfile(cwd));
      if (errs.length) fail("plan.json invalid", { errors: errs });
      const specCommit = approveGoal(cwd, state, "approved");
      saveState(cwd, state);
      out({ ok: true, stage: state.stage, slices: state.slices.length, holds: state.holds.length, specCommit: specCommit?.committed ?? null, next: "Stop now; the Stop hook starts the first slice." });
    }
    if (sub === "status") {
      const state = requireState();
      const tasks = state.spec ? taskStatus(cwd, state) : null;
      out({ ok: true, goal: state.goal.id, sentence: state.goal.sentence, stage: state.stage, slice: state.slice, slices: state.slices.map((s) => ({ id: s.id, status: s.status, attempts: s.attempts, tasks: s.tasks ?? [] })), review: state.review, spec: state.spec, tasks: tasks && { total: tasks.total, done: tasks.done, open: tasks.open }, holds: state.holds, halt: state.halt, guards: state.guards });
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
      appendEvent(cwd, { type: "note", slice: state.slice.id, text: "build declared done", diffHash: workHash(cwd), files: changedFiles(cwd).length });
      const adv = advanceFromCli(cwd, state, loadProfile(cwd));
      saveState(cwd, state);
      out({ ok: true, slice: state.slice.id, attempt: state.slice.attempt, stage: adv.stage, brief: adv.brief });
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
    const packet = writePacket(cwd, state, profile);
    const adv = advanceFromCli(cwd, state, profile);
    saveState(cwd, state);
    out({ ok: result.passed, passed: result.passed, diffHash: result.diffHash, checks: result.checks.map((c) => ({ id: c.id, status: c.status, details: c.details })), packet: packet.path, stage: adv.stage, brief: adv.brief });
  },

  record() {
    const state = requireState();
    if (state.stage !== "record" || !state.slice) fail(`stage is ${state.stage}; record runs in the record stage`);
    const slice = currentSlice(state);
    // With the spec stage on, the slice's OpenSpec tasks are ticked here, after the judges and
    // before the commit, so the tick lands in the slice commit and never in a reviewed diff.
    const ticked = tickSliceTasks(cwd, state, slice);
    const files = changedFiles(cwd).filter((f) => !f.startsWith(".harness/") || f.startsWith(".harness/proposals/") || f === ".harness/profile.json" || f === ".harness/lessons.md");
    if (!files.length && headSha(cwd) === state.slice.startHead) fail("nothing to record: no changed files and no new commit");
    if (files.length) {
      const add = git(cwd, ["add", "--", ...files]);
      if (add.code !== 0) fail(`git add failed: ${add.err}`);
      const body = [`Goal ${state.goal.id}: ${state.goal.sentence}`, `Criteria: ${slice.criteria.join(", ") || "none declared"}`, ticked.ticked.length ? `Tasks: ${ticked.ticked.join(", ")}` : null, `Attempt ${state.slice.attempt}, review rounds ${state.review.rounds + 1}`].filter(Boolean).join("\n");
      const commit = git(cwd, ["commit", "-q", "-m", `feat: ${slice.title} [${slice.id}] (${state.goal.id})`, "-m", body]);
      if (commit.code !== 0) fail(`git commit failed: ${commit.err}`);
    }
    const sha = headSha(cwd);
    let push = { attempted: false };
    if (git(cwd, ["remote", "get-url", "origin"]).code === 0) {
      const r = git(cwd, ["push", "-q", "-u", "origin", state.branch]);
      push = { attempted: true, ok: r.code === 0, detail: r.code === 0 ? "" : r.err.slice(-300) };
    }
    appendEvent(cwd, { type: "record", slice: slice.id, commit: sha, files, push, tasks: ticked.ticked });
    const adv = advanceFromCli(cwd, state, loadProfile(cwd));
    saveState(cwd, state);
    out({ ok: true, commit: sha, files, tasks: ticked.ticked, push, stage: adv.stage, brief: adv.brief });
  },

  // The deterministic spec check: change folder present, delta format, `openspec validate --strict`,
  // every in-scope criterion cited, every task cites an id, every task owned by one slice.
  spec(sub) {
    const state = requireState();
    if (!state.spec) fail("this goal runs without the spec stage; start one with `goal new --openspec` or set openspec.author in the profile");
    if (sub === "check") {
      const check = specCheck(cwd, state);
      const p = harnessPaths(cwd);
      const planProblems = existsSync(p.plan) ? planTaskProblems(readJson(p.plan, { slices: [] }), check.tasks) : ["plan.json not written yet"];
      const next = check.ok && !planProblems.length
        ? "Write .harness/goal-card.md if missing, then run `harness next`: the spec reviewer judges the change."
        : "Fix the problems listed, then run `harness spec check` again.";
      out({ ok: check.ok && !planProblems.length, change: check.change, dir: check.dir, validate: check.validate, requirements: check.requirements, scenarios: check.scenarios, coverage: check.coverage, tasks: check.tasks.map((t) => ({ id: t.id, text: t.text, done: t.done })), problems: check.problems, planProblems, next });
    }
    if (sub === "tasks") out({ ok: true, ...taskStatus(cwd, state) });
    fail(`unknown spec subcommand ${sub}; use check or tasks`);
  },

  async reconcile(sub) {
    const state = requireState();
    const profile = loadProfile(cwd);
    if (sub === "prepare") {
      const r = prepareReconcile(cwd, state);
      const decided = r.items.filter((i) => i.decided).length;
      let jev = null;
      if (state.goal.jev && profile.jev.enabled) {
        jev = await jevPrefilter(cwd, r, { profile });
        writeJsonAtomic(join(harnessPaths(cwd).dir, "reconcile-input.json"), r);
      }
      out({ ok: true, items: r.items.length, decidedDeterministically: decided, forModel: r.items.length - decided, jev, input: join(harnessPaths(cwd).dir, "reconcile-input.json") });
    }
    if (sub === "load") {
      const r = loadReconcile(cwd, state, profile);
      if (!r.ok) fail("reconcile result rejected", { errors: r.errors });
      // Jev outcomes: the reconciler's decision is the ground truth for the prefilter's guess.
      const inputPath = join(harnessPaths(cwd).dir, "reconcile-input.json");
      if (existsSync(inputPath)) {
        for (const item of readJson(inputPath).items) {
          if (!item.jev || !r.statuses[item.id]) continue;
          appendEvent(cwd, { type: "jev", purpose: "outcome", answerId: item.jev.answerId, question: "implemented", actual: r.statuses[item.id] === "done", item: item.id });
        }
      }
      const adv = advanceFromCli(cwd, state, profile);
      saveState(cwd, state);
      out({ ok: true, missing: r.missing, added: r.added, stage: adv.stage, brief: adv.brief });
    }
    fail(`unknown reconcile subcommand ${sub}`);
  },

  report() {
    const state = requireState();
    // Refresh the cost table first so the report is not one stop behind.
    try {
      const agentRows = readEvents(cwd, (e) => e.type === "usage" && e.scope === "subagent").map((e) => ({ stage: e.stage, agent: e.agent, model: e.model, input: e.input, cacheWrite: e.cacheWrite, cacheRead: e.cacheRead, output: e.output }));
      attributeByStage(cwd, state, loadProfile(cwd), { agentRows });
    } catch (err) { appendEvent(cwd, { type: "note", text: `usage attribution skipped: ${err.message}` }); }
    const text = renderReport(cwd, state);
    // The report and lessons are the only run artifacts that belong in the branch.
    const own = [`.harness/reports/${state.goal.id}.md`, ".harness/lessons.md"].filter((f) => existsSync(join(cwd, f)) && git(cwd, ["status", "--porcelain", "--", f]).out !== "");
    let commit = null;
    if (own.length) {
      git(cwd, ["add", "--", ...own]);
      const c = git(cwd, ["commit", "-q", "-m", `docs: harness report [${state.goal.id}]`, "--", ...own]);
      if (c.code === 0) { commit = headSha(cwd); if (git(cwd, ["remote", "get-url", "origin"]).code === 0) git(cwd, ["push", "-q", "-u", "origin", state.branch]); }
    }
    const adv = advanceFromCli(cwd, state, loadProfile(cwd));
    saveState(cwd, state);
    out({ ok: true, path: harnessPaths(cwd).report, bytes: text.length, commit, stage: adv.stage, brief: adv.brief });
  },

  // Advances on the evidence present (verdict written, plan written) and prints the next brief.
  next() {
    const state = requireState();
    const adv = advanceFromCli(cwd, state, loadProfile(cwd));
    saveState(cwd, state);
    out({ ok: true, stage: adv.stage, code: adv.code, brief: adv.brief });
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

  retry(_, { flags }) {
    const state = requireState();
    if (!["awaiting_human", "halted"].includes(state.stage)) fail(`stage is ${state.stage}`);
    const allowed = ["building", "preflight", "critic", "review", "record", "spec_review"];
    let to = state.slice ? "building" : state.goal.approvedAt ? "planning" : "intake";
    if (flags.stage) {
      if (!allowed.includes(flags.stage)) fail(`--stage must be one of ${allowed.join(", ")}`);
      if (flags.stage === "spec_review") {
        if (!state.spec || state.goal.approvedAt) fail("spec_review applies before approval on a goal with the spec stage");
      } else if (!state.slice) fail("no active slice to resume at that stage");
      to = flags.stage;
    }
    state.halt = null; state.guards.blocks = 0; state.guards.diffHashes = [];
    if (state.slice && to === "building") { state.slice.buildDone = false; state.slice.attempt = 1; state.slice.rejections = 0; state.slice.staleVerdicts = 0; }
    if (state.slice && to !== "building") state.slice.buildDone = true;
    transition(cwd, state, to, flags.stage ? `human_retry_at_${to}` : "human_retry");
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

  verdict(sub, { flags, rest }) {
    if (sub === "template") {
      const state = requireState();
      const t = verdictTemplate(cwd, state, loadProfile(cwd), { agent: flags.agent ? String(flags.agent) : null });
      if (flags.write) { mkdirSync(harnessPaths(cwd).verdicts, { recursive: true }); writeJsonAtomic(t.path, t.skeleton); }
      out({ ok: true, role: t.role, agent: t.agent, path: t.path, written: Boolean(flags.write), note: "fill summary, verdict, findings and each criterion's status and evidence; keep every key as given; the skeleton does not validate until you do", skeleton: t.skeleton });
    }
    if (sub !== "validate") fail("usage: verdict validate <path> | verdict template [--write] [--agent name]");
    const state = hasHarness(cwd) ? loadState(cwd) : null;
    const path = rest[0];
    if (!path || !existsSync(path)) fail(`missing verdict file ${path}`);
    const r = validateVerdict(cwd, readJson(path, null), { state, profile: loadProfile(cwd), workHash: workHash(cwd) });
    out({ ok: r.ok, errors: r.errors, stale: r.stale }, r.ok ? 0 : 1);
  },

  async jev(sub, { flags, rest }) {
    const profile = loadProfile(cwd);
    const state = hasHarness(cwd) ? loadState(cwd) : null;
    if (sub === "gate") {
      const path = rest[0];
      if (!path || !existsSync(path)) fail("usage: jev gate <verdict.json>");
      const gate = await jevVerdictGate(cwd, readJson(path), { state, profile });
      out({ ok: true, ...gate });
    }
    if (sub === "prefilter") {
      const inputPath = join(harnessPaths(cwd).dir, "reconcile-input.json");
      if (!existsSync(inputPath)) fail("run `harness reconcile prepare` first");
      const input = readJson(inputPath);
      const r = await jevPrefilter(cwd, input, { profile });
      writeJsonAtomic(inputPath, input);
      out({ ok: true, ...r });
    }
    if (sub === "classify") {
      const r = await jevClassifyTrace(cwd, { profile, state, since: flags.since ?? null });
      out({ ok: true, ...r });
    }
    if (sub === "calibrate") {
      const c = calibrate(cwd);
      if (flags.markdown) { process.stdout.write(renderCalibration(c)); process.exit(0); }
      out({ ok: true, ...c });
    }
    if (sub === "outcome") {
      if (!flags.id || flags.actual === undefined) fail("usage: jev outcome --id <answerId> --actual true|false [--question name]");
      appendEvent(cwd, { type: "jev", purpose: "outcome", answerId: String(flags.id), question: flags.question ?? null, actual: String(flags.actual) === "true" });
      out({ ok: true });
    }
    fail(`unknown jev subcommand ${sub}`);
  },

  // Copies a run's artifacts and its analysis into a folder, for recorded runs in docs/runs/.
  snapshot(_, { flags }) {
    if (!flags.to) fail("usage: snapshot --to <dir> [--log <drive log>]");
    const p = harnessPaths(cwd);
    const dest = join(cwd, String(flags.to)).startsWith("/") && String(flags.to).startsWith("/") ? String(flags.to) : join(cwd, String(flags.to));
    mkdirSync(dest, { recursive: true });
    const copied = [];
    for (const f of ["events.jsonl", "usage.json", "report.md", "goal-card.md", "plan.json", "inventory.json", "preflight.json", "reconcile-input.json", "jev.jsonl", "lessons.md", "state.json"]) {
      const src = join(p.dir, f);
      if (existsSync(src)) { cpSync(src, join(dest, f)); copied.push(f); }
    }
    for (const d of ["verdicts", "evidence"]) {
      const src = join(p.dir, d);
      if (existsSync(src)) { cpSync(src, join(dest, d), { recursive: true }); copied.push(d + "/"); }
    }
    if (flags.log && existsSync(String(flags.log))) { cpSync(String(flags.log), join(dest, "drive.log")); copied.push("drive.log"); }
    const analysis = renderAnalysis(analyzeRun(cwd, { driveLog: flags.log ? String(flags.log) : null }));
    writeFileSync(join(dest, "analysis.md"), analysis);
    copied.push("analysis.md");
    out({ ok: true, dest, copied });
  },

  analyze(_, { flags }) {
    const a = analyzeRun(cwd, { driveLog: flags.log ?? null });
    if (flags.json) out({ ok: true, ...a });
    process.stdout.write(renderAnalysis(a));
    process.exit(0);
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
  await cmd(sub, { flags, rest: more });
} catch (err) {
  fail(err.message, { stack: process.env.HARNESS_DEBUG ? err.stack : undefined });
}
