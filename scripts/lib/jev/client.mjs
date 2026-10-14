// Jev client: one POST to /v1/systemone with a state and named questions. Optional dependency:
// without a key, with a vendor error, or past the timeout it returns { skipped: true } and the
// harness proceeds as if Jev were absent. Every answer is logged for calibration.
import { createHash, randomUUID } from "node:crypto";
import { appendLine } from "../io.mjs";
import { harnessPaths } from "../paths.mjs";
import { appendEvent } from "../events.mjs";

const PROVIDERS = {
  typesafe: { endpoint: "https://api.typesafe.ai/v1/systemone", model: "jev-latest", keyEnv: "TYPESAFE_API_KEY" },
  openrouter: { endpoint: "https://openrouter.ai/api/v1/systemone", model: "typesafe/jev-1.13", keyEnv: "OPENROUTER_API_KEY" },
  vercel: { endpoint: "https://ai-gateway.vercel.sh/typesafe/v1/systemone", model: "typesafe-ai/jev", keyEnv: "AI_GATEWAY_API_KEY" },
  custom: {},
};

export function resolveJevConfig(profile) {
  const preset = PROVIDERS[profile.jev.provider] ?? {};
  const explicit = profile.jev.provider === "custom" || profile.jev.provider === "typesafe";
  return {
    ...profile.jev,
    endpoint: explicit || !preset.endpoint ? profile.jev.endpoint : preset.endpoint,
    model: explicit || !preset.model ? profile.jev.model : preset.model,
    keyEnv: explicit || !preset.keyEnv ? profile.jev.keyEnv : preset.keyEnv,
  };
}

function toRegExp(p) {
  const m = p.match(/^\(\?([a-z]+)\)(.*)$/);
  return m ? new RegExp(m[2], m[1].replace(/[^gimsuy]/g, "") + "g") : new RegExp(p, "g");
}

export function redactState(state, patterns = []) {
  let text = typeof state === "string" ? state : JSON.stringify(state);
  for (const p of patterns) text = text.replace(toRegExp(p), "[redacted]");
  return typeof state === "string" ? text : JSON.parse(text);
}

export async function askJev(cwd, state, questions, { profile, purpose = "unknown", fetchImpl = globalThis.fetch, env = process.env, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const cfg = resolveJevConfig(profile);
  const started = Date.now();
  const id = randomUUID();
  const finish = (record) => {
    const row = { id, ts: new Date().toISOString(), purpose, latencyMs: Date.now() - started, ...record };
    appendEvent(cwd, { type: "jev", id, purpose, ok: Boolean(record.ok), skipped: Boolean(record.skipped), reason: record.reason, latencyMs: row.latencyMs, usage: record.usage });
    appendLine(harnessPaths(cwd).jev, JSON.stringify(row));
    return { id, ...record };
  };
  if (!cfg.enabled) return finish({ ok: false, skipped: true, reason: "jev disabled in profile" });
  const key = env[cfg.keyEnv];
  if (!key) return finish({ ok: false, skipped: true, reason: `no key in ${cfg.keyEnv}` });

  let body = redactState(state, cfg.redact);
  let text = typeof body === "string" ? body : JSON.stringify(body);
  let truncated = false;
  if (text.length > cfg.maxStateChars) { text = text.slice(0, cfg.maxStateChars); body = text; truncated = true; }
  const stateSha = createHash("sha256").update(text).digest("hex").slice(0, 16);
  const payload = { model: cfg.model, state: body, questions };

  const attempt = async () => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs);
    try {
      return await fetchImpl(cfg.endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify(payload), signal: ctl.signal });
    } finally { clearTimeout(timer); }
  };

  try {
    let res = await attempt();
    if (res.status === 429) {
      const wait = Math.min(Number(res.headers?.get?.("retry-after") ?? 1) * 1000, 5000);
      await sleep(wait);
      res = await attempt();
    }
    if (res.status === 422) {
      const detail = await res.text();
      throw new Error(`Jev rejected the request (422): questions file is wrong: ${detail.slice(0, 500)}`);
    }
    if (res.status === 400) {
      const detail = await res.text();
      return finish({ ok: false, skipped: true, reason: /guardrail_uninspectable/.test(detail) ? "guardrail_uninspectable" : `bad request: ${detail.slice(0, 200)}`, stateSha });
    }
    if (res.status === 401 || res.status === 403) return finish({ ok: false, skipped: true, reason: `auth ${res.status}`, stateSha });
    if (!res.ok) return finish({ ok: false, skipped: true, reason: `http ${res.status}`, stateSha });
    const data = await res.json();
    return finish({ ok: true, skipped: false, model: data.model, answers: data.answers, usage: data.usage, stateSha, truncated, questions: Object.keys(questions), requestId: res.headers?.get?.("x-typesafe-request-id") ?? null });
  } catch (err) {
    if (err?.message?.includes("422")) throw err;
    return finish({ ok: false, skipped: true, reason: err.name === "AbortError" ? `timeout after ${cfg.timeoutMs}ms` : `error: ${err.message}`, stateSha });
  }
}

export function noul(answers, name) {
  const a = answers?.[name];
  return typeof a?.noul === "number" ? a.noul : null;
}
export function choice(answers, name) {
  const a = answers?.[name];
  return a?.choice ? { choice: a.choice, confidence: a.confidence ?? null, probabilities: a.probabilities ?? {} } : null;
}
