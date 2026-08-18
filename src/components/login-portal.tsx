"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { AppRole } from "@/lib/rbac";
import { isPatientProfileComplete } from "@/lib/patient-profile-completion";

type StaffRole = Exclude<AppRole, "patient">;

type AppointmentLite = {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
};

function toAppointmentMillis(dateValue: string, timeValue: string) {
  const parsed = new Date(`${dateValue}T${timeValue}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function pickCurrentAppointmentId(appointments: AppointmentLite[]) {
  const now = Date.now();
  const active = appointments
    .filter((item) => item.status !== "cancelled")
    .map((item) => ({ item, when: toAppointmentMillis(item.appointmentDate, item.appointmentTime) }))
    .filter((entry): entry is { item: AppointmentLite; when: number } => entry.when !== null);

  const upcoming = active
    .filter((entry) => entry.when >= now - 30 * 60 * 1000)
    .sort((a, b) => a.when - b.when);

  if (upcoming[0]) {
    return upcoming[0].item.id;
  }

  return null;
}

type PatientProfileSnapshot = {
  patientId?: string;
  fullName?: string;
  age?: number;
  gender?: string;
  region?: string;
  preferredLanguage?: string;
  heightCm?: number;
  weightKg?: number;
};

const staffRoles: Array<{ role: StaffRole; label: string }> = [
  { role: "doctor", label: "Doctor" },
  { role: "receptionist", label: "Receptionist" },
  { role: "coordinator", label: "Coordinator" },
  { role: "admin", label: "Admin" },
];

export function LoginPortal({ searchParams }: { searchParams: { next?: string; role?: string } }) {
  const router = useRouter();

  const requestedRole = (searchParams.role as AppRole | undefined) ?? "patient";
  const nextPath = searchParams.next;

  const [phone, setPhone] = useState("");
  const [patientMessage, setPatientMessage] = useState("");
  const [patientSubmitting, setPatientSubmitting] = useState(false);

  const [staffRole, setStaffRole] = useState<StaffRole>(requestedRole === "patient" ? "doctor" : (requestedRole as StaffRole));
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffMessage, setStaffMessage] = useState("");
  const [staffSubmitting, setStaffSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<"patient" | "staff">(
    requestedRole === "patient" ? "patient" : "staff",
  );

  const normalizedPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);

  async function createSession(body: Record<string, unknown>, messageSetter: (message: string) => void) {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as { ok: boolean; message?: string; nextPath?: string };
    if (!response.ok || !payload.ok) {
      messageSetter(payload.message ?? "Login failed");
      return;
    }

    router.push(payload.nextPath ?? "/");
  }

  async function findUpcomingAppointmentId(phoneValue: string) {
    const response = await fetch(`/api/appointments?phone=${encodeURIComponent(phoneValue)}`, { cache: "no-store" });
    const payload = (await response.json()) as { ok?: boolean; appointments?: AppointmentLite[] };
    if (!response.ok || !payload.ok) {
      return null;
    }

    return pickCurrentAppointmentId(payload.appointments ?? []);
  }

  async function handlePatientLogin() {
    setPatientMessage("");
    if (normalizedPhone.length < 10) {
      setPatientMessage("Enter a valid phone number");
      return;
    }

    setPatientSubmitting(true);
    try {
      if (typeof window !== "undefined") {
        const profilePayload = {
          phone: normalizedPhone,
        };
        window.localStorage.setItem("sei-patient-profile-latest", JSON.stringify(profilePayload));
      }

      let profileIsComplete = false;
      try {
        const profileResponse = await fetch(`/api/patient-register?phone=${encodeURIComponent(normalizedPhone)}`, {
          cache: "no-store",
        });
        const profilePayload = (await profileResponse.json()) as {
          ok?: boolean;
          record?: PatientProfileSnapshot | null;
        };

        if (profileResponse.ok && profilePayload.ok) {
          profileIsComplete = isPatientProfileComplete(profilePayload.record);
        }
      } catch {
        profileIsComplete = false;
      }

      const upcomingAppointmentId = await findUpcomingAppointmentId(normalizedPhone).catch(() => null);
      const sessionPath = profileIsComplete
        ? (nextPath
        ?? (upcomingAppointmentId
          ? `/patient/otp?phone=${encodeURIComponent(normalizedPhone)}&next=${encodeURIComponent(`/patient/book?manage=1&appointmentId=${encodeURIComponent(upcomingAppointmentId)}`)}`
          : "/patient/book?journey=1"))
        : `/register?journey=1&phone=${encodeURIComponent(normalizedPhone)}&reason=profile-incomplete`;

      await createSession(
        {
          role: "patient",
          name: normalizedPhone,
          phone: normalizedPhone,
          nextPath: sessionPath,
        },
        setPatientMessage,
      );
    } catch {
      setPatientMessage("Network error while logging in");
    } finally {
      setPatientSubmitting(false);
    }
  }

  async function handleStaffLogin() {
    setStaffMessage("");
    if (!staffEmail.trim()) {
      setStaffMessage("Enter email");
      return;
    }
    if (!staffPassword.trim()) {
      setStaffMessage("Enter password");
      return;
    }

    setStaffSubmitting(true);
    try {
      await createSession(
        {
          role: staffRole,
          email: staffEmail.trim().toLowerCase(),
          password: staffPassword,
          nextPath: nextPath,
        },
        setStaffMessage,
      );
    } catch {
      setStaffMessage("Network error while logging in");
    } finally {
      setStaffSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[color:var(--border)] bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="/" className="focus-ring flex items-center gap-2.5">
            <span className="relative h-8 w-8 overflow-hidden rounded-xl bg-[rgba(59,130,246,0.08)]">
              <Image src="/favicon.png" alt="SpinExperts icon" fill sizes="32px" className="object-contain" />
            </span>
            <span className="headline text-base font-semibold leading-none text-[color:var(--foreground)]">SpinExperts India</span>
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
        <h1 className="headline text-2xl font-semibold text-[color:var(--foreground)]">Sign in</h1>

        <div className="mt-5">
          <div className="inline-flex rounded-full border border-[rgba(21,32,43,0.12)] bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab("patient")}
              className={
                "focus-ring rounded-l-full px-4 py-2 text-sm font-semibold transition-colors " +
                (activeTab === "patient" ? "bg-[var(--accent)] text-white" : "bg-white text-[color:var(--muted)]")
              }
            >
              Patient
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("staff")}
              className={
                "focus-ring rounded-r-full px-4 py-2 text-sm font-semibold transition-colors " +
                (activeTab === "staff" ? "bg-[var(--accent)] text-white" : "bg-white text-[color:var(--muted)]")
              }
            >
              Staff
            </button>
          </div>
        </div>

        <div className="mt-5">
          <section className={activeTab === "patient" ? "block" : "hidden"}>
            <div className="flex border-b border-[rgba(21,32,43,0.08)]">
              <span className="flex-1 border-b-2 border-[var(--accent)] px-4 py-3 text-center text-sm font-semibold text-[var(--accent)]">
                Login
              </span>
              <a
                href="/register"
                className="flex-1 px-4 py-3 text-center text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
              >
                Register
              </a>
            </div>

            <div className="space-y-3.5 py-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[color:var(--muted)]">Mobile Number / Email ID</label>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Mobile Number / Email ID"
                  className="focus-ring w-full rounded-lg border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[color:var(--muted)]">Password</label>
                <input
                  value=""
                  disabled
                  readOnly
                  placeholder="Password"
                  title="Password login is disabled — patient sign-in uses OTP only for now"
                  className="w-full cursor-not-allowed rounded-lg border border-[rgba(21,32,43,0.1)] bg-[rgba(21,32,43,0.05)] px-3 py-2.5 text-[color:var(--muted)] outline-none"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5 text-[color:var(--muted)]">
                  <input type="checkbox" disabled className="h-3.5 w-3.5 cursor-not-allowed rounded" />
                  Remember me for 30 days
                </label>
                <span className="cursor-not-allowed font-semibold text-[var(--accent)] opacity-60">Forgot password?</span>
              </div>

              <label className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--foreground)]">
                <input type="checkbox" checked disabled className="h-3.5 w-3.5 rounded" />
                Login with OTP instead of password
              </label>

              {patientMessage ? <p className="text-sm font-medium text-[#1d4ed8]">{patientMessage}</p> : null}
              <button
                type="button"
                onClick={handlePatientLogin}
                disabled={patientSubmitting}
                className="focus-ring w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {patientSubmitting ? "Continuing..." : "Login"}
              </button>
            </div>
          </section>

          <section className={activeTab === "staff" ? "block" : "hidden"}>
            <h3 className="border-b border-[rgba(21,32,43,0.08)] px-1 py-3 text-sm font-semibold text-[color:var(--foreground)]">Staff login</h3>
            <div className="space-y-3 py-4">
              <select
                value={staffRole}
                onChange={(event) => setStaffRole(event.target.value as StaffRole)}
                className="focus-ring w-full rounded-lg border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 outline-none"
              >
                {staffRoles.map((item) => (
                  <option key={item.role} value={item.role}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                value={staffEmail}
                onChange={(event) => setStaffEmail(event.target.value)}
                placeholder="Staff email"
                className="focus-ring w-full rounded-lg border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 outline-none"
              />
              <div className="relative">
                <input
                  type={showStaffPassword ? "text" : "password"}
                  value={staffPassword}
                  onChange={(event) => setStaffPassword(event.target.value)}
                  placeholder="Password"
                  className="focus-ring w-full rounded-lg border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 pr-11 outline-none"
                />
                <button
                  type="button"
                  aria-label="Press and hold to show password"
                  onPointerDown={() => setShowStaffPassword(true)}
                  onPointerUp={() => setShowStaffPassword(false)}
                  onPointerLeave={() => setShowStaffPassword(false)}
                  onPointerCancel={() => setShowStaffPassword(false)}
                  onBlur={() => setShowStaffPassword(false)}
                  className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[color:var(--muted)] hover:bg-[rgba(59,130,246,0.12)]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
              {staffMessage ? <p className="text-sm font-medium text-[#1d4ed8]">{staffMessage}</p> : null}
              <button
                type="button"
                onClick={handleStaffLogin}
                disabled={staffSubmitting}
                className="focus-ring w-full rounded-full bg-[color:var(--foreground)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {staffSubmitting ? "Logging in..." : "Continue"}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
