// Reconciliation prefilter: one yes/no per undecided inventory item. Buckets narrow what the
// reconciler reads; nothing is marked done by Jev alone.
import { askJev, noul } from "./client.mjs";
import { loadQuestions } from "./questions.mjs";
import { git, changedFiles } from "../git.mjs";

export async function jevPrefilter(cwd, input, { profile, fetchImpl, env } = {}) {
  const q = loadQuestions(profile);
  const b = profile.jev.buckets;
  const commits = git(cwd, ["log", "--pretty=%s", "-n", "100"]).out.split("\n").filter(Boolean);
  const context = { commits, changedFiles: changedFiles(cwd).slice(0, 200) };
  const results = {};
  let skipped = 0;
  for (const item of input.items) {
    if (item.decided) continue;
    const r = await askJev(cwd, { item: { id: item.id, title: item.title, criteria: item.criteria, evidence: item.evidence }, context }, q.inventory, { profile, fetchImpl, env, purpose: `inventory:${item.id}` });
    if (!r.ok) { skipped++; continue; }
    const p = noul(r.answers, "implemented");
    if (p === null) continue;
    const bucket = p <= b.missingBelow ? "jev_missing" : p >= b.doneAbove ? "jev_done" : "jev_uncertain";
    item.bucket = bucket;
    item.jev = { answerId: r.id, implemented: p };
    results[item.id] = { bucket, p };
  }
  return { results, skipped, counts: Object.values(results).reduce((c, r) => ({ ...c, [r.bucket]: (c[r.bucket] ?? 0) + 1 }), {}) };
}
