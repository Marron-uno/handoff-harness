# Notes

## Purpose

Core behavior of the Lantern Notes library: creating and listing notes.

## Requirements

### Requirement: Create a note

The library SHALL reject a note without a non-empty title and SHALL assign an id, the trimmed title, a body, tags and a creation timestamp to every created note.

#### Scenario: Empty title

- **WHEN** `createNote` is called with a blank title
- **THEN** it throws an error mentioning that the title is required

#### Scenario: Valid note

- **WHEN** `createNote` is called with a title
- **THEN** the returned note has `id`, `title`, `body`, `tags` and `createdAt`

### Requirement: List notes

The library SHALL return a copy of the store from `listNotes`, so callers cannot mutate it.

#### Scenario: Copy

- **WHEN** a caller mutates the array returned by `listNotes`
- **THEN** the store is unchanged
