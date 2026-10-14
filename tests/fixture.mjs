import { cpSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpDir, sh, PLUGIN_ROOT, runCli, runHook } from "./helpers.mjs";

// Copies the synthetic fixture into a temp git repo with one commit.
export function fixtureRepo() {
  const dir = tmpDir("hh-fixture-");
  cpSync(join(PLUGIN_ROOT, "fixture"), dir, { recursive: true });
  sh(dir, "git", ["init", "-q", "-b", "main"]);
  sh(dir, "git", ["config", "user.email", "test@example.com"]);
  sh(dir, "git", ["config", "user.name", "Test"]);
  sh(dir, "git", ["config", "commit.gpgsign", "false"]);
  sh(dir, "git", ["add", "."]);
  sh(dir, "git", ["commit", "-q", "-m", "fixture: initial"]);
  return dir;
}

export function writeIntake(dir) {
  const inventory = {
    goal: "G-1", sources: ["handoff/HANDOFF.md"],
    items: [
      { id: "I-1", kind: "criterion", title: "Create a note", criteria: [{ id: "C-1", text: "rejects empty title" }, { id: "C-2", text: "note has fields" }], ui: false },
      { id: "I-2", kind: "criterion", title: "List newest first", criteria: [{ id: "C-3", text: "sorted desc" }, { id: "C-4", text: "copy" }], ui: false },
      { id: "I-4", kind: "criterion", title: "Export markdown", criteria: [{ id: "C-6", text: "one section per note" }], ui: false },
    ],
  };
  const plan = {
    goal: "G-1",
    slices: [
      { id: "S-1", title: "List notes newest first", criteria: ["C-3", "C-4"], paths: ["src/**", "tests/**"], ui: false },
      { id: "S-2", title: "Export to markdown", criteria: ["C-6"], paths: ["src/**", "tests/**"], dependsOn: ["S-1"], ui: false },
    ],
    questions: [
      { id: "D-1", question: "Tags case-insensitive?", kind: "default", chosen: "yes, lowercase compare" },
      { id: "H-1", question: "Public URL of the deployed page?", kind: "hold", blocks: [] },
    ],
  };
  mkdirSync(join(dir, ".harness"), { recursive: true });
  writeFileSync(join(dir, ".harness", "inventory.json"), JSON.stringify(inventory, null, 2));
  writeFileSync(join(dir, ".harness", "plan.json"), JSON.stringify(plan, null, 2));
  writeFileSync(join(dir, ".harness", "goal-card.md"), "# GOAL G-1\nBuild all of the handoff\n");
}

export function state(dir) { return JSON.parse(readFileSync(join(dir, ".harness", "state.json"), "utf8")); }
export function hash(dir) { return runCli(dir, ["hash"]).json.diffHash; }
export function stop(dir, extra = {}) { return runHook("stop", { cwd: dir, hook_event_name: "Stop", stop_hook_active: false, ...extra }); }

export function writeVerdict(dir, path, { agent, slice, attempt, round, verdict, findings = [], criteria = [] }) {
  // Met criteria need evidence; the fixture's README always exists.
  const withEvidence = criteria.map((c) => (c.status === "met" && !c.evidence ? { ...c, evidence: [{ type: "file", path: "README.md" }] } : c));
  const v = { version: 1, agent, goal: "G-1", slice, attempt, round, diffHash: hash(dir), verdict, summary: `${agent} ${verdict}`, findings, criteria: withEvidence, writtenAt: new Date().toISOString() };
  mkdirSync(join(dir, ".harness", "verdicts"), { recursive: true });
  writeFileSync(path, JSON.stringify(v, null, 2));
  return v;
}
