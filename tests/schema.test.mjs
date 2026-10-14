import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, assertValid } from "../scripts/lib/schema.mjs";

const schema = {
  type: "object",
  required: ["name", "tags"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 2, pattern: "^[a-z]+$" },
    tags: { type: "array", items: { enum: ["a", "b"] }, minItems: 1 },
    count: { type: "integer", minimum: 0, maximum: 3 },
    ref: { $ref: "#/$defs/thing" },
    maybe: { anyOf: [{ type: "null" }, { type: "string" }] },
  },
  $defs: { thing: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
};

test("accepts a valid object", () => {
  assert.deepEqual(validate(schema, { name: "ok", tags: ["a"], count: 2, ref: { id: "x" }, maybe: null }), []);
});

test("reports every violation with a path", () => {
  const errors = validate(schema, { name: "X1", tags: ["c"], count: 9, extra: 1, ref: {}, maybe: 4 });
  assert.ok(errors.some((e) => e.startsWith("$.name")));
  assert.ok(errors.some((e) => e.startsWith("$.tags[0]")));
  assert.ok(errors.some((e) => e.includes("above maximum")));
  assert.ok(errors.some((e) => e.includes("unexpected property extra")));
  assert.ok(errors.some((e) => e.includes("$.ref: missing required id")));
  assert.ok(errors.some((e) => e.includes("$.maybe: matches none")));
});

test("integer vs number distinction", () => {
  assert.deepEqual(validate({ type: "integer" }, 1.5), ["$: expected integer, got number"]);
  assert.deepEqual(validate({ type: "number" }, 1), []);
});

test("assertValid throws with all errors attached", () => {
  assert.throws(() => assertValid(schema, {}, "thing"), (err) => err.errors.length === 2);
});
