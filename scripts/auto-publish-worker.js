const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_PORT = "3000";
const CRON_ROUTE = "/api/internal/cron/auto-publish";

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function resolveBaseUrl() {
  const explicitBaseUrl = process.env.AUTO_PUBLISH_BASE_URL?.trim();

  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }

  const port = process.env.PORT?.trim() || DEFAULT_PORT;
  return `http://127.0.0.1:${port}`;
}

const baseUrl = resolveBaseUrl();
const cronSecret = process.env.CRON_SECRET?.trim();
const intervalMinutes = parsePositiveInteger(process.env.AUTO_PUBLISH_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES);
const intervalMs = intervalMinutes * 60 * 1000;

if (!cronSecret) {
  console.error("[auto-publish-worker] CRON_SECRET is not configured. Worker cannot start.");
  process.exit(1);
}

const endpoint = `${baseUrl}${CRON_ROUTE}`;
let running = false;

async function tick() {
  if (running) {
    console.warn("[auto-publish-worker] Previous run still in progress. Skipping this interval.");
    return;
  }

  running = true;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`
      }
    });

    const body = await response.text();

    if (!response.ok) {
      console.error(
        `[auto-publish-worker] Request failed with ${response.status} ${response.statusText}: ${body.slice(0, 500)}`
      );
      return;
    }

    console.log(`[auto-publish-worker] Run succeeded: ${body.slice(0, 500)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[auto-publish-worker] Request error: ${message}`);
  } finally {
    running = false;
  }
}

console.log(`[auto-publish-worker] Starting. Endpoint=${endpoint} Interval=${intervalMinutes}m`);

tick();
setInterval(tick, intervalMs);
