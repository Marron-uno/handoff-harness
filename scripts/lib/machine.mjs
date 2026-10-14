// The state machine behind the Stop hook. Pure with respect to the model: it reads files and git,
// decides allow or block, and mutates `state` (the caller saves it). Nothing here calls a model.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { readJson, nowIso } from "./io.mjs";
import { harnessPaths, pluginRoot } from "./paths.mjs";
import { workHash, isClean, lastCommitSubject, headSha, changedFiles } from "./git.mjs";
import { transition, nextReadySlice, currentSlice, RESTING } from "./state.mjs";
import { appendEvent } from "./events.mjs";
import { renderBrief } from "./brief.mjs";
import { validate } from "./schema.mjs";
import { validateVerdict } from "./verdict.mjs";
import { goalCheck } from "./goal-check.mjs";

const planSchema = () => readJson(join(pluginRoot(), "schemas", "plan.schema.json"));
const inventorySchema = () => readJson(join(pluginRoot(), "schemas", "inventory.schema.json"));

function cliPath() { return `node "${pluginRoot()}/scripts/cli.mjs"`; }

// A block from the Stop hook counts toward the runaway cap. The same decision reached through
// `harness next` (the CLI advancing on evidence it just produced) is progress, not a stall.
let blockSource = "hook";
function block(cwd, state, code, reason) {
  if (blockSource === "hook") {
    state.guards.blocks += 1;
    appendEvent(cwd, { type: "block", stage: state.stage, slice: state.slice?.id ?? null, code });
  }
  return { action: "block", code, reason };
}

// Advances the machine from the CLI and returns the next brief, so the model does not need a
// stop-and-block cycle after every command. The Stop hook stays the enforcement of record.
export function advanceFromCli(cwd, state, profile) {
  blockSource = "cli";
  try {
    const r = decide({ cwd, state, profile, input: { source: "cli" } });
    return { stage: state.stage, action: r.action, code: r.code, brief: r.action === "block" ? r.reason : (r.systemMessage ?? `Run is resting in ${state.stage}.`) };
  } finally { blockSource = "hook"; }
}

function rest(cwd, state, stage, code, message, extra = {}) {
  if (state.stage !== stage) transition(cwd, state, stage, code);
  if (stage === "halted" || stage === "awaiting_human" || stage === "budget_exceeded") {
    state.halt = { reason: message, at: nowIso(), code };
    appendEvent(cwd, { type: "halt", stage, code, reason: message });
  }
  return { action: "allow", code, systemMessage: message, ...extra };
}

