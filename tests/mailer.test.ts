import assert from "node:assert/strict";
import { test } from "node:test";

import { inviteEmailContent, sendInviteEmailWith } from "../lib/invite-email";

test("invite email names the workspace and carries the link", () => {
  const { subject, text } = inviteEmailContent("https://diyseo.online/invite/abc", "Acme Team");
  assert.ok(subject.includes("Acme Team"));
  assert.ok(text.includes("https://diyseo.online/invite/abc"));
});

test("without SMTP_HOST the invite email is not sent", async () => {
  let called = false;
  const result = await sendInviteEmailWith({}, "a@example.com", "https://diyseo.online/invite/abc", "Acme Team", async () => {
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
    "Acme Team",
    async (_config, message) => {
      sent = message;
    }
  );
  assert.equal(result, "sent");
  assert.equal(sent!.from, "DIYSEO <info@diyseo.online>");
  assert.equal(sent!.to, "a@example.com");
});

test("the workspace name in the email is one trimmed line of at most 60 characters", async () => {
  const { safeWorkspaceName } = await import("../lib/invite-email");
  assert.equal(safeWorkspaceName("  Acme Team  "), "Acme Team");
  assert.equal(safeWorkspaceName("Acme\r\nBcc: evil@x.io\u0000 Team"), "Acme Bcc: evil@x.io Team");
  assert.equal(safeWorkspaceName("x".repeat(80)), "x".repeat(60));
  assert.equal(safeWorkspaceName("\n\t "), "a team");

  const { subject, text } = inviteEmailContent("https://diyseo.online/invite/abc", `Acme\nTeam ${"y".repeat(80)}`);
  assert.ok(!subject.includes("\n"));
  assert.ok(subject.includes(`Acme Team ${"y".repeat(50)} on DIYSEO`));
  assert.ok(!subject.includes("y".repeat(51)));
  assert.ok(text.split("\n")[0].includes("Acme Team"));
});
