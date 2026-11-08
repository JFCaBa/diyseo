import "server-only";

import nodemailer from "nodemailer";

import { sendInviteEmailWith, type SendMail } from "@/lib/invite-email";

const smtpSend: SendMail = (config, message) => {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user ? { user: config.user, pass: config.pass ?? "" } : undefined,
    // Keep a slow or unreachable SMTP server from holding up the invite form.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });
  return transport.sendMail(message);
};

/** Sends the invite email over SMTP. Returns "not_configured" when SMTP_HOST is unset; throws if sending fails. */
export function sendInviteEmail(to: string, inviteUrl: string, workspaceName: string): Promise<"sent" | "not_configured"> {
  return sendInviteEmailWith(process.env, to, inviteUrl, workspaceName, smtpSend);
}
