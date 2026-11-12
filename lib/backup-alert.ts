import nodemailer from "nodemailer";

// Never re-throws: a dead SMTP must not mask the backup failure, which is
// already in the cron log and the exit code.
export async function sendBackupAlert(subject: string, detail: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const to = env.BACKUP_ALERT_EMAIL?.trim();
  const host = env.SMTP_HOST?.trim();
  if (!to || !host) {
    console.error(`[backup-alert] BACKUP_ALERT_EMAIL or SMTP_HOST not set; ${subject}: ${detail}`);
    return;
  }
  try {
    const port = Number(env.SMTP_PORT) || 587;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000
    });
    await transport.sendMail({
      from: env.SMTP_FROM?.trim() || env.SMTP_USER || to,
      to,
      subject: `DIYSEO backup: ${subject}`,
      text: `${subject}\n\n${detail}\n\n${new Date().toISOString()}`
    });
  } catch (error) {
    console.error("[backup-alert] failed to send alert:", error);
  }
}