function sliceVars(cwd, state, profile) {
  const slice = currentSlice(state);
  return {
    cli: cliPath(),
    "goal.id": state.goal.id, "goal.sentence": state.goal.sentence,
    "slice.id": slice?.id, "slice.title": slice?.title, "slice.criteria": slice?.criteria, "slice.paths": slice?.paths,
    "slice.ui": slice?.ui ? "yes" : "no",
    attempt: state.slice?.attempt, maxAttempts: profile.caps.maxAttempts,
    round: state.review.rounds + 1, roundsAuthorized: state.review.roundsAuthorized,
    "devServer.url": profile.devServer?.url ?? "(none configured)", "devServer.start": profile.devServer?.start ?? "(none configured)",
    changedFiles: changedFiles(cwd).filter((f) => !f.startsWith(".harness/")).slice(0, 40),
    checks: (profile.checks ?? []).map((c) => `${c.id}: \`${c.command}\``),
    verdictsDir: harnessPaths("").verdicts.replace(/^\//, ""),
  };
}

// One verdict file per (slice, attempt, review round, role). A new cycle gets a new path, so an
// old verdict never counts as stale by design; stale means someone edited after the judge looked.
export function verdictPath(cwd, state, role, round = state.review.rounds + 1) {
  const slice = state.slice.id;
  const attempt = state.slice.attempt;
  const name = `${slice}-a${attempt}-r${round}-${role === "review" ? "reviewer" : "critic"}.json`;
  return join(harnessPaths(cwd).verdicts, name);
}

function pickAgent(state, profile, role) {
  const rejections = state.slice?.rejections ?? 0;
  const strong = rejections >= profile.models.escalateAfterRejections;
  if (role === "critic") return strong ? "critic-strong" : "critic";
  return strong ? "reviewer-strong" : "reviewer";
}

function startSlice(cwd, state, slice) {
  slice.status = "building";
  slice.attempts += 1;
  state.slice = { id: slice.id, attempt: slice.attempts, buildDone: false, startHead: headSha(cwd), rejections: 0 };
  state.review.rounds = 0;
  state.preflight = null;
  state.verdicts = { critic: null, review: null };
}

function failAttempt(cwd, state, profile, code, detail) {
  const slice = currentSlice(state);
  state.slice.rejections = (state.slice.rejections ?? 0) + 1;
  if (state.slice.attempt >= profile.caps.maxAttempts) {
    return rest(cwd, state, "awaiting_human", "attempt_cap",
      `Slice ${slice.id} failed ${state.slice.attempt} attempts (${code}). A human decides: fix by hand, raise caps in .harness/profile.json, or skip with \`harness slice skip\`.`);
  }
  state.slice.attempt += 1;
  slice.attempts = state.slice.attempt;
  state.slice.buildDone = false;
  state.preflight = null;
  transition(cwd, state, "building", code, { detail: String(detail).slice(0, 500) });
  return block(cwd, state, code, renderBrief("build", { ...sliceVars(cwd, state, profile), feedback: detail }));
}

export function decide({ cwd, state, profile, input = {}, now = Date.now() }) {
  if (RESTING.has(state.stage)) return { action: "allow", code: "resting" };
  if (input.stop_hook_active) state.guards.continuations += 1;

  // A judge running as a background subagent is progress in flight, not a stall: let the turn end,
  // the session wakes when the task completes, and the next stop sees the verdict.
  const running = (input.background_tasks ?? []).filter((t) => t.status === "running");
  if (running.length && ["critic", "review", "reconcile"].includes(state.stage)) {
    appendEvent(cwd, { type: "note", stage: state.stage, slice: state.slice?.id ?? null, text: `waiting for ${running.length} background task(s): ${running.map((t) => t.type ?? "task").join(", ")}` });
    return { action: "allow", code: "background_task_running" };
  }

  // Budgets. Minutes from approval; dollars from the usage summary when it exists.
  const started = Date.parse(state.goal.approvedAt ?? state.goal.createdAt);
  const minutes = (now - started) / 60000;
  if (minutes > state.goal.budget.minutes) {
    return rest(cwd, state, "budget_exceeded", "budget_minutes", `Time budget of ${state.goal.budget.minutes} minutes exceeded (${Math.round(minutes)} used). Raise it in state via \`harness goal budget --minutes N\` and resume.`);
  }
  const usagePath = harnessPaths(cwd).usage;
  if (existsSync(usagePath)) {
    const usage = readJson(usagePath, {});
    if (typeof usage.totalUsd === "number" && usage.totalUsd > state.goal.budget.usd) {
      return rest(cwd, state, "budget_exceeded", "budget_usd", `Cost budget of $${state.goal.budget.usd} exceeded ($${usage.totalUsd.toFixed(2)} attributed). Raise it with \`harness goal budget --usd N\` and resume.`);
    }
  }

  // Runaway: blocks with no stage progress in between.
  if (state.guards.blocks >= profile.caps.maxConsecutiveBlocks) {
    return rest(cwd, state, "halted", "runaway", `Stop hook blocked ${state.guards.blocks} times in stage ${state.stage} without progress. Halted. Inspect .harness/events.jsonl, then \`harness resume\`.`);
  }

  // Oscillation: the work hash alternates A B A B.
  const wh = workHash(cwd);
  const hashes = state.guards.diffHashes;
  if (hashes[hashes.length - 1] !== wh) hashes.push(wh);
  if (hashes.length > 8) hashes.splice(0, hashes.length - 8);
  const w = profile.caps.oscillationWindow;
  if (hashes.length >= w) {
    const tail = hashes.slice(-w);
    const alternating = tail.every((h, i) => i < 2 || h === tail[i - 2]) && tail[0] !== tail[1];
    if (alternating) return rest(cwd, state, "halted", "oscillation", `The change set alternated between two states ${w} times. Halted to stop a revert loop.`);
  }

  switch (state.stage) {
    case "intake": return decideIntake(cwd, state, profile);
    case "planning": return decidePlanning(cwd, state, profile);
    case "building": return decideBuilding(cwd, state, profile);
    case "preflight": return decidePreflight(cwd, state, profile, wh);
    case "critic": return decideVerdict(cwd, state, profile, wh, "critic");
    case "review": return decideVerdict(cwd, state, profile, wh, "review");
    case "record": return decideRecord(cwd, state, profile);
    case "reconcile": return decideReconcile(cwd, state, profile, wh);
    case "report": return decideReport(cwd, state, profile);
    default: return { action: "allow", code: "unknown_stage" };
  }
}

export function intakeMissing(cwd) {
  const p = harnessPaths(cwd);
  const missing = [];
  if (!existsSync(p.inventory)) missing.push("inventory.json");
  else {
    const errs = validate(inventorySchema(), readJson(p.inventory));
    if (errs.length) missing.push(`inventory.json invalid: ${errs.slice(0, 3).join("; ")}`);
  }
  if (!existsSync(p.plan)) missing.push("plan.json");
  else {
    const errs = validate(planSchema(), readJson(p.plan));
    if (errs.length) missing.push(`plan.json invalid: ${errs.slice(0, 3).join("; ")}`);
  }
  if (!existsSync(p.goalCard)) missing.push("goal-card.md");
  return missing;
}

function decideIntake(cwd, state, profile) {
  const missing = intakeMissing(cwd);
  if (missing.length) {
    return block(cwd, state, "intake_incomplete", renderBrief("intake", { ...sliceVars(cwd, state, profile), missing: missing.join("\n- ") }));
  }
  if (state.goal.autoApprove) {
    state.goal.approvedAt = nowIso();
    appendEvent(cwd, { type: "goal", action: "auto-approved" });
    transition(cwd, state, "planning", "auto_approve");
    return decidePlanning(cwd, state, profile);
  }
  transition(cwd, state, "awaiting_approval", "card_ready");
  return { action: "allow", code: "card_ready", systemMessage: `Goal card ready at .harness/goal-card.md. Approve with: ${cliPath()} goal approve` };
}

export function loadPlanIntoState(cwd, state, profile) {
  const plan = readJson(harnessPaths(cwd).plan);
  const errs = validate(planSchema(), plan);
  if (errs.length) return errs;
  const known = new Set(state.slices.map((s) => s.id));
  for (const s of plan.slices) {
    if (known.has(s.id)) continue;
    state.slices.push({ id: s.id, title: s.title, status: "pending", dependsOn: s.dependsOn ?? [], criteria: s.criteria, paths: s.paths, attempts: 0, ui: s.ui, diffHash: null, commit: null, origin: "plan" });
  }
  for (const q of plan.questions ?? []) {
    if (q.kind === "hold" && !state.holds.some((h) => h.id === q.id)) {
      state.holds.push({ id: q.id, question: q.question, blocks: q.blocks ?? [], raisedAt: nowIso() });
      appendEvent(cwd, { type: "hold", id: q.id, question: q.question, blocks: q.blocks ?? [] });
    }
    if (q.kind === "default" && !state.defaults.some((d) => d.id === q.id)) {
      state.defaults.push({ id: q.id, question: q.question, chosen: q.chosen ?? "", appliedAt: nowIso() });
      appendEvent(cwd, { type: "default", id: q.id, question: q.question, chosen: q.chosen ?? "" });
    }
  }
  if (state.slices.length > state.goal.budget.maxSlices) return [`plan has ${state.slices.length} slices, budget allows ${state.goal.budget.maxSlices}`];
  return [];
}

function decidePlanning(cwd, state, profile) {
  if (!existsSync(harnessPaths(cwd).plan)) return block(cwd, state, "plan_missing", renderBrief("planning", sliceVars(cwd, state, profile)));
  const errs = loadPlanIntoState(cwd, state, profile);
  if (errs.length) return block(cwd, state, "plan_invalid", renderBrief("planning", { ...sliceVars(cwd, state, profile), errors: errs.join("\n- ") }));
  return advance(cwd, state, profile);
}

// Picks the next slice or moves to reconcile/report.
function advance(cwd, state, profile) {
  const next = nextReadySlice(state);
  if (next) {
    startSlice(cwd, state, next);
    transition(cwd, state, "building", "slice_start", { slice: next.id });
    return block(cwd, state, "build", renderBrief("build", sliceVars(cwd, state, profile)));
  }
  const passes = state.reconcilePasses ?? 0;
  const fresh = state.reconcile && state.reconcile.diffHash === workHash(cwd);
  if (!fresh && passes < 3) {
    transition(cwd, state, "reconcile", "all_slices_done");
    return block(cwd, state, "reconcile", renderBrief("reconcile", sliceVars(cwd, state, profile)));
  }
  transition(cwd, state, "report", "reconciled");
  return block(cwd, state, "report", renderBrief("report", sliceVars(cwd, state, profile)));
}

function decideBuilding(cwd, state, profile) {
  if (!state.slice) return advance(cwd, state, profile);
  if (!state.slice.buildDone) return block(cwd, state, "build_incomplete", renderBrief("build", sliceVars(cwd, state, profile)));
  transition(cwd, state, "preflight", "build_done");
  return block(cwd, state, "preflight", renderBrief("preflight", sliceVars(cwd, state, profile)));
}

function decidePreflight(cwd, state, profile, wh) {
  const p = state.preflight;
  if (!p || p.diffHash !== wh) return block(cwd, state, "preflight_stale", renderBrief("preflight", sliceVars(cwd, state, profile)));
  if (p.passed) {
    transition(cwd, state, "critic", "preflight_passed");
    const agent = pickAgent(state, profile, "critic");
    return block(cwd, state, "critic", renderBrief("critic", { ...sliceVars(cwd, state, profile), agent, verdictPath: verdictPath(cwd, state, "critic") }));
  }
  const failed = p.checks.filter((c) => c.status === "fail").map((c) => `${c.id}: ${c.details ?? ""}`).join("\n- ");
  return failAttempt(cwd, state, profile, "preflight_failed", `Preflight failed:\n- ${failed}`);
}

function decideVerdict(cwd, state, profile, wh, role) {
  const round = state.review.rounds + 1;
  const path = verdictPath(cwd, state, role, round);
  const agent = pickAgent(state, profile, role);
  const briefName = role === "critic" ? "critic" : "review";
  const vars = { ...sliceVars(cwd, state, profile), agent, verdictPath: path };
  if (!existsSync(path)) return block(cwd, state, `${role}_verdict_missing`, renderBrief(briefName, vars));
  const result = validateVerdict(cwd, readJson(path, null), { state, profile, workHash: wh, role });
  if (!result.ok) {
    appendEvent(cwd, { type: "verdict", role, path, valid: false, errors: result.errors.slice(0, 10) });
    if (result.stale) {
      const stale = (state.slice.staleVerdicts ?? 0) + 1;
      state.slice.staleVerdicts = stale;
      if (stale > profile.caps.maxStaleVerdicts) return rest(cwd, state, "awaiting_human", "stale_verdicts", `Verdicts for ${state.slice.id} keep arriving for a different change set. Something edits files between build and review. Inspect events.jsonl.`);
    }
    return block(cwd, state, `${role}_verdict_invalid`, renderBrief(briefName, { ...vars, errors: result.errors.join("\n- ") }));
  }
  const v = result.verdict;
  state.verdicts[role] = path;
  appendEvent(cwd, { type: "verdict", role, agent: v.agent, path, valid: true, verdict: v.verdict, findings: v.findings.length, blockFindings: v.findings.filter((f) => f.severity === "block").length });
  if (v.verdict === "pass") {
    if (role === "critic") {
      transition(cwd, state, "review", "critic_pass");
      return block(cwd, state, "review", renderBrief("review", { ...sliceVars(cwd, state, profile), agent: pickAgent(state, profile, "review"), verdictPath: verdictPath(cwd, state, "review") }));
    }
    transition(cwd, state, "record", "review_pass");
    return block(cwd, state, "record", renderBrief("record", sliceVars(cwd, state, profile)));
  }
  const findings = v.findings.filter((f) => f.severity === "block" || f.severity === "major")
    .map((f) => `${f.id} [${f.severity}] ${f.file ?? ""}${f.line ? ":" + f.line : ""} ${f.issue} (${f.authority})${f.suggestion ? " → " + f.suggestion : ""}`).join("\n- ");
  if (role === "review") {
    state.review.rounds += 1;
    if (state.review.rounds >= state.review.roundsAuthorized) {
      return rest(cwd, state, "awaiting_human", "rounds_cap", `Review rejected ${state.slice.id} ${state.review.rounds} times. A human decides: fix by hand, or authorize more rounds with \`harness authorize-rounds N\`.`);
    }
    state.slice.rejections = (state.slice.rejections ?? 0) + 1;
    state.slice.buildDone = false;
    state.preflight = null;
    transition(cwd, state, "building", "review_block", { round: state.review.rounds });
    return block(cwd, state, "review_block", renderBrief("build", { ...sliceVars(cwd, state, profile), feedback: `Reviewer blocked (round ${state.review.rounds}):\n- ${findings}` }));
  }
  return failAttempt(cwd, state, profile, "critic_block", `Critic blocked:\n- ${findings}`);
}

function decideRecord(cwd, state, profile) {
  const slice = currentSlice(state);
  const subject = lastCommitSubject(cwd);
  const recorded = isClean(cwd) && subject.includes(`[${slice.id}]`) && headSha(cwd) !== state.slice.startHead;
  if (!recorded) return block(cwd, state, "record_missing", renderBrief("record", sliceVars(cwd, state, profile)));
  slice.status = "done";
  slice.commit = headSha(cwd);
  slice.diffHash = workHash(cwd);
  appendEvent(cwd, { type: "record", slice: slice.id, commit: slice.commit, subject });
  state.slice = null;
  return advance(cwd, state, profile);
}

function decideReconcile(cwd, state, profile, wh) {
  const r = state.reconcile;
  if (!r || r.diffHash !== wh) return block(cwd, state, "reconcile_missing", renderBrief("reconcile", sliceVars(cwd, state, profile)));
  return advance(cwd, state, profile);
}

function decideReport(cwd, state, profile) {
  const p = harnessPaths(cwd).report;
  const fresh = existsSync(p) && statSync(p).mtimeMs >= Date.parse(state.stageEnteredAt) - 1000;
  if (!fresh) return block(cwd, state, "report_missing", renderBrief("report", sliceVars(cwd, state, profile)));
  const check = goalCheck(cwd, state, profile);
  // The report stage cannot edit source, so an unsatisfied predicate here is a human decision.
  if (!check.done) return rest(cwd, state, "awaiting_human", "goal_incomplete", `Report written but the goal predicate is not satisfied:\n- ${check.reasons.join("\n- ")}\nA human decides: skip or hold the gaps, raise the slice budget, or fix by hand, then \`harness retry\`.`);
  transition(cwd, state, "done", "goal_check_passed");
  appendEvent(cwd, { type: "goal", action: "done" });
  return { action: "allow", code: "done", systemMessage: `Goal ${state.goal.id} complete. Report: .harness/report.md` };
}

// Renders the brief for the current stage without mutating state. Used by `harness resume`.
export function briefFor(cwd, state, profile) {
  const vars = sliceVars(cwd, state, profile);
  switch (state.stage) {
    case "intake": return renderBrief("intake", { ...vars, missing: intakeMissing(cwd).join("\n- ") || "nothing; stop to let the hook verify" });
    case "planning": return renderBrief("planning", vars);
    case "building": return renderBrief("build", vars);
    case "preflight": return renderBrief("preflight", vars);
    case "critic": return renderBrief("critic", { ...vars, agent: pickAgent(state, profile, "critic"), verdictPath: verdictPath(cwd, state, "critic") });
    case "review": return renderBrief("review", { ...vars, agent: pickAgent(state, profile, "review"), verdictPath: verdictPath(cwd, state, "review", state.review.rounds + 1) });
    case "record": return renderBrief("record", vars);
    case "reconcile": return renderBrief("reconcile", vars);
    case "report": return renderBrief("report", vars);
    default: return `Stage ${state.stage}: ${state.halt?.reason ?? "nothing to do"}`;
  }
}
