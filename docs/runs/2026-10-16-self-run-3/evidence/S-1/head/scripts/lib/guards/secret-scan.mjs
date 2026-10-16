// Secret scanner for written content and diffs. Patterns are deliberately conservative;
// the profile allow-list names fixture values that are safe by construction.
const PATTERNS = [
  { id: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: "github-token", re: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g },
  { id: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: "stripe-live-key", re: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/g },
  { id: "openai-key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { id: "private-key-block", re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { id: "generic-assignment", re: /\b(password|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)\b\s*[:=]\s*["']?([^\s"',;]{8,})/gi, valueGroup: 2 },
  { id: "url-credentials", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:([^\s/@]{4,})@/gi, valueGroup: 1 },
];
const PLACEHOLDER = /(example|placeholder|changeme|change-me|your[-_]|<[^>]+>|\$\{|xxx|\*\*\*|dummy|sample|fixture|not-real|redacted|TODO)/i;

export function scanText(text, { allow = [], extraPatterns = [] } = {}) {
  const findings = [];
  const patterns = [...PATTERNS, ...extraPatterns.map((p, i) => ({ id: `extra-${i}`, re: new RegExp(p, "g") }))];
  const lines = String(text).split("\n");
  lines.forEach((line, idx) => {
    for (const p of patterns) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(line))) {
        const value = p.valueGroup ? m[p.valueGroup] : m[0];
        if (allow.some((a) => value.includes(a) || line.includes(a))) continue;
        if (p.valueGroup && PLACEHOLDER.test(value)) continue;
        if (p.id === "generic-assignment" && /^(process\.env|env\(|os\.environ|\$|import|require|getenv|config\.|secrets\.|true|false|null|undefined|string|number|<)/i.test(value)) continue;
        const masked = mask(value);
        // A specific pattern already explained this value; skip the generic one.
        if (findings.some((f) => f.line === idx + 1 && (f.match === masked || line.indexOf(value) >= 0 && f.pattern !== "generic-assignment" && p.id === "generic-assignment"))) continue;
        findings.push({ pattern: p.id, line: idx + 1, match: masked });
      }
    }
  });
  return findings;
}

function mask(v) {
  return v.length <= 8 ? "*".repeat(v.length) : v.slice(0, 3) + "*".repeat(Math.min(v.length - 6, 12)) + v.slice(-3);
}
