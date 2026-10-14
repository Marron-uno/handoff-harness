// Trace classification: every guard denial, stop-hook block, halt and invalid verdict gets a
// category and a reusable score. Reusable ones become lesson stubs with the event cited.
import { appendLine } from "../io.mjs";
import { harnessPaths } from "../paths.mjs";
import { readEvents, appendEvent } from "../events.mjs";
import { askJev, noul, choice } from "./client.mjs";
import { loadQuestions } from "./questions.mjs";

const INTERESTING = new Set(["guard", "block", "halt"]);

export async function jevClassifyTrace(cwd, { profile, state, fetchImpl, env, since = null } = {}) {
  const q = loadQuestions(profile);
  const th = profile.jev.thresholds.reusable;
  const done = new Set(readEvents(cwd, (e) => e.type === "lesson").map((e) => e.source));
  const events = readEvents(cwd, (e) => (INTERESTING.has(e.type) || (e.type === "verdict" && e.valid === false)) && (!since || e.ts >= since));
  const lessons = [];
  let skipped = 0;
  for (const e of events) {
    const source = `${e.ts}:${e.type}:${e.guard ?? e.code ?? e.role ?? ""}`;
    if (done.has(source)) continue;
    const r = await askJev(cwd, { event: e, goal: state?.goal?.sentence }, q.trace, { profile, fetchImpl, env, purpose: `trace:${e.type}` });
    if (!r.ok) { skipped++; continue; }
    const cat = choice(r.answers, "category");
    const reusable = noul(r.answers, "reusable");
    appendEvent(cwd, { type: "lesson", source, category: cat?.choice ?? null, reusable, answerId: r.id, written: reusable !== null && reusable >= th });
    if (reusable !== null && reusable >= th) {
      const line = `- ${e.ts.slice(0, 10)} [${cat?.choice ?? "uncategorized"}] ${describe(e)} (event ${source}, p=${reusable.toFixed(2)})`;
      appendLine(harnessPaths(cwd).lessons, line);
      lessons.push(line);
    }
  }
  return { considered: events.length, lessons, skipped };
}

function describe(e) {
  if (e.type === "guard") return `guard ${e.guard} denied ${e.tool} in stage ${e.stage}: ${String(e.reason ?? "").slice(0, 120)}`;
  if (e.type === "block") return `stop hook blocked in stage ${e.stage} (${e.code})`;
  if (e.type === "halt") return `run halted: ${e.code}, ${String(e.reason ?? "").slice(0, 120)}`;
  if (e.type === "verdict") return `invalid verdict from ${e.agent ?? e.role}: ${(e.errors ?? []).slice(0, 2).join("; ")}`;
  return e.type;
}
