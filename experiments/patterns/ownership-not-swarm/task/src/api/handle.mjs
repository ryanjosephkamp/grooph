import { addNote, listNotes } from "../db/store.mjs";

/**
 * Request handlers over a store: `handle({ method, path, body })` returns
 * `{ status, body }`. Unknown routes are 404; a bad body is 400.
 */
export function createHandler(store) {
  return function handle(request) {
    const { method, path, body } = request;
    if (method === "POST" && path === "/notes") {
      if (typeof body?.text !== "string") return { status: 400, body: { error: "text required" } };
      try {
        return { status: 201, body: addNote(store, body.text) };
      } catch (err) {
        return { status: 400, body: { error: err.message } };
      }
    }
    if (method === "GET" && path === "/notes") return { status: 200, body: listNotes(store) };
    return { status: 404, body: { error: "not found" } };
  };
}
