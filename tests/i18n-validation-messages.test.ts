import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { z } from "zod";

import { en } from "@/lib/i18n/messages/en";
import { INVITE_RATE_LIMITED } from "@/lib/invite-limits";
import { PLANS } from "@/lib/plans";
import { ROLE_ERRORS } from "@/lib/team-roles";
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

/** Every action file that returns user-visible results; a new static success literal in any of them must be in en.notices. */
const ACTION_FILES = ["lib/actions.ts", "lib/social-actions.ts", "lib/billing-actions.ts", "lib/team-actions.ts", "lib/signup-actions.ts"];

test("every static success message in the action files is in the notices catalog", () => {
  const source = ACTION_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
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

test("the static team messages returned by lib/team-actions.ts are in the errors catalog", () => {
  const catalog = new Set<string>(Object.values(en.errors));
  const source = readFileSync("lib/team-actions.ts", "utf8");
  const constants = [...source.matchAll(/^const (?:RETRY_MESSAGE|OWNER_ONLY) = "([^"]+)";/gm)].map((match) => match[1]);
  assert.equal(constants.length, 2);
  const inline = [...source.matchAll(/error: "([^"]+)"/g)].map((match) => match[1]);
  const messages = [...constants, ...inline, ...Object.values(ROLE_ERRORS), INVITE_RATE_LIMITED];
  assert.ok(messages.length >= 8);
  const missing = messages.filter((message) => !catalog.has(message));
  assert.deepEqual(missing, [], `missing from en.errors:\n${missing.join("\n")}`);
});

test("the billing dictionary repeats the plan taglines and features of lib/plans.ts", () => {
  for (const plan of PLANS) {
    const entry = en.billing.plans[plan.id] as Record<string, string>;
    assert.equal(entry.tagline, plan.tagline);
    plan.features.forEach((feature, index) => assert.equal(entry[`f${index + 1}`], feature));
    assert.equal(Object.keys(entry).length, plan.features.length + 1);
  }
});
