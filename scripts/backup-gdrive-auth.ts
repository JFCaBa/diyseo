// One-time: mint the Drive refresh token for off-site backups.
// Needs BACKUP_GOOGLE_CLIENT_ID / BACKUP_GOOGLE_CLIENT_SECRET (a Desktop-type
// OAuth client) in the environment. Run: npm run backup:gdrive-auth
import readline from "node:readline";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file absent: fine
  }
}

const clientId = process.env.BACKUP_GOOGLE_CLIENT_ID;
const clientSecret = process.env.BACKUP_GOOGLE_CLIENT_SECRET;
const redirectUri = "http://localhost";

if (!clientId || !clientSecret) {
  console.error("Set BACKUP_GOOGLE_CLIENT_ID and BACKUP_GOOGLE_CLIENT_SECRET first.");
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  access_type: "offline",
  prompt: "consent",
  scope: "https://www.googleapis.com/auth/drive.file"
})}`;

console.log("\n1. Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n2. Authorize, then paste the FULL redirect URL (the page will fail to load).\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Paste the redirect URL here: ", async (input) => {
  try {
    const code = new URL(input.trim()).searchParams.get("code");
    if (!code) throw new Error("No ?code= in the pasted URL.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" })
    });
    const data = (await response.json()) as { refresh_token?: string; access_token?: string; error?: string };
    if (!data.refresh_token) throw new Error(data.error ?? "No refresh_token returned (revoke the app's access and retry).");
    // drive.file only reaches files this app created, so a folder made by hand in
    // the Drive UI is not usable: create the backup folder with this very token.
    const folder = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "diyseo-backup", mimeType: "application/vnd.google-apps.folder" })
    });
    const folderData = (await folder.json()) as { id?: string };
    if (!folderData.id) throw new Error(`Could not create the Drive folder (${folder.status}).`);
    console.log("\nAdd these to the server .env:\n");
    console.log(`BACKUP_GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`BACKUP_GOOGLE_DRIVE_FOLDER_ID=${folderData.id}\n`);
  } catch (error) {
    console.error("Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
});
