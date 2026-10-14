# Handoff: Lantern Notes v0.2

Synthetic handoff for the harness fixture. Every item has a stable id so reconciliation can walk it.

## I-1 Create a note
- C-1: `createNote` rejects an empty title.
- C-2: a created note has an id, title, body, tags and createdAt.

## I-2 List notes newest first
- C-3: `listNotes` returns notes sorted by createdAt descending.
- C-4: the returned array is a copy, not the store.

## I-3 Filter by tag
- C-5: `listNotes(store, { tag })` returns only notes carrying that tag.

## I-4 Export to markdown
- C-6: `exportMarkdown(store)` returns one `## title` section per note with the body below it.

## I-5 Note count on the page (UI)
- C-7: the page at `/` shows "N notes" where N is the number of notes in the store.

## Open questions
- Should tags be case-insensitive? Default: yes, compare lowercased.
- What is the public URL of the deployed page? Hold: only the owner knows.
