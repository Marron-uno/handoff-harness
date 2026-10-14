# Goal card: G-1

> build all of the handoff

**Sources:** handoff/HANDOFF.md, openspec/changes/lantern-v0-2/{proposal,tasks,specs/notes/spec}.md, openspec/specs/notes/spec.md

**Scope:** 5 inventory items (I-1..I-5), 7 criteria (C-1..C-7), 1 UI item (I-5). C-1, C-2 and C-4 appear already implemented; they get verified and covered by tests.

**Slices**
- S-1: Listing: sort newest first, copy, case-insensitive tag filter (C-1..C-5) — `src/notes.mjs`, tests
- S-2: exportMarkdown (C-6) — `src/export.mjs`, tests; depends on S-1
- S-3: Note count on `/` (C-7, UI, browser-verified) — `public/**`, `src/server.mjs`; depends on S-1

**Estimate:** about $4 and 33 minutes.

**Defaults applied**
- D-1: tags are case-insensitive (compared lowercased).

**Holds**
- H-1: public URL of the deployed page. Only the owner knows. It blocks no slice, and no deploy or prod host is touched.

Approve with: `node "/Users/jmarron/Developer/personal/handoff-harness/scripts/cli.mjs" goal approve`
