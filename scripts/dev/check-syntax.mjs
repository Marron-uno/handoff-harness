#!/usr/bin/env node
// Syntax-checks every .mjs file under scripts/ and tests/ without executing it.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".mjs")) out.push(p);
  }
  return out;
}
let failed = 0;
for (const file of [...walk("scripts"), ...walk("tests")]) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) { failed++; process.stderr.write(r.stderr); }
}
console.log(failed ? `${failed} file(s) failed syntax check` : "syntax ok");
process.exit(failed ? 1 : 0);
