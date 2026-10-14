import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpDir, PLUGIN_ROOT } from "./helpers.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";
import { scanText } from "../scripts/lib/guards/secret-scan.mjs";
import { checkBrowserTool, classifyHost } from "../scripts/lib/guards/browser-guard.mjs";

const profile = loadProfile(tmpDir(), PLUGIN_ROOT);
profile.hosts.preview = ["*.preview.example"];
profile.hosts.prod = ["app.example"];

test("secret scan catches real-looking credentials and ignores placeholders and env lookups", () => {
  const hits = scanText([
    "AWS_KEY=AKIAIOSFODNN7EXAMPLE",
    "token: ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    'password = "s3cr3t-value-here"',
    "password = process.env.DB_PASSWORD",
    'api_key: "<your-api-key>"',
    "token=fixture-token-not-real",
    "-----BEGIN RSA PRIVATE KEY-----",
    "postgres://user:hunter22pass@db.internal/app",
  ].join("\n"), { allow: ["fixture-token-not-real"] });
  const ids = hits.map((h) => `${h.line}:${h.pattern}`);
  assert.deepEqual(ids, ["1:aws-access-key", "2:github-token", "3:generic-assignment", "7:private-key-block", "8:url-credentials"]);
  assert.ok(hits.every((h) => !h.match.includes("s3cr3t-value-here")), "matches are masked");
});

test("hosts classify from the profile lists with wildcard subdomains", () => {
  assert.equal(classifyHost("localhost", profile), "fixture");
  assert.equal(classifyHost("pr-12.preview.example", profile), "preview");
  assert.equal(classifyHost("app.example", profile), "prod");
  assert.equal(classifyHost("docs.example.org", profile), "unknown");
});

test("browser lane: read-only outside fixture and preview, prod needs opt-in, secrets never typed", () => {
  const state = { goal: { environments: { prod: false } }, browser: { lastHost: null }, counters: { browserActions: 0 } };
  const nav = (url) => checkBrowserTool({ tool: "mcp__claude-in-chrome__navigate", input: { url }, state, profile });
  assert.equal(nav("http://localhost:4173/").deny, false);
  assert.equal(nav("https://app.example/").guard, "browser-prod");
  state.goal.environments.prod = true;
  const prod = nav("https://app.example/login");
  assert.equal(prod.deny, false);
  assert.equal(prod.kind, "prod");
  state.browser.lastHost = prod.host;
  assert.equal(checkBrowserTool({ tool: "mcp__claude-in-chrome__form_input", input: { fields: [{ value: "x" }] }, state, profile }).guard, "browser-readonly");
  assert.equal(checkBrowserTool({ tool: "mcp__claude-in-chrome__computer", input: { action: "type", text: "hello" }, state, profile }).guard, "browser-readonly");
  assert.equal(checkBrowserTool({ tool: "mcp__claude-in-chrome__computer", input: { action: "screenshot" }, state, profile }).deny, false);
  assert.equal(checkBrowserTool({ tool: "mcp__claude-in-chrome__read_page", input: {}, state, profile }).deny, false);
  state.browser.lastHost = "localhost";
  assert.equal(checkBrowserTool({ tool: "mcp__claude-in-chrome__form_input", input: { fields: [{ value: "fixture-token-not-real" }] }, state, profile }).deny, false);
  assert.equal(checkBrowserTool({ tool: "mcp__claude-in-chrome__computer", input: { action: "type", text: "ghp_abcdefghijklmnopqrstuvwxyz0123456789" }, state, profile }).guard, "browser-secret");
  state.counters.browserActions = profile.budgets.browserActionsPerReview;
  assert.equal(checkBrowserTool({ tool: "mcp__claude-in-chrome__read_page", input: {}, state, profile }).guard, "browser-budget");
});
