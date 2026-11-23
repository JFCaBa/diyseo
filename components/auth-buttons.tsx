import { getT } from "@/lib/i18n/server";
import { signIn, signOut } from "@/lib/auth";

type SignInButtonProps = {
  label?: string;
  className?: string;
};

export async function SignInButton({
  label,
  className = "inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
}: SignInButtonProps) {
  const t = await getT();
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/auth/continue" });
      }}
    >
      <button type="submit" className={className}>
        {label ?? t("shell.signInWithGoogle")}
      </button>
    </form>
  );
}

type SignOutButtonProps = {
  className?: string;
};

export async function SignOutButton({
  className = "inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
}: SignOutButtonProps) {
  const t = await getT();
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className={className}>
        {t("shell.logOut")}
      </button>
    </form>
  );
}
