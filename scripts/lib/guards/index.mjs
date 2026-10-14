// Guard checks that preflight runs over the changed file set.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { checkFileLanguage } from "./language-guard.mjs";
import { lintProse } from "./prose-lint.mjs";
import { scanText } from "./secret-scan.mjs";
import { diffText, git } from "../git.mjs";
import { currentSlice } from "../state.mjs";
import { globToRegExp } from "../glob.mjs";

function contentOf(cwd, file) {
  const p = join(cwd, file);
  if (!existsSync(p) || !statSync(p).isFile() || statSync(p).size > 2 * 1024 * 1024) return null;
  const buf = readFileSync(p);
  if (buf.includes(0)) return null; // binary
  return buf.toString("utf8");
}

export function guardChecks(profile) {
  return [
    {
      id: "language",
      run(cwd, files) {
        const hits = [];
        for (const f of files) { const c = contentOf(cwd, f); if (c !== null) hits.push(...checkFileLanguage(f, c, profile.language)); }
        return hits.length ? { status: "fail", details: hits.slice(0, 5).map((h) => `${h.path}:${h.line} looks ${h.lang} (${h.hits} vs ${h.englishHits} en): "${h.sample}"`).join("\n") } : { status: "pass", details: `${files.length} files English` };
      },
    },
    {
      id: "secrets",
      run(cwd, files) {
        const hits = [];
        for (const f of files) { const c = contentOf(cwd, f); if (c !== null) for (const h of scanText(c, { allow: profile.secrets.allow, extraPatterns: profile.secrets.extraPatterns })) hits.push(`${f}:${h.line} ${h.pattern} ${h.match}`); }
        return hits.length ? { status: "fail", details: hits.slice(0, 10).join("\n") } : { status: "pass", details: "no secrets in changed files" };
      },
    },
    {
      id: "prose",
      run(cwd, files) {
        const hits = [];
        for (const f of files) { const c = contentOf(cwd, f); if (c !== null) hits.push(...lintProse(f, c, profile.prose)); }
        return hits.length ? { status: "fail", details: hits.slice(0, 10).map((h) => `${h.path}:${h.line} ${h.rule}: "${h.sample}"`).join("\n") } : { status: "pass", details: "prose clean" };
      },
    },
    {
      id: "test_weakening",
      run(cwd, files) {
        const diff = diffText(cwd);
        const removedTests = (diff.match(/^-\s*(it|test|describe)\s*\(/gm) ?? []).length;
        const addedTests = (diff.match(/^\+\s*(it|test|describe)\s*\(/gm) ?? []).length;
        const skipped = (diff.match(/^\+\s*(it|test|describe)\.(skip|todo)\s*\(/gm) ?? []).length + (diff.match(/^\+.*\b(xit|xtest|xdescribe)\s*\(/gm) ?? []).length;
        const deletedTestFiles = (git(cwd, ["diff", "--name-only", "--diff-filter=D", "HEAD"]).out || "").split("\n").filter((f) => /\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py|rb)$|tests?\//.test(f));
        const problems = [];
        if (deletedTestFiles.length) problems.push(`deleted test files: ${deletedTestFiles.join(", ")}`);
        if (skipped) problems.push(`${skipped} test(s) skipped`);
        if (removedTests > addedTests) problems.push(`${removedTests} test blocks removed, ${addedTests} added`);
        return problems.length ? { status: "fail", details: problems.join("; ") + ". Record the reason in the slice criteria or restore the tests." } : { status: "pass", details: `+${addedTests} -${removedTests} test blocks` };
      },
    },
    {
      id: "dependencies",
      run(cwd, files, state) {
        const manifests = files.filter((f) => /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|Gemfile|go\.mod|Cargo\.toml|composer\.json)$/.test(f));
        if (!manifests.length) return { status: "pass", details: "no dependency manifest changed" };
        const slice = state ? currentSlice(state) : null;
        const declared = slice?.paths?.map(globToRegExp) ?? [];
        const undeclared = manifests.filter((m) => !declared.some((re) => re.test(m)));
        return undeclared.length ? { status: "fail", details: `dependency manifest changed outside the slice's declared paths: ${undeclared.join(", ")}. Add it to the slice paths in plan.json if intended.` } : { status: "pass", details: manifests.join(", ") };
      },
    },
  ];
}
