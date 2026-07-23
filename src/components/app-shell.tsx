import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { HeaderProfile } from "@/components/header-profile";

type AppShellProps = {
  children: React.ReactNode;
  role?: "patient" | "doctor" | "receptionist" | "admin";
};

export async function AppShell({ children, role }: AppShellProps) {
  const cookieStore = await cookies();
  const sessionRole = cookieStore.get("se_role")?.value;
  const sessionName = cookieStore.get("se_name")?.value;
  const sessionAvatarCookie = cookieStore.get("se_avatar")?.value;
  const sessionEmail = cookieStore.get("se_email")?.value?.trim().toLowerCase() || "";
  const resolvedRole = role ?? sessionRole;
  const staffRole =
    resolvedRole === "doctor" || resolvedRole === "receptionist" || resolvedRole === "admin"
      ? resolvedRole
      : null;
  const sessionAvatar =
    staffRole && sessionEmail
      ? `/api/uploads/staff-photo?role=${encodeURIComponent(staffRole)}&email=${encodeURIComponent(sessionEmail)}&v=${Date.now()}`
      : sessionAvatarCookie;

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
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
          <Link href="/" aria-label="SpinExperts home" className="focus-ring flex shrink-0 items-center gap-3">
            <span className="relative h-9 w-9 overflow-hidden rounded-2xl bg-[rgba(255,255,255,0.8)] shadow-[0_10px_26px_rgba(15,118,110,0.2)] sm:h-10 sm:w-10">
              <Image
                src="/logo.jpg"
                alt="SpinExperts icon"
                fill
                sizes="40px"
                className="object-cover object-[50%_22%] scale-[1.24] mix-blend-multiply"
              />
            </span>
            <div className="hidden sm:block">
              <div className="headline text-lg font-semibold leading-none">SpinExperts India</div>
              <div className="text-xs text-[color:var(--muted)]">Advanced spine care platform</div>
            </div>
          </Link>

          {roleLabel ? (
            <HeaderProfile
              role={resolvedRole ?? ""}
              roleLabel={roleLabel}
              displayName={displayName}
              avatarLabel={avatarLabel}
              sessionAvatar={sessionAvatar}
            />
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-10">
        {children}
      </main>

      <footer className="border-t border-[rgba(21,32,43,0.08)] bg-[rgba(255,255,255,0.5)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-[color:var(--muted)] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>Expert care. Every spine. Every time.</p>
          <p>Privacy-first patient intake with doctor follow-up and admin telemetry.</p>
        </div>
      </footer>
    </div>
  );
}