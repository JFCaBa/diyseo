"use client";

import { useState, useTransition } from "react";

import { connectMetaAction, disconnectMetaAction, testMetaConnectionAction, type SocialActionResult } from "@/lib/social-actions";

type Props = {
  siteId: string;
  isOwner: boolean;
  connection: { pageId: string; pageName: string; instagramUsername: string | null; tokenLast4: string } | null;
};

const btn = "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export function SiteSocialConnectionForm({ siteId, isOwner, connection }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const run = (action: (fd: FormData) => Promise<SocialActionResult>, fd: FormData, done: string, onOk?: () => void) =>
    startTransition(async () => {
      setConfirmDisconnect(false);
      fd.set("siteId", siteId);
      const result = await action(fd);
      setMessage(result.ok ? { ok: true, text: done } : { ok: false, text: result.error });
      if (result.ok) onOk?.();
    });

  return (
    <section id="social" className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Social accounts</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Facebook Page and Instagram</h2>
        <p className="mt-2 text-sm text-slate-600">
          Articles can be posted to this Facebook Page and its linked Instagram professional account. X and LinkedIn need no connection.
        </p>
      </div>

      {connection ? (
        <div className="mt-5 space-y-1 text-sm text-ink">
          <p>
            Page: <strong>{connection.pageName}</strong> <span className="text-slate-500">({connection.pageId})</span>
          </p>
          <p>Instagram: {connection.instagramUsername ? <strong>@{connection.instagramUsername}</strong> : <span className="text-slate-500">none linked to the Page</span>}</p>
          <p className="text-slate-500">Token ending in …{connection.tokenLast4}</p>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-600">No Page connected.</p>
      )}

      {isOwner ? (
        <>
          {connection ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" className={`${btn} border border-line bg-white text-ink hover:bg-mist`} disabled={pending} onClick={() => run(testMetaConnectionAction, new FormData(), "Connection works")}>
                Test connection
              </button>
              {confirmDisconnect ? (
                <>
                  <span className="text-sm text-ink">Disconnect the Page? Drafts stay; publishing stops until you connect again.</span>
                  <button type="button" className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`} disabled={pending} onClick={() => run(disconnectMetaAction, new FormData(), "Disconnected")}>
                    Yes, disconnect
                  </button>
                </>
              ) : (
                <button type="button" className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`} onClick={() => setConfirmDisconnect(true)}>
                  Disconnect
                </button>
              )}
            </div>
          ) : null}

          <form
            className="mt-6 grid max-w-2xl gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              // The fields are cleared only once Meta accepted them, so a typo does not mean pasting the token again.
              run(connectMetaAction, new FormData(formEl), "Page connected", () => formEl.reset());
            }}
          >
            <label className="text-sm font-medium text-ink">
              Facebook Page ID
              <input name="pageId" required inputMode="numeric" defaultValue={connection?.pageId ?? ""} className="mt-1 w-full rounded-2xl border border-line px-4 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-ink">
              Access token
              <input name="accessToken" type="password" required autoComplete="off" className="mt-1 w-full rounded-2xl border border-line px-4 py-2 text-sm" />
            </label>
            <p className="text-xs text-slate-500">
              Use a Meta Business Manager system-user token with this Page and its Instagram account assigned (it does not expire), with the
              permissions pages_manage_posts, pages_read_engagement, instagram_basic and instagram_content_publish. DIYSEO keeps only the Page
              token derived from it, encrypted.
            </p>
            <div>
              <button type="submit" className={`${btn} bg-ink text-white hover:bg-slate-800`} disabled={pending}>
                {pending ? "Checking with Meta…" : connection ? "Replace connection" : "Connect Page"}
              </button>
            </div>
          </form>
        </>
      ) : (
        <p className="mt-4 text-xs text-slate-500">Only the workspace owner can change the connection.</p>
      )}

      {message ? <p className={`mt-3 text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p> : null}
    </section>
  );
}
