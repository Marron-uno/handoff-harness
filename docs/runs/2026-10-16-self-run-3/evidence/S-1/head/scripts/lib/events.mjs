import { appendLine, readLines, nowIso } from "./io.mjs";
import { harnessPaths } from "./paths.mjs";

// Append-only structured log. Prose reports are rendered from this, never the other way round.
export function appendEvent(cwd, event) {
  const record = { ts: nowIso(), ...event };
  appendLine(harnessPaths(cwd).events, JSON.stringify(record));
  return record;
}

export function readEvents(cwd, filter = () => true) {
  return readLines(harnessPaths(cwd).events)
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter((e) => e && filter(e));
}

export function lastEvent(cwd, type) {
  const events = readEvents(cwd, (e) => e.type === type);
  return events.length ? events[events.length - 1] : null;
}
