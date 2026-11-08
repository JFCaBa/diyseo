import { createFixedWindowLimiter } from "@/lib/rate-limit";

const DAY_MS = 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

export const INVITE_RATE_LIMITED = "Too many invites right now. Please try again later.";

/**
 * Invite-send limits: at most 20 sends per workspace per 24 h and one send per
 * (workspace, email) per 10 minutes. Returns a check that records the send
 * when it is allowed. The per-email window is checked first so a repeat to the
 * same address does not use up the workspace allowance.
 */
export function createInviteRateLimit() {
  const perWorkspace = createFixedWindowLimiter({ limit: 20, windowMs: DAY_MS });
  const perEmail = createFixedWindowLimiter({ limit: 1, windowMs: TEN_MINUTES_MS });

  return (workspaceId: string, email: string, now = Date.now()): boolean => {
    const normalized = email.trim().toLowerCase();
    if (!perEmail(`invite:ws:${workspaceId}:${normalized}`, now)) return false;
    return perWorkspace(`invite:ws:${workspaceId}`, now);
  };
}

/** The per-process limiter used by the invite action. */
export const inviteAllowed = createInviteRateLimit();
