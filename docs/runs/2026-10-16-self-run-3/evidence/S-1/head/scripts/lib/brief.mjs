import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pluginRoot } from "./paths.mjs";

// Stage briefs are markdown files with {{key}} placeholders. The Stop hook injects only the
// brief for the current stage, never the whole protocol, to keep context small.
export function renderBrief(name, vars = {}) {
  const text = readFileSync(join(pluginRoot(), "briefs", `${name}.md`), "utf8");
  return text.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, key) => {
    const v = vars[key];
    if (v === undefined || v === null) return "";
    return Array.isArray(v) ? v.join(", ") : String(v);
  }).trim();
}
