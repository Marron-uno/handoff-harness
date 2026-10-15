// The judge's packet: one file with everything a critic needs, written by `harness preflight`, so
// the critic reads one path instead of exploring the tree. Deterministic: the slice, the text of
// its criteria from the inventory, declared paths, the defaults and human decisions that apply,
// changed files with counts, and the diff against HEAD with untracked files included as additions,
// since `git diff HEAD` alone leaves new files out.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { harnessPaths } from "./paths.mjs";
import { readJson } from "./io.mjs";
import { currentSlice } from "./state.mjs";
import { diffText, diffStat, untrackedDiffText, workHash } from "./git.mjs";

export function packetPath(cwd, state) {
  if (!state.slice) return null;
  return join(harnessPaths(cwd).packets, `${state.slice.id}-a${state.slice.attempt}.md`);
}

function cap(text, maxLines) {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return { text, truncated: false, lines: lines.length };
  return { text: lines.slice(0, maxLines).join("\n") + `\n... truncated after ${maxLines} of ${lines.length} lines; run git diff for the rest`, truncated: true, lines: lines.length };
}

export function writePacket(cwd, state, profile) {
  const slice = currentSlice(state);
  if (!slice) throw new Error("no active slice; the packet is written for the slice under judgment");
  const maxLines = profile.budgets?.diffLinesPerSlice ?? 1200;
  const inventory = readJson(harnessPaths(cwd).inventory, { items: [] });
  const criteria = [];
  for (const item of inventory.items ?? []) for (const c of item.criteria ?? []) if (slice.criteria.includes(c.id)) criteria.push({ ...c, item, source: item.source ?? (inventory.sources?.length ? inventory.sources.join(", ") : "goal sentence") });
  const stat = diffStat(cwd);
  const diff = cap([diffText(cwd), untrackedDiffText(cwd)].filter(Boolean).join("\n"), maxLines);
  const decisions = (state.defaults ?? []).filter((d) => !d.slice || d.slice === slice.id);
  const L = [];
  L.push(`# Packet: ${slice.id} "${slice.title}", attempt ${state.slice.attempt}`, "");
  L.push(`Goal ${state.goal.id}: ${state.goal.sentence}. Work hash ${workHash(cwd)}. Written by the preflight script; the diff below is what the judges judge.`, "");
  L.push("## Criteria", "");
  for (const c of criteria) L.push(`- ${c.id} (${c.item.id} "${c.item.title}"${c.item.ui || slice.ui ? ", ui" : ""}, source ${c.source}): ${c.text}`);
  for (const id of slice.criteria.filter((id) => !criteria.some((c) => c.id === id))) L.push(`- ${id}: not in the inventory`);
  L.push("", "## Declared paths", "", slice.paths.length ? slice.paths.map((p) => `- ${p}`).join("\n") : "- none declared");
  if (decisions.length) {
    L.push("", "## Defaults and decisions", "", "Applied at intake or decided by a human after approval. A finding that rests on one cites it as `decision:D-n`.", "");
    for (const d of decisions) L.push(`- ${d.id}${d.slice ? ` (${d.slice})` : ""}: ${d.question} → ${d.chosen}`);
  }
  L.push("", "## Changed files", "", "| File | Added | Deleted |", "|---|---|---|");
  for (const f of stat.files) L.push(`| ${f.file}${f.untracked ? " (new)" : ""}${f.binary ? " (binary)" : ""} | ${f.added} | ${f.deleted} |`);
  L.push("", `${stat.added} lines added, ${stat.deleted} deleted in ${stat.files.length} files. Binary files count as 0 lines.`);
  L.push("", "## Diff against HEAD", "", "New files appear as additions against /dev/null. Binary files are named, not shown.", "", "```diff", diff.text.trimEnd(), "```");
  const path = packetPath(cwd, state);
  mkdirSync(harnessPaths(cwd).packets, { recursive: true });
  writeFileSync(path, L.join("\n") + "\n");
  return { path, criteria: criteria.length, files: stat.files.length, diffLines: diff.lines, truncated: diff.truncated };
}
