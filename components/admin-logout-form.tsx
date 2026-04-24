import { signOutFromAdmin } from "@/app/admin/actions";

export function AdminLogoutForm() {
  return (
    <form action={signOutFromAdmin}>
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
      >
        Logout
      </button>
    </form>
  );
}
