// Invite email content and sending logic, free of server-only imports so tests
// can load it. lib/mailer.ts supplies the real SMTP transport.

type Env = Record<string, string | undefined>;

export const DEFAULT_MAIL_FROM = "DIYSEO <info@diyseo.online>";

export type SmtpConfig = { host: string; port: number; user?: string; pass?: string };
export type MailMessage = { from: string; to: string; subject: string; text: string };
export type SendMail = (config: SmtpConfig, message: MailMessage) => Promise<unknown>;

export function inviteEmailContent(inviteUrl: string, workspaceName: string): { subject: string; text: string } {
  return {
    subject: `You're invited to join ${workspaceName} on DIYSEO`,
    text: [
      `You've been invited to join the ${workspaceName} workspace on DIYSEO.`,
      "",
      `Accept the invite here (the link expires in 7 days):`,
      inviteUrl,
      "",
      "Sign in with the Google account for this email address.",
      "If you weren't expecting this, you can ignore this email."
    ].join("\n")
  };
}

export async function sendInviteEmailWith(
  env: Env,
  to: string,
  inviteUrl: string,
  workspaceName: string,
  send: SendMail
): Promise<"sent" | "not_configured"> {
  const host = env.SMTP_HOST?.trim();
  if (!host) return "not_configured";

  const port = Number(env.SMTP_PORT) || 587;
  const config: SmtpConfig = { host, port, user: env.SMTP_USER || undefined, pass: env.SMTP_PASS || undefined };
  const from = env.MAIL_FROM?.trim() || DEFAULT_MAIL_FROM;

  await send(config, { from, to, ...inviteEmailContent(inviteUrl, workspaceName) });
  return "sent";
}
