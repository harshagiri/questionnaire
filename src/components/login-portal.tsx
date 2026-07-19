"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppRole } from "@/lib/rbac";

type StaffRole = Exclude<AppRole, "patient">;

type PatientAppointmentLookup = {
  id: string;
  consultSessionId: string;
  patientName: string;
  patientPhone: string;
};

type PlatformStat = {
  label: string;
  value: string;
  note: string;
  progress: number;
};

const staffRoles: Array<{ role: StaffRole; label: string }> = [
  { role: "doctor", label: "Doctor" },
  { role: "receptionist", label: "Receptionist" },
  { role: "admin", label: "Admin" },
];

export function LoginPortal({ searchParams }: { searchParams: { next?: string; role?: string } }) {
  const router = useRouter();

  const requestedRole = (searchParams.role as AppRole | undefined) ?? "patient";
  const nextPath = searchParams.next;

  const [phone, setPhone] = useState("");
  const [patientOtp, setPatientOtp] = useState("");
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
  const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const normalizedPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);

  useEffect(() => {
    let active = true;

    async function loadPlatformStats() {
      try {
        setStatsLoading(true);
        const response = await fetch("/api/metrics", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              metrics?: {
                summary?: {
                  totalPatients?: number;
                  completedPatients?: number;
                  completionRate?: number;
                  averageBmi?: number;
                  totalDoctors?: number;
                  totalRegionsServed?: number;
                };
              };
            }
          | null;

        if (!active) {
          return;
        }

        const summary = payload?.metrics?.summary;
        const headlineStats: PlatformStat[] = [
          {
            label: "Total patients screened",
            value: String(summary?.completedPatients ?? 0),
            note: "Submitted patient screenings",
            progress: Math.min(100, Number(summary?.completedPatients ?? 0)),
          },
          {
            label: "Total doctors",
            value: String(summary?.totalDoctors ?? 0),
            note: "Doctors available in platform",
            progress: Math.min(100, Number(summary?.totalDoctors ?? 0)),
          },
          {
            label: "Regions/Cities served",
            value: String(summary?.totalRegionsServed ?? 0),
            note: "Distinct regions in patient records",
            progress: Math.min(100, Number(summary?.totalRegionsServed ?? 0)),
          },
        ];

        setPlatformStats(headlineStats);
      } catch {
        if (!active) {
          return;
        }

        setPlatformStats([
          {
            label: "Total patients screened",
            value: "—",
            note: "Submitted patient screenings",
            progress: 70,
          },
          {
            label: "Total doctors",
            value: "—",
            note: "Doctors available in platform",
            progress: 85,
          },
          {
            label: "Regions/Cities served",
            value: "—",
            note: "Distinct regions in patient records",
            progress: 92,
          },
        ]);
      } finally {
        if (active) {
          setStatsLoading(false);
        }
      }
    }

    void loadPlatformStats();

    return () => {
      active = false;
    };
  }, []);

  async function loadAppointmentsByPhone(phoneNumber: string) {
    const response = await fetch(`/api/appointments?phone=${encodeURIComponent(phoneNumber)}`, { cache: "no-store" });
    const payload = (await response.json()) as {
      ok?: boolean;
      appointments?: PatientAppointmentLookup[];
    };

    if (!response.ok || !payload.ok) {
      return [];
    }

    return payload.appointments ?? [];
  }

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

  async function handlePatientLogin() {
    setPatientMessage("");
    if (normalizedPhone.length < 10) {
      setPatientMessage("Enter a valid phone number");
      return;
    }
    if (!patientOtp.trim()) {
      setPatientMessage("Enter OTP");
      return;
    }

    setPatientSubmitting(true);
    try {
      const [savedResponse, appointmentMatches] = await Promise.all([
        fetch(`/api/patient-intake?phone=${encodeURIComponent(normalizedPhone)}`),
        loadAppointmentsByPhone(normalizedPhone),
      ]);

      const savedPayload = (await savedResponse.json()) as { ok?: boolean; record?: { sessionId?: string } | null };
      const savedSessionId = savedPayload.ok ? savedPayload.record?.sessionId : undefined;
      const latestAppointment = appointmentMatches[0];

      const resolvedPatientName = latestAppointment?.patientName ?? normalizedPhone;
      const resolvedPatientPhone = latestAppointment?.patientPhone ?? normalizedPhone;

      // Prefer the explicit nextPath (e.g., direct pre-consult link), otherwise go to dashboard
      const sessionPath = nextPath ?? "/patient";
      const resolvedSessionId = savedSessionId ?? latestAppointment?.consultSessionId ?? latestAppointment?.id ?? `${normalizedPhone}-${Date.now()}`;

      if (resolvedSessionId && typeof window !== "undefined") {
        const profilePayload = {
          fullName: resolvedPatientName,
          patientName: resolvedPatientName,
          phone: resolvedPatientPhone,
        };

        window.localStorage.setItem(
          `sei-patient-profile:${resolvedSessionId}`,
          JSON.stringify(profilePayload),
        );

        window.localStorage.setItem("sei-patient-profile-latest", JSON.stringify(profilePayload));
      }

      await createSession(
        {
          role: "patient",
          name: normalizedPhone,  // store phone as name so dashboard can load records
          phone: normalizedPhone,
          otp: patientOtp,
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
    <div className="mx-auto flex min-h-screen w-full max-w-7xl items-start px-3 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="w-full overflow-hidden rounded-[2rem] border border-[rgba(21,32,43,0.12)] bg-white shadow-[0_30px_90px_rgba(21,32,43,0.14)]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <section className="order-2 bg-[linear-gradient(180deg,#fffdf8_0%,#f7f4ee_100%)] p-4 sm:p-6 lg:order-1 lg:p-10">
            <div className="mb-5">
              <h2 className="headline text-3xl font-semibold text-[color:var(--foreground)] sm:text-4xl">Login</h2>
            </div>

            <div className="mb-4">
              <div className="inline-flex rounded-full border border-[rgba(21,32,43,0.12)] bg-white p-1 shadow-sm">
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

            <div>
              <section
                className={
                  "rounded-[1.2rem] border border-[rgba(15,118,110,0.24)] bg-[rgba(15,118,110,0.06)] p-4 shadow-sm sm:p-5 " +
                  (activeTab === "patient" ? "block" : "hidden")
                }
              >
                <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Patient Login</h3>
                <div className="mt-4 space-y-3">
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Phone number"
                    className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 outline-none"
                  />
                  <input
                    value={patientOtp}
                    onChange={(event) => setPatientOtp(event.target.value)}
                    placeholder="OTP"
                    className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 outline-none"
                  />
                  <div className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-white px-3 py-2 text-xs text-[color:var(--muted)]">
                    Access code is provided by reception for your phone number and expires automatically.
                  </div>
                  {patientMessage ? <p className="text-sm font-medium text-[color:#b23b1e]">{patientMessage}</p> : null}
                  <button
                    type="button"
                    onClick={handlePatientLogin}
                    disabled={patientSubmitting}
                    className="focus-ring w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {patientSubmitting ? "Logging in..." : "Login"}
                  </button>
                  <p className="text-center text-xs text-[color:var(--muted)]">
                    New patient?{" "}
                    <a href="/register" className="font-semibold text-[var(--accent)] underline">
                      Register to get your patient ID
                    </a>
                  </p>
                </div>
              </section>

              <section
                className={
                  "rounded-[1.2rem] border border-[rgba(21,32,43,0.12)] bg-white p-4 shadow-sm sm:p-5 " +
                  (activeTab === "staff" ? "block" : "hidden")
                }
              >
                <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Staff Login</h3>
                <div className="mt-4 space-y-3">
                  <select
                    value={staffRole}
                    onChange={(event) => setStaffRole(event.target.value as StaffRole)}
                    className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 outline-none"
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
                    className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 outline-none"
                  />
                  <div className="relative">
                    <input
                      type={showStaffPassword ? "text" : "password"}
                      value={staffPassword}
                      onChange={(event) => setStaffPassword(event.target.value)}
                      placeholder="Password"
                      className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 pr-11 outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Press and hold to show password"
                      onPointerDown={() => setShowStaffPassword(true)}
                      onPointerUp={() => setShowStaffPassword(false)}
                      onPointerLeave={() => setShowStaffPassword(false)}
                      onPointerCancel={() => setShowStaffPassword(false)}
                      onBlur={() => setShowStaffPassword(false)}
                      className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[color:var(--muted)] hover:bg-[rgba(21,32,43,0.06)]"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                  <p className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-[rgba(248,245,240,0.8)] px-3 py-2 text-xs text-[color:var(--muted)]">
                    Use the email and password configured for your account by the admin.
                  </p>
                  {staffMessage ? <p className="text-sm font-medium text-[color:#b23b1e]">{staffMessage}</p> : null}
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
          </section>

          <section className="order-1 relative overflow-hidden bg-[linear-gradient(130deg,#063b57_0%,#0b6a7a_38%,#f17b4a_100%)] p-4 text-white sm:p-6 lg:order-2 lg:p-10">
            <div className="absolute -left-10 top-16 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -right-12 bottom-14 h-52 w-52 rounded-full bg-[#ffcf9f]/30 blur-2xl" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/10 px-3 py-2 backdrop-blur">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-[#0b5568]">SE</div>
                <div className="text-xs font-semibold tracking-[0.12em] text-white/90">SPINEXPERT ADVANCED SPINE CARE NETWORK</div>
              </div>

              <h1 className="headline mt-4 text-2xl font-semibold leading-tight sm:text-3xl lg:text-[2.45rem]">
                <span className="sm:hidden">India-wide spine triage and treatment planning, built for faster right-care.</span>
                <span className="hidden sm:inline">India-wide spine triage and treatment planning, built for faster right-care pathways.</span>
              </h1>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                {statsLoading
                  ? ["A", "B", "C"].map((key) => (
                      <div key={key} className="rounded-2xl border border-white/20 bg-white/15 p-2.5 backdrop-blur-sm sm:p-3">
                        <div className="h-3 w-12 animate-pulse rounded bg-white/30 sm:h-4 sm:w-16" />
                        <div className="mt-2 h-6 w-14 animate-pulse rounded bg-white/30 sm:h-7 sm:w-20" />
                      </div>
                    ))
                  : platformStats.slice(0, 3).map((item) => (
                      <article key={item.label} className="rounded-2xl border border-white/20 bg-white/15 p-2.5 text-center backdrop-blur-sm sm:p-3">
                        <div className="flex h-9 items-center justify-center text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-white/85 sm:h-10 sm:text-[11px] sm:tracking-[0.12em]">
                          {item.label}
                        </div>
                        <div className="mt-1 text-lg font-semibold leading-none text-white sm:mt-1.5 sm:text-2xl">{item.value}</div>
                      </article>
                    ))}
              </div>

              {statsLoading ? <div className="mt-4 text-sm text-white/85">Loading live spine-care network metrics...</div> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
