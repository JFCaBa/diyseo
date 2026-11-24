import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { z } from "zod";

import { en } from "@/lib/i18n/messages/en";
import * as validations from "@/lib/validations";

/** Peels refine/transform wrappers (ZodEffects) down to the object schema, if there is one. */
function objectShape(schema: z.ZodTypeAny): Record<string, unknown> | null {
  let current: z.ZodTypeAny = schema;
  while (current instanceof z.ZodEffects) {
    current = current._def.schema;
  }
  return current instanceof z.ZodObject ? (current.shape as Record<string, unknown>) : null;
}

/**
 * Zod's invalid_enum_value message quotes the received input ("..., received 'xyz'"), so it
 * can't be a catalog entry; those fields are selects/hidden inputs and the message stays verbatim.
 */
const INPUT_ECHOING_CODES = new Set<string>([z.ZodIssueCode.invalid_enum_value]);

function emittedMessages() {
  const messages = new Set<string>();
  const schemas = Object.entries(validations as Record<string, unknown>).filter(
    (entry): entry is [string, z.ZodTypeAny] => entry[1] instanceof z.ZodType
  );
  assert.ok(schemas.length > 30, "expected the exported schemas of lib/validations.ts");

  for (const [, schema] of schemas) {
    const shape = objectShape(schema);
    // Every Zod export of lib/validations.ts today is an object schema (or a refined one);
    // a non-object schema would only get the {} / null inputs. parseWaitlistForm (a function)
    // is not a schema and is skipped by the filter above.
    const keys = shape ? Object.keys(shape) : [];
    const fill = (value: unknown) => Object.fromEntries(keys.map((key) => [key, value]));
    const inputs: unknown[] = [{}, null, fill(""), fill(123), fill("x".repeat(5000))];

    for (const input of inputs) {
      const result = schema.safeParse(input);
      if (result.success) continue;
      for (const issue of result.error.issues) {
        if (INPUT_ECHOING_CODES.has(issue.code)) continue;
        messages.add(issue.message);
      }
    }
  }
  return messages;
}

test("every message our Zod schemas emit is in the errors catalog", () => {
  const catalog = new Set<string>(Object.values(en.errors));
  const missing = [...emittedMessages()].filter((message) => !catalog.has(message));
  assert.deepEqual(missing, [], `missing from en.errors:\n${missing.join("\n")}`);
});

test("no two errors or notices share the same English text", () => {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const [key, value] of [...Object.entries(en.errors), ...Object.entries(en.notices)]) {
    const previous = seen.get(value);
    if (previous) duplicates.push(`${previous} and ${key}: ${value}`);
    seen.set(value, key);
  }
  assert.deepEqual(duplicates, []);
});

test("every static success message in lib/actions.ts is in the notices catalog", () => {
  const source = readFileSync("lib/actions.ts", "utf8");
  const literals = source
    .split("\n")
    .filter((line) => /\bsuccess:\s*[^`]*"/.test(line) && !line.includes("`"))
    .flatMap((line) => [...line.matchAll(/"([^"]+)"/g)].map((match) => match[1]))
    .filter((literal) => literal.endsWith(".")); // skips comparands such as "PUBLISHED"
  assert.ok(literals.length > 0);
  const catalog = new Set<string>(Object.values(en.notices));
  const missing = literals.filter((message) => !catalog.has(message));
  assert.deepEqual(missing, [], `missing from en.notices:\n${missing.join("\n")}`);
});
