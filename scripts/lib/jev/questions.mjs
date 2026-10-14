import { join, isAbsolute } from "node:path";
import { readJson } from "../io.mjs";
import { pluginRoot } from "../paths.mjs";

export function loadQuestions(profile) {
  const file = profile.jev.questionsFile;
  return readJson(isAbsolute(file) ? file : join(pluginRoot(), file));
}
