import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpDir, initRepo, PLUGIN_ROOT } from "./helpers.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";
import { askJev, redactState, resolveJevConfig } from "../scripts/lib/jev/client.mjs";
import { jevVerdictGate } from "../scripts/lib/jev/verdict-gate.mjs";
import { jevPrefilter } from "../scripts/lib/jev/inventory-prefilter.mjs";
import { jevClassifyTrace } from "../scripts/lib/jev/trace-classify.mjs";
import { calibrate } from "../scripts/lib/jev/calibrate.mjs";
import { appendEvent, readEvents } from "../scripts/lib/events.mjs";

function profileOn(dir) {
  const p = loadProfile(dir, PLUGIN_ROOT);
  p.jev.enabled = true;
  return p;
}
const env = { TYPESAFE_API_KEY: "test-key" };

function fakeFetch(answerFor, { status = 200, headers = {} } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body, auth: init.headers.authorization });
    const st = typeof status === "function" ? status(calls.length) : status;
    const answers = {};
    for (const [name, q] of Object.entries(body.questions)) answers[name] = answerFor(name, q, body.state);
    return { ok: st >= 200 && st < 300, status: st, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, json: async () => ({ model: "jev-1.13.0", answers, usage: { input_tokens: 100, output_tokens: 0 } }), text: async () => JSON.stringify({ detail: "guardrail_uninspectable" }) };
  };
  fn.calls = calls;
  return fn;
}
const yes = (name, q) => q.type === "noul" ? { type: "noul", noul: 0.9 } : q.type === "choice" ? { type: "choice", choice: Object.keys(q.criteria)[0], probabilities: {}, confidence: 0.8 } : { type: "score", score: 1 };

test("client: request shape, auth header, logging, and skip paths", async () => {
  const dir = initRepo(tmpDir());
  const profile = profileOn(dir);
  const fetchImpl = fakeFetch(yes);
  const r = await askJev(dir, { a: 1 }, { ok: { type: "noul", instructions: "Is it ok?" } }, { profile, fetchImpl, env, purpose: "test" });
  assert.equal(r.ok, true);
  assert.equal(r.answers.ok.noul, 0.9);
  assert.deepEqual(fetchImpl.calls[0].body, { model: "jev-latest", state: { a: 1 }, questions: { ok: { type: "noul", instructions: "Is it ok?" } } });
  assert.equal(fetchImpl.calls[0].auth, "Bearer test-key");
  assert.equal(fetchImpl.calls[0].url, "https://api.typesafe.ai/v1/systemone");
  const logged = readFileSync(join(dir, ".harness/jev.jsonl"), "utf8").trim().split("\n");
  assert.equal(logged.length, 1);
  assert.equal(JSON.parse(logged[0]).id, r.id);
  const noKey = await askJev(dir, {}, {}, { profile, fetchImpl, env: {}, purpose: "test" });
  assert.equal(noKey.skipped, true);
  assert.match(noKey.reason, /no key/);
  profile.jev.enabled = false;
  const off = await askJev(dir, {}, {}, { profile, fetchImpl, env, purpose: "test" });
  assert.match(off.reason, /disabled/);
  assert.equal(readEvents(dir, (e) => e.type === "jev").length, 3);
});

