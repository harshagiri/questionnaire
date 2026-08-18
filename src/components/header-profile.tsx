"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

type HeaderProfileProps = {
  role: string;
  roleLabel: string;
  displayName: string;
  avatarLabel: string;
  sessionAvatar?: string;
};

type PatientProfile = {
  patientName?: string;
  fullName?: string;
  phone?: string;
};

export function HeaderProfile({ role, roleLabel, displayName, avatarLabel, sessionAvatar }: HeaderProfileProps) {
  const pathname = usePathname();
  const canUseDom = typeof window !== "undefined";
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const patientProfileRaw = useSyncExternalStore(
    () => () => undefined,
    () => {
      if (role !== "patient" || !canUseDom) {
        return null;
      }

      const sessionId = pathname.split("/").filter(Boolean).at(-1);
      const scopedProfile = sessionId ? window.localStorage.getItem(`sei-patient-profile:${sessionId}`) : null;
      if (scopedProfile) {
        return scopedProfile;
      }

      return window.localStorage.getItem("sei-patient-profile-latest");
    },
    () => null,
  );
  const patientProfile = useMemo(() => {
    if (!patientProfileRaw) return null;

    try {
      return JSON.parse(patientProfileRaw) as PatientProfile;
    } catch {
      return null;
    }
  }, [patientProfileRaw]);

  const primaryLabel =
    patientProfile?.patientName?.trim() ||
    patientProfile?.fullName?.trim() ||
    displayName;
  const patientPhone = patientProfile?.phone?.trim() || "";
  const secondaryLabel = role === "patient" ? patientPhone || roleLabel : roleLabel;
  const resolvedAvatarLabel = useMemo(
    () =>
      primaryLabel
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || avatarLabel,
    [avatarLabel, primaryLabel],
  );

  return (
    <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
      {role === "patient" ? (
        <div className="relative">
          <button
            type="button"
            aria-label="Open patient menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
            className="focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(21,32,43,0.16)] bg-white text-[color:var(--foreground)] transition hover:bg-[rgba(21,32,43,0.04)]"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-11 z-40 min-w-52 overflow-hidden rounded-xl border border-[rgba(21,32,43,0.12)] bg-white p-1.5 shadow-[0_14px_34px_rgba(16,53,103,0.16)]">
              <Link
                href="/patient"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[rgba(59,130,246,0.08)]"
              >
                My dashboard
              </Link>
              <Link
                href="/patient/book"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[rgba(59,130,246,0.08)]"
              >
                Book new appointment
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-w-0 items-center gap-2 rounded-[1.2rem] border border-[rgba(22,95,192,0.2)] bg-[rgba(22,95,192,0.08)] px-2 py-1.5 sm:px-2.5">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/70 bg-[linear-gradient(135deg,rgba(22,95,192,0.24),rgba(16,53,103,0.14))] shadow-sm sm:h-9 sm:w-9">
          {sessionAvatar && !avatarLoadError ? (
            <img
              src={sessionAvatar}
              alt={primaryLabel}
              className="h-full w-full object-cover"
              onError={() => setAvatarLoadError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--foreground)]">
              {resolvedAvatarLabel}
            </div>
          )}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="max-w-[7.5rem] truncate text-sm font-semibold text-[color:var(--foreground)] sm:max-w-[12rem]">
            {primaryLabel}
          </div>
          <div className="max-w-[7.5rem] truncate text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--accent)] sm:max-w-[12rem]">
            {secondaryLabel}
          </div>
        </div>
      </div>

      <form action="/api/session/logout" method="post">
        <button
          type="submit"
          aria-label="Logout"
          className="focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(21,32,43,0.16)] bg-white text-[color:var(--foreground)] transition hover:bg-[rgba(21,32,43,0.04)]"
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
  );
}
