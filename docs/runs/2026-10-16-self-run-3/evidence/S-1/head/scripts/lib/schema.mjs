// Minimal JSON Schema subset validator. Zero dependencies on purpose: hooks must start fast.
// Supports: type (string | array), enum, const, required, properties, additionalProperties (boolean),
// items, minItems, maxItems, minimum, maximum, minLength, maxLength, pattern, anyOf, $ref to #/$defs/<name>.

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

function matchesType(v, t) {
  const actual = typeOf(v);
  if (t === "number") return actual === "number" || actual === "integer";
  if (t === "integer") return actual === "integer";
  return actual === t;
}

export function validate(schema, value, root = schema, path = "$", errors = []) {
  if (schema.$ref) {
    const name = schema.$ref.replace("#/$defs/", "");
    const target = root.$defs?.[name];
    if (!target) { errors.push(`${path}: unknown $ref ${schema.$ref}`); return errors; }
    return validate(target, value, root, path, errors);
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${path}: expected ${types.join("|")}, got ${typeOf(value)}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in ${JSON.stringify(schema.enum)}`);
  if ("const" in schema && value !== schema.const) errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => validate(s, value, root, path, []).length === 0);
    if (!ok) errors.push(`${path}: matches none of anyOf`);
  }
  if (typeOf(value) === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
  }
  if (typeOf(value) === "number" || typeOf(value) === "integer") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above maximum ${schema.maximum}`);
  }
  if (typeOf(value) === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, i) => validate(schema.items, item, root, `${path}[${i}]`, errors));
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}: missing required ${key}`);
    }
    const props = schema.properties ?? {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) validate(sub, value[key], root, `${path}.${key}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${path}: unexpected property ${key}`);
      }
    }
  }
  return errors;
}

export function assertValid(schema, value, label = "value") {
  const errors = validate(schema, value);
  if (errors.length) {
    const err = new Error(`${label} failed schema validation:\n  ${errors.join("\n  ")}`);
    err.errors = errors;
    throw err;
  }
  return value;
}
