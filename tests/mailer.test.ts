import assert from "node:assert/strict";
import { test } from "node:test";

import { inviteEmailContent, sendInviteEmailWith } from "../lib/invite-email";

test("invite email names the workspace and carries the link", () => {
  const { subject, text } = inviteEmailContent("https://diyseo.online/invite/abc", "Castelo David");
  assert.ok(subject.includes("Castelo David"));
  assert.ok(text.includes("https://diyseo.online/invite/abc"));
});

test("without SMTP_HOST the invite email is not sent", async () => {
  let called = false;
  const result = await sendInviteEmailWith({}, "a@example.com", "https://diyseo.online/invite/abc", "Castelo David", async () => {
    called = true;
  });
  assert.equal(result, "not_configured");
  assert.equal(called, false);
});

test("with SMTP_HOST the message goes to the transport with the default sender", async () => {
  let sent: Record<string, unknown> | null = null;
  const result = await sendInviteEmailWith(
    { SMTP_HOST: "smtp.example.com" },
    "a@example.com",
    "https://diyseo.online/invite/abc",
    "Castelo David",
    async (_config, message) => {
      sent = message;
    }
  );
  assert.equal(result, "sent");
  assert.equal(sent!.from, "DIYSEO <info@diyseo.online>");
  assert.equal(sent!.to, "a@example.com");
});
