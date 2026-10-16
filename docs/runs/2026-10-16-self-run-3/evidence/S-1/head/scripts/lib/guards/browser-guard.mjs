// Browser lane: hosts are fixture, preview or prod. Outside fixture and preview hosts the
// browser is read-only, prod needs a per-goal opt-in, typed text is scanned for secrets,
// and browser actions are budgeted.
import { scanText } from "./secret-scan.mjs";

export function hostOf(url) {
  try { return new URL(String(url)).hostname.toLowerCase(); } catch { return null; }
}

export function classifyHost(host, profile) {
  if (!host) return "unknown";
  const inList = (list) => list.some((h) => h.toLowerCase() === host || (h.startsWith("*.") && host.endsWith(h.slice(1))));
  if (inList(profile.hosts.fixture)) return "fixture";
  if (inList(profile.hosts.preview)) return "preview";
  if (inList(profile.hosts.prod)) return "prod";
  return "unknown";
}

function typedText(tool, input) {
  if (tool.endsWith("form_input")) return JSON.stringify(input?.fields ?? input?.values ?? input ?? "");
  if (tool.endsWith("computer")) return String(input?.text ?? "");
  if (tool.endsWith("javascript_tool")) return String(input?.code ?? input?.script ?? "");
  return "";
}

export function checkBrowserTool({ tool, input = {}, state, profile }) {
  const short = tool.replace("mcp__claude-in-chrome__", "");
  const result = { deny: false, host: state?.browser?.lastHost ?? null };

  if (short === "navigate") {
    const host = hostOf(input.url);
    const kind = classifyHost(host, profile);
    result.host = host;
    result.kind = kind;
    if (kind === "prod" && !state?.goal?.environments?.prod) {
      return { deny: true, guard: "browser-prod", reason: `Blocked: ${host} is a production host and this goal did not opt in (\`harness goal new --prod\`).`, host };
    }
    return result;
  }

  if (state && state.counters.browserActions >= profile.budgets.browserActionsPerReview) {
    return { deny: true, guard: "browser-budget", reason: `Blocked: browser action budget of ${profile.budgets.browserActionsPerReview} reached for this review. Write the verdict with what you have.` };
  }

  const kind = classifyHost(result.host, profile);
  const writeOnly = profile.browser.readOnlyToolsOutsideFixture.includes(tool)
    || (short === "computer" && profile.browser.typingActions.includes(String(input.action ?? "")));
  if (writeOnly && kind !== "fixture" && kind !== "preview") {
    return { deny: true, guard: "browser-readonly", reason: `Blocked: ${short} on ${result.host ?? "an unknown host"} (${kind}). Outside fixture and preview hosts the browser is read-only: navigate, read, screenshot, inspect console and network.` };
  }
  const text = typedText(tool, input);
  if (text) {
    const hits = scanText(text, { allow: profile.secrets.allow, extraPatterns: profile.secrets.extraPatterns });
    if (hits.length) return { deny: true, guard: "browser-secret", reason: `Blocked: typed text looks like a credential (${hits.map((h) => h.pattern).join(", ")}). Only fixture credentials from .harness/profile.json may be typed.` };
  }
  return result;
}
