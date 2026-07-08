import Link from "next/link";
import { cookies } from "next/headers";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/access", label: "Access" },
  { href: "/patient/demo-session", label: "Patient" },
  { href: "/receptionist", label: "Reception" },
  { href: "/doctor", label: "Doctor" },
  { href: "/admin", label: "Admin" },
];

type AppShellProps = {
  children: React.ReactNode;
  showNavigation?: boolean;
};

export async function AppShell({ children, showNavigation = true }: AppShellProps) {
  const cookieStore = await cookies();
  const sessionRole = cookieStore.get("se_role")?.value;
  const sessionName = cookieStore.get("se_name")?.value;

  const roleLabel =
    sessionRole === "patient"
      ? "Patient"
      : sessionRole === "doctor"
        ? "Doctor"
        : sessionRole === "receptionist"
          ? "Reception"
          : sessionRole === "admin"
            ? "Admin"
            : null;

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-[rgba(21,32,43,0.08)] bg-[rgba(251,250,247,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="focus-ring flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-bold text-white shadow-lg shadow-[rgba(15,118,110,0.25)]">
              SE
            </span>
            <div>
              <div className="headline text-lg font-semibold leading-none">SpinExpert</div>
              <div className="text-xs text-[color:var(--muted)]">Health screening workflow</div>
            </div>
          </Link>

          {showNavigation ? (
            <nav className="hidden items-center gap-2 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="focus-ring rounded-full px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:bg-white hover:text-[color:var(--foreground)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="flex items-center gap-2">
            {roleLabel && sessionName ? (
              <div className="rounded-full border border-[rgba(15,118,110,0.22)] bg-[rgba(15,118,110,0.08)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)]">
                {roleLabel} · {sessionName}
              </div>
            ) : showNavigation ? (
              <div className="rounded-full border border-[rgba(15,118,110,0.16)] bg-[rgba(15,118,110,0.08)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
                RBAC configurable in backend
              </div>
            ) : null}

            {roleLabel ? (
              <form action="/api/session/logout" method="post">
                <button
                  type="submit"
                  className="focus-ring rounded-full border border-[rgba(21,32,43,0.15)] bg-white px-3 py-1 text-[11px] font-semibold text-[color:var(--foreground)] transition hover:bg-[rgba(21,32,43,0.04)]"
                >
                  Logout
                </button>
              </form>
            ) : null}
          </div>
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