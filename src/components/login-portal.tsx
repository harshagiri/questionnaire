"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { AppRole } from "@/lib/rbac";

type StaffRole = Exclude<AppRole, "patient">;

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

      const sessionPath = nextPath ?? "/patient/book?journey=1";

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
    <div className="mx-auto flex min-h-screen w-full max-w-7xl items-start px-3 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="w-full overflow-hidden rounded-[2rem] border border-[color:var(--border)] bg-white shadow-[0_30px_90px_rgba(16,53,103,0.16)]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <section className="order-2 bg-[linear-gradient(180deg,#f8fcff_0%,#edf6ff_100%)] p-4 sm:p-6 lg:order-1 lg:p-10">
            <div className="mb-5">
              <h2 className="headline text-3xl font-semibold text-[color:var(--foreground)] sm:text-4xl">Sign in</h2>
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
                  "rounded-[1.2rem] border border-[rgba(22,95,192,0.28)] bg-[rgba(22,95,192,0.08)] p-4 shadow-sm sm:p-5 " +
                  (activeTab === "patient" ? "block" : "hidden")
                }
              >
                <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Patient</h3>
                <div className="mt-4 space-y-3">
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Phone number"
                    className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 outline-none"
                  />
                  {patientMessage ? <p className="text-sm font-medium text-[#174b8a]">{patientMessage}</p> : null}
                  <button
                    type="button"
                    onClick={handlePatientLogin}
                    disabled={patientSubmitting}
                    className="focus-ring w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {patientSubmitting ? "Continuing..." : "Continue"}
                  </button>
                  <a href="/register" className="text-center text-xs font-semibold text-[var(--accent)] underline">
                    New patient? Register
                  </a>
                </div>
              </section>

              <section
                className={
                  "rounded-[1.2rem] border border-[rgba(21,32,43,0.12)] bg-white p-4 shadow-sm sm:p-5 " +
                  (activeTab === "staff" ? "block" : "hidden")
                }
              >
                <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Staff</h3>
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
                      className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[color:var(--muted)] hover:bg-[rgba(22,95,192,0.12)]"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                  {staffMessage ? <p className="text-sm font-medium text-[#174b8a]">{staffMessage}</p> : null}
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

          <section className="order-1 relative overflow-hidden bg-[linear-gradient(132deg,#0d2f57_0%,#1b5fae_48%,#5ab5ff_100%)] p-4 text-white sm:p-6 lg:order-2 lg:p-10">
            <div className="absolute -left-10 top-16 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -right-12 bottom-14 h-52 w-52 rounded-full bg-[#94cfff]/35 blur-2xl" />
            <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 opacity-12 sm:h-64 sm:w-64">
              <Image
                src="/favicon.png"
                alt=""
                fill
                sizes="256px"
                className="object-contain blur-[1px] saturate-0"
              />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 rounded-2xl border border-white/30 bg-white/12 px-3 py-3 shadow-[0_20px_44px_rgba(2,18,36,0.2)] backdrop-blur sm:w-fit sm:gap-4 sm:px-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-white/70 shadow-[0_12px_24px_rgba(2,18,36,0.24)] sm:h-20 sm:w-20">
                  <Image
                    src="/favicon.png"
                    alt="SpinExperts mark"
                    fill
                    sizes="80px"
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90">SpinExperts India</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/75">Secure access</div>
                </div>
              </div>

              <h1 className="headline mt-4 text-2xl font-semibold leading-tight sm:text-3xl lg:text-[2.45rem]">Welcome</h1>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
