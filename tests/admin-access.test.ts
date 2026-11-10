import assert from "node:assert/strict";
import { test } from "node:test";

import { isAdminEmail } from "../lib/admin-access";

test("a listed email is an admin", () => {
  assert.equal(isAdminEmail("jfca68@gmail.com", { ADMIN_EMAILS: "jfca68@gmail.com" }), true);
});

test("matching ignores case and spaces", () => {
  assert.equal(isAdminEmail("JFCA68@Gmail.com", { ADMIN_EMAILS: " jfca68@gmail.com , other@x.com " }), true);
});

test("nobody is an admin without a usable list or email", () => {
  assert.equal(isAdminEmail("jfca68@gmail.com", {}), false);
  assert.equal(isAdminEmail("jfca68@gmail.com", { ADMIN_EMAILS: "" }), false);
  assert.equal(isAdminEmail("jfca68@gmail.com", { ADMIN_EMAILS: " , " }), false);
  assert.equal(isAdminEmail(null, { ADMIN_EMAILS: "jfca68@gmail.com" }), false);
  assert.equal(isAdminEmail(undefined, { ADMIN_EMAILS: "jfca68@gmail.com" }), false);
  assert.equal(isAdminEmail("", { ADMIN_EMAILS: "jfca68@gmail.com" }), false);
  assert.equal(isAdminEmail("eve@x.com", { ADMIN_EMAILS: "jfca68@gmail.com" }), false);
});
