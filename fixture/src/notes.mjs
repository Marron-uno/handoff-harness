// Lantern Notes core. The handoff asks for more than this implements.
export function createNote(store, { title, body = "", tags = [] }) {
  if (!title || !title.trim()) throw new Error("title is required");
  const note = { id: store.length + 1, title: title.trim(), body, tags, createdAt: new Date().toISOString() };
  store.push(note);
  return note;
}

export function listNotes(store) {
  return [...store];
}
