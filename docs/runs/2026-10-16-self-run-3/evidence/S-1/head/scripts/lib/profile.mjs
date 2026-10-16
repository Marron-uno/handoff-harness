import { join } from "node:path";
import { readJson } from "./io.mjs";
import { harnessPaths, pluginRoot } from "./paths.mjs";

function deepMerge(base, over) {
  if (Array.isArray(base) || Array.isArray(over) || typeof base !== "object" || typeof over !== "object" || !base || !over) {
    return over === undefined ? base : over;
  }
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = deepMerge(base[k], v);
  return out;
}

// Profile = plugin defaults deep-merged with the project's .harness/profile.json.
export function loadProfile(cwd, root = pluginRoot()) {
  const defaults = readJson(join(root, "profiles", "default.json"));
  const local = readJson(harnessPaths(cwd).profile, {});
  return deepMerge(defaults, local);
}