test("client: 429 retries once, 400 guardrail skips, 5xx skips, 422 throws, timeout skips", async () => {
  const dir = initRepo(tmpDir());
  const profile = profileOn(dir);
  const sleep = async () => {};
  let f = fakeFetch(yes, { status: (n) => (n === 1 ? 429 : 200), headers: { "retry-after": "1" } });
  let r = await askJev(dir, {}, { ok: { type: "noul", instructions: "x" } }, { profile, fetchImpl: f, env, sleep });
  assert.equal(r.ok, true);
  assert.equal(f.calls.length, 2);
  f = fakeFetch(yes, { status: 400 });
  r = await askJev(dir, {}, {}, { profile, fetchImpl: f, env });
  assert.equal(r.reason, "guardrail_uninspectable");
  f = fakeFetch(yes, { status: 529 });
  r = await askJev(dir, {}, {}, { profile, fetchImpl: f, env });
  assert.equal(r.reason, "http 529");
  f = fakeFetch(yes, { status: 422 });
  await assert.rejects(askJev(dir, {}, {}, { profile, fetchImpl: f, env }), /questions file is wrong/);
  const slow = async (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  profile.jev.timeoutMs = 20;
  r = await askJev(dir, {}, {}, { profile, fetchImpl: slow, env });
  assert.match(r.reason, /timeout after 20ms/);
});

test("redaction and provider presets", () => {
  const dir = tmpDir();
  const profile = profileOn(dir);
  const red = redactState({ note: "api_key=abcd1234secret and more", keep: "fine" }, profile.jev.redact);
  assert.equal(red.note, "[redacted] and more");
  assert.equal(red.keep, "fine");
  profile.jev.provider = "vercel";
  const cfg = resolveJevConfig(profile);
  assert.equal(cfg.model, "typesafe-ai/jev");
  assert.equal(cfg.keyEnv, "AI_GATEWAY_API_KEY");
  profile.jev.provider = "custom"; profile.jev.endpoint = "https://gw.example/systemone"; profile.jev.model = "m";
  assert.equal(resolveJevConfig(profile).endpoint, "https://gw.example/systemone");
});

test("verdict gate routes on weak evidence or an inconsistent summary, otherwise accepts", async () => {
  const dir = initRepo(tmpDir());
  const profile = profileOn(dir);
  const verdict = { agent: "critic", slice: "S-1", verdict: "pass", summary: "all good", findings: [{ id: "F-1", severity: "block", issue: "x", authority: "criterion:C-1", evidence: [] }], criteria: [] };
  let gate = await jevVerdictGate(dir, verdict, { profile, env, fetchImpl: fakeFetch(yes) });
  assert.equal(gate.route, "accept");
  const weak = (name, q) => name === "evidence_supports" ? { type: "noul", noul: 0.2 } : name === "summary_consistent" ? { type: "noul", noul: 0.3 } : yes(name, q);
  gate = await jevVerdictGate(dir, verdict, { profile, env, fetchImpl: fakeFetch(weak) });
  assert.equal(gate.route, "re-review");
  assert.equal(gate.reasons.length, 2);
  assert.match(gate.reasons[0], /F-1: evidence may not support/);
  const off = await jevVerdictGate(dir, verdict, { profile, env: {}, fetchImpl: fakeFetch(yes) });
  assert.equal(off.route, "accept");
  assert.equal(off.skipped, true);
});

test("inventory prefilter buckets undecided items and leaves decided ones alone", async () => {
  const dir = initRepo(tmpDir());
  const profile = profileOn(dir);
  const input = { items: [
    { id: "I-1", title: "a", criteria: [], evidence: [], bucket: "deterministic", decided: "done" },
    { id: "I-2", title: "b", criteria: [], evidence: [], bucket: "model", decided: null },
    { id: "I-3", title: "c", criteria: [], evidence: [], bucket: "model", decided: null },
    { id: "I-4", title: "d", criteria: [], evidence: [], bucket: "model", decided: null },
  ] };
  const probs = { "I-2": 0.95, "I-3": 0.1, "I-4": 0.5 };
  const f = fakeFetch((name, q, state) => ({ type: "noul", noul: probs[state.item.id] }));
  const r = await jevPrefilter(dir, input, { profile, env, fetchImpl: f });
  assert.deepEqual(r.counts, { jev_done: 1, jev_missing: 1, jev_uncertain: 1 });
  assert.equal(input.items[0].bucket, "deterministic");
  assert.equal(input.items[1].bucket, "jev_done");
  assert.equal(input.items[2].bucket, "jev_missing");
  assert.equal(input.items[3].bucket, "jev_uncertain");
  assert.equal(f.calls.length, 3);
});

test("trace classification writes cited lesson stubs for reusable events only", async () => {
  const dir = initRepo(tmpDir());
  const profile = profileOn(dir);
  appendEvent(dir, { type: "guard", guard: "git", tool: "Bash", stage: "building", reason: "git push --force" });
  appendEvent(dir, { type: "block", stage: "critic", code: "critic_verdict_missing" });
  appendEvent(dir, { type: "halt", code: "oscillation", reason: "A B A B" });
  const f = fakeFetch((name, q, state) => name === "reusable" ? { type: "noul", noul: state.event.type === "block" ? 0.2 : 0.9 } : { type: "choice", choice: "agent_misread", probabilities: {}, confidence: 0.7 });
  const r = await jevClassifyTrace(dir, { profile, env, fetchImpl: f, state: { goal: { sentence: "x" } } });
  assert.equal(r.considered, 3);
  assert.equal(r.lessons.length, 2);
  assert.match(r.lessons[0], /\[agent_misread\] guard git denied Bash in stage building/);
  assert.match(readFileSync(join(dir, ".harness/lessons.md"), "utf8"), /run halted: oscillation/);
  const again = await jevClassifyTrace(dir, { profile, env, fetchImpl: f, state: { goal: { sentence: "x" } } });
  assert.equal(again.lessons.length, 0, "already classified events are not repeated");
});

test("calibration bins predicted probabilities against recorded outcomes", async () => {
  const dir = initRepo(tmpDir());
  const profile = profileOn(dir);
  const ids = [];
  for (const p of [0.95, 0.9, 0.15, 0.55]) {
    const r = await askJev(dir, { p }, { implemented: { type: "noul", instructions: "x" } }, { profile, env, fetchImpl: fakeFetch(() => ({ type: "noul", noul: p })) });
    ids.push(r.id);
  }
  appendEvent(dir, { type: "jev", purpose: "outcome", answerId: ids[0], actual: true });
  appendEvent(dir, { type: "jev", purpose: "outcome", answerId: ids[1], actual: false });
  appendEvent(dir, { type: "jev", purpose: "outcome", answerId: ids[2], actual: false });
  appendEvent(dir, { type: "jev", purpose: "outcome", answerId: ids[3], actual: true });
  const c = calibrate(dir);
  assert.equal(c.outcomes, 4);
  const rows = c.report.implemented;
  assert.deepEqual(rows.map((r) => [r.bin, r.n, r.observedRate]), [["0.1-0.2", 1, 0], ["0.5-0.6", 1, 1], ["0.9-1.0", 2, 0.5]]);
});

test("client: a gateway's billed cost and generation id are kept with the answer", async () => {
  const dir = initRepo(tmpDir());
  const profile = profileOn(dir);
  profile.jev.provider = "vercel";
  const fetchImpl = async (url, init) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ model: "typesafe-ai/jev", answers: { ok: { type: "noul", noul: 0.98 } }, usage: { input_tokens: 275, output_tokens: 20 }, provider_metadata: { gateway: { cost: "0.00001155", generationId: "gen_1" } } }) });
  const r = await askJev(dir, "state", { ok: { type: "noul", instructions: "ok?" } }, { profile, fetchImpl, env: { AI_GATEWAY_API_KEY: "k" }, purpose: "ping" });
  assert.equal(r.ok, true);
  assert.equal(r.cost, 0.00001155);
  assert.equal(r.requestId, "gen_1");
  assert.equal(typeof r.latencyMs, "number");
  const ev = readEvents(dir, (e) => e.type === "jev")[0];
  assert.equal(ev.cost, 0.00001155);
  assert.equal(ev.purpose, "ping");
});
