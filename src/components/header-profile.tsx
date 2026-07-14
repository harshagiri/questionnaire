"use client";

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
  phone?: string;
};

export function HeaderProfile({ role, roleLabel, displayName, avatarLabel, sessionAvatar }: HeaderProfileProps) {
  const pathname = usePathname();
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const patientProfileRaw = useSyncExternalStore(
    () => () => undefined,
    () => {
      if (role !== "patient") {
        return null;
      }

      const sessionId = pathname.split("/").filter(Boolean).at(-1);
      return sessionId ? window.localStorage.getItem(`sei-patient-profile:${sessionId}`) : null;
    },
    () => null,
  );
  const patientProfile = useMemo(() => {
    if (!patientProfileRaw) {
      return null;
    }

    try {
      return JSON.parse(patientProfileRaw) as PatientProfile;
    } catch {
      return null;
    }
  }, [patientProfileRaw]);

  const primaryLabel = patientProfile?.patientName?.trim() || displayName;
  const secondaryLabel = role === "patient" ? patientProfile?.phone?.trim() || displayName : roleLabel;
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
      <div className="flex min-w-0 items-center gap-2 rounded-[1.2rem] border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.08)] px-2 py-1.5 sm:px-2.5">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/70 bg-[linear-gradient(135deg,rgba(15,118,110,0.24),rgba(21,32,43,0.12))] shadow-sm sm:h-9 sm:w-9">
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
