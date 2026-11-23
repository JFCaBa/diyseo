import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, signIn, signOut } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { acceptTeamInvite } from "@/lib/team-actions";
import { inviteForToken } from "@/lib/teams";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("invite.title"),
    robots: { index: false, follow: false },
    referrer: "no-referrer"
  };
}

const ERROR_KEYS: Record<string, MessageKey> = {
  has_content: "invite.hasData",
  has_subscription: "invite.hasData",
  has_team: "invite.hasTeam",
  limit_reached: "invite.limitReached",
  expired: "invite.expired",
  invalid: "invite.expired",
  retry: "invite.retry"
};

type InvitePageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
};

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-2xl bg-ink px-5 text-sm font-semibold text-white transition hover:bg-slate-800";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:bg-mist";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">DIYSEO</p>
      {children}
    </main>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {text}
    </p>
  );
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const t = await getT();
  const { token } = await params;
  const query = searchParams ? await searchParams : undefined;
  const invitePath = `/invite/${encodeURIComponent(token)}`;
  const invite = await inviteForToken(token, new Date());
  const session = await auth();
  const user = session?.user;

  // Already on this team (for example, reopening an accepted link): go straight in.
  if (invite && user?.workspaceId === invite.workspaceId) {
    redirect("/");
  }

  if (!invite || !invite.usable) {
    return (
      <Shell>
        <h1 className="mt-2 text-2xl font-semibold text-ink">{t("invite.title")}</h1>
        <Notice text={t("invite.expired")} />
      </Shell>
    );
  }

  const heading = (
    <>
      <h1 className="mt-2 text-2xl font-semibold text-ink">{t("invite.join", { workspaceName: invite.workspaceName })}</h1>
      <p className="mt-2 text-sm text-slate-600">{t("invite.invited")}</p>
    </>
  );

  if (!user?.id) {
    return (
      <Shell>
        {heading}
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: invitePath });
          }}
        >
          <button type="submit" className={primaryButton}>
            {t("onboarding.continueWithGoogle")}
          </button>
        </form>
      </Shell>
    );
  }

  const emailMismatch = (user.email ?? "").trim().toLowerCase() !== invite.email;
  const errorText = emailMismatch
    ? t("invite.emailMismatch", { email: invite.email })
    : query?.error && ERROR_KEYS[query.error]
      ? t(ERROR_KEYS[query.error])
      : undefined;

  return (
    <Shell>
      {heading}
      {errorText ? <Notice text={errorText} /> : null}

      {emailMismatch ? (
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signOut({ redirectTo: invitePath });
          }}
        >
          <button type="submit" className={secondaryButton}>
            {t("invite.switchAccount")}
          </button>
        </form>
      ) : (
        <>
          {user.workspaceRole === "OWNER" ? (
            <p className="mt-6 text-sm text-slate-700">
              {t("invite.replacesWorkspace")}
            </p>
          ) : null}
          <form className="mt-6" action={acceptTeamInvite.bind(null, token)}>
            <button type="submit" className={primaryButton}>
              {t("invite.join", { workspaceName: invite.workspaceName })}
            </button>
          </form>
        </>
      )}
    </Shell>
  );
}
