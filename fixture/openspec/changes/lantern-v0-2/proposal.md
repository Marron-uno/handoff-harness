# Change: Lantern Notes v0.2

## Why

The handoff in `handoff/HANDOFF.md` asks for sorting, tag filtering, markdown export and a note count on the page. None of these exist yet.

## What Changes

- Sort `listNotes` newest first.
- Filter `listNotes` by tag, case-insensitive (default D-1 applied).
- Add `exportMarkdown`.
- Show the note count on the page.

## Impact

- Affected specs: `notes`
- Affected code: `src/notes.mjs`, `src/export.mjs`, `public/index.html`
