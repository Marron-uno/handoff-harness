// Prose lint for markdown and text: no em dashes, no banned phrases.
import { extname } from "node:path";
import { stripNonProse } from "./language-guard.mjs";

const PROSE = new Set([".md", ".mdx", ".txt"]);

export function lintProse(path, content, cfg) {
  if (!PROSE.has(extname(path).toLowerCase())) return [];
  const findings = [];
  const lines = stripNonProse(content).split("\n");
  lines.forEach((line, i) => {
    if (cfg.banEmDash && /—|–/.test(line)) findings.push({ path, line: i + 1, rule: "em-dash", sample: line.trim().slice(0, 80) });
    for (const phrase of cfg.bannedPhrases ?? []) {
      if (line.toLowerCase().includes(phrase.toLowerCase())) findings.push({ path, line: i + 1, rule: `banned-phrase:${phrase}`, sample: line.trim().slice(0, 80) });
    }
  });
  return findings;
}
