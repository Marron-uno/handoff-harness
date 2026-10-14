import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpDir, initRepo, write, commitAll } from "./helpers.mjs";
import { diffHash, changedFiles, diffStat, currentBranch, defaultBranch, isClean, lastCommitSubject } from "../scripts/lib/git.mjs";

test("diffHash changes with tracked and untracked edits and returns after revert", () => {
  const dir = initRepo(tmpDir());
  const h0 = diffHash(dir);
  write(dir, "README.md", "# fixture\nmore\n");
  const h1 = diffHash(dir);
  assert.notEqual(h0, h1);
  write(dir, "new.txt", "hello\n");
  const h2 = diffHash(dir);
  assert.notEqual(h1, h2);
  assert.deepEqual(changedFiles(dir), ["README.md", "new.txt"]);
  const stat = diffStat(dir);
  assert.equal(stat.added, 3);
  commitAll(dir, "feat: S-1 add new", ["README.md", "new.txt"]);
  assert.equal(diffHash(dir), h0);
  assert.ok(isClean(dir));
  assert.equal(lastCommitSubject(dir), "feat: S-1 add new");
});

test("branch helpers", () => {
  const dir = initRepo(tmpDir());
  assert.equal(currentBranch(dir), "main");
  assert.equal(defaultBranch(dir), "main");
});
