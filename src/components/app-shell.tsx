import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";

type AppShellProps = {
  children: React.ReactNode;
  role?: "patient" | "doctor" | "receptionist" | "admin";
};

export async function AppShell({ children, role }: AppShellProps) {
  const cookieStore = await cookies();
  const sessionRole = cookieStore.get("se_role")?.value;
  const sessionName = cookieStore.get("se_name")?.value;
  const sessionAvatar = cookieStore.get("se_avatar")?.value;
  const resolvedRole = role ?? sessionRole;

  const roleLabel =
    resolvedRole === "patient"
      ? "Patient"
      : resolvedRole === "doctor"
        ? "Doctor"
        : resolvedRole === "receptionist"
          ? "Reception"
          : resolvedRole === "admin"
            ? "Admin"
            : null;

  const avatarLabel = sessionName
    ? sessionName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : roleLabel?.slice(0, 2).toUpperCase() ?? "SE";

  const displayName = sessionName?.trim() || `${roleLabel ?? "User"}`;

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-[rgba(21,32,43,0.08)] bg-[rgba(251,250,247,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link href="/" className="focus-ring flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-bold text-white shadow-lg shadow-[rgba(15,118,110,0.25)]">
              SE
            </span>
            <div>
              <div className="headline text-lg font-semibold leading-none">SpinExpert</div>
              <div className="text-xs text-[color:var(--muted)]">Health screening workflow</div>
            </div>
          </Link>

          {roleLabel ? (
            <div className="ml-auto flex items-center gap-2 sm:justify-end">
              <div className="flex items-center gap-2 rounded-[1.2rem] border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.08)] px-2.5 py-1.5">
                <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/70 bg-[linear-gradient(135deg,rgba(15,118,110,0.24),rgba(21,32,43,0.12))] shadow-sm">
                  {sessionAvatar ? (
                    <Image
                      src={sessionAvatar}
                      alt={displayName}
                      fill
                      sizes="36px"
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--foreground)]">{avatarLabel}</div>
                  )}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="max-w-[9rem] truncate text-sm font-semibold text-[color:var(--foreground)] sm:max-w-[12rem]">{displayName}</div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--accent)]">{roleLabel}</div>
                </div>
              </div>

              <form action="/api/session/logout" method="post">
                <button
                  type="submit"
                  aria-label="Logout"
                  className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(21,32,43,0.16)] bg-white text-[color:var(--foreground)] transition hover:bg-[rgba(21,32,43,0.04)]"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                    <path
                      d="M15 3h-4a2 2 0 0 0-2 2v3h2V5h4v14h-4v-3H9v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-1.59 8.59L11 14l1.41 1.41L16.83 11l-4.42-4.41L11 8l2.41 2.41H4v2h9.41Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-10">
        {children}
      </main>

      <footer className="border-t border-[rgba(21,32,43,0.08)] bg-[rgba(255,255,255,0.5)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-[color:var(--muted)] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>Privacy-first patient intake with doctor follow-up and admin telemetry.</p>
        </div>
      </footer>
    </div>
  );
}