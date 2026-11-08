import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, signIn, signOut } from "@/lib/auth";
import { acceptTeamInvite } from "@/lib/team-actions";
import { inviteForToken } from "@/lib/teams";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team invite",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

const EXPIRED = "This invite has expired. Ask the owner for a new one.";
const HAS_DATA = "Your account already has a workspace with data. Write to info@diyseo.online and we'll move it for you.";

const ERRORS: Record<string, string> = {
  has_content: HAS_DATA,
  has_subscription: HAS_DATA,
  has_team: HAS_DATA,
  limit_reached: "This team is full on its current plan. Ask the owner to upgrade.",
  expired: EXPIRED,
  invalid: EXPIRED,
  retry: "Something went wrong, please try again."
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
        <h1 className="mt-2 text-2xl font-semibold text-ink">Team invite</h1>
        <Notice text={EXPIRED} />
      </Shell>
    );
  }

  const heading = (
    <>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Join {invite.workspaceName}</h1>
      <p className="mt-2 text-sm text-slate-600">
        You've been invited to work on this team's sites in DIYSEO.
      </p>
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
            Continue with Google
          </button>
        </form>
      </Shell>
    );
  }

  const emailMismatch = (user.email ?? "").trim().toLowerCase() !== invite.email;
  const errorText = emailMismatch
    ? `This invite is for ${invite.email}. Sign in with that Google account.`
    : query?.error
      ? ERRORS[query.error]
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
            Sign out and switch account
          </button>
        </form>
      ) : (
        <>
          {user.workspaceRole === "OWNER" ? (
            <p className="mt-6 text-sm text-slate-700">
              Joining replaces your current workspace. Its site settings and API keys will be deleted.
            </p>
          ) : null}
          <form className="mt-6" action={acceptTeamInvite.bind(null, token)}>
            <button type="submit" className={primaryButton}>
              Join {invite.workspaceName}
            </button>
          </form>
        </>
      )}
    </Shell>
  );
}
