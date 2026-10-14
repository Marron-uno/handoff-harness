import { test } from "node:test";
import assert from "node:assert/strict";
import { createNote, listNotes } from "../src/notes.mjs";

test("createNote requires a title", () => {
  assert.throws(() => createNote([], { title: " " }), /title is required/);
});

test("listNotes returns a copy", () => {
  const store = [];
  createNote(store, { title: "a" });
  const list = listNotes(store);
  list.pop();
  assert.equal(store.length, 1);
});
