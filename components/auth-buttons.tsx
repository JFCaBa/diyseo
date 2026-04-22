import { signIn, signOut } from "@/lib/auth";

type SignInButtonProps = {
  label?: string;
  className?: string;
};

export async function SignInButton({
  label = "Sign in with Google",
  className = "inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
}: SignInButtonProps) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <button type="submit" className={className}>
        {label}
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
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className={className}>
        Log out
      </button>
    </form>
  );
}
