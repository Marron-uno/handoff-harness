## MODIFIED Requirements

### Requirement: List notes

The library SHALL return a copy of the store from `listNotes`, sorted by `createdAt` descending, and SHALL filter by tag when `{ tag }` is given, comparing tags case-insensitively.

#### Scenario: Copy

- **WHEN** a caller mutates the array returned by `listNotes`
- **THEN** the store is unchanged

#### Scenario: Newest first

- **WHEN** two notes exist with different `createdAt`
- **THEN** the newer one comes first

#### Scenario: Tag filter

- **WHEN** `listNotes(store, { tag: "Work" })` is called
- **THEN** only notes tagged `work` in any case are returned

## ADDED Requirements

### Requirement: Export to markdown

The library SHALL export the store as markdown with one `## <title>` section per note followed by its body.

#### Scenario: One section per note

- **WHEN** `exportMarkdown` is called with two notes
- **THEN** the output contains two `## ` headings in store order
