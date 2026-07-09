"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { demoOtpCode, registeredPatientProfiles } from "@/lib/workflow-data";
import type { AppRole } from "@/lib/rbac";

type StaffRole = Exclude<AppRole, "patient">;

type PatientAppointmentLookup = {
  id: string;
  consultSessionId: string;
  patientName: string;
  patientPhone: string;
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
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientMessage, setPatientMessage] = useState("");
  const [patientSubmitting, setPatientSubmitting] = useState(false);

  const [staffRole, setStaffRole] = useState<StaffRole>(requestedRole === "patient" ? "doctor" : (requestedRole as StaffRole));
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffMessage, setStaffMessage] = useState("");
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [activeTab, setActiveTab] = useState<"patient" | "staff">(
    requestedRole === "patient" ? "patient" : "staff",
  );

  const normalizedPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);
  const demoPatientsForPhone = useMemo(
    () => registeredPatientProfiles.filter((item) => item.phone === normalizedPhone),
    [normalizedPhone],
  );

  const selectedDemoPatient = useMemo(() => {
    const explicitSelection = demoPatientsForPhone.find((item) => item.id === selectedPatientId);
    if (explicitSelection) return explicitSelection;
    if (demoPatientsForPhone.length === 1) return demoPatientsForPhone[0];
    return undefined;
  }, [demoPatientsForPhone, selectedPatientId]);

  const demoPatientPhones = useMemo(() => {
    const unique = new Set(registeredPatientProfiles.map((item) => item.phone));
    return Array.from(unique);
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
      const demoPatient = selectedDemoPatient;

      if (!savedSessionId && !latestAppointment && !demoPatient) {
        setPatientMessage("No patient or appointment found for this phone. Please contact reception.");
        return;
      }

      const resolvedSessionId = savedSessionId ?? latestAppointment?.consultSessionId ?? latestAppointment?.id ?? `${normalizedPhone}-${Date.now()}`;
      const resolvedPatientName = latestAppointment?.patientName ?? demoPatient?.name ?? normalizedPhone;
      const resolvedPatientPhone = latestAppointment?.patientPhone ?? demoPatient?.phone ?? normalizedPhone;

      const defaultPatientPath = `/patient/${resolvedSessionId}`;
      const sessionPath = nextPath ?? defaultPatientPath;
      const parts = sessionPath.split("/").filter(Boolean);
      const sessionId = parts.length ? parts[parts.length - 1] : resolvedSessionId;

      if (sessionId && typeof window !== "undefined") {
        const demoDefaults = demoPatient
          ? {
              age: demoPatient.age,
              gender: demoPatient.gender,
              preferredLanguage: demoPatient.preferredLanguage,
              region: demoPatient.region,
            }
          : {};

        window.localStorage.setItem(
          `sei-patient-profile:${sessionId}`,
          JSON.stringify({
            patientName: resolvedPatientName,
            phone: resolvedPatientPhone,
            ...demoDefaults,
          }),
        );
      }

      await createSession(
        {
          role: "patient",
          name: resolvedPatientName,
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
    <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full rounded-[1.5rem] border border-[rgba(21,32,43,0.12)] bg-white p-5 shadow-[0_20px_60px_rgba(21,32,43,0.08)] sm:p-7 lg:p-9">
        <h1 className="headline text-3xl font-semibold text-[color:var(--foreground)] sm:text-4xl">Login</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Patient login uses phone + OTP. Doctor, receptionist, and admin use staff login.</p>

        <div className="mt-6">
          <div className="mb-4 lg:hidden">
            <div className="inline-flex rounded-full border border-[rgba(21,32,43,0.12)] bg-white p-1">
              <button
                type="button"
                onClick={() => setActiveTab("patient")}
                className={
                  "focus-ring px-4 py-2 text-sm font-semibold rounded-l-full transition-colors " +
                  (activeTab === "patient" ? "bg-[var(--accent)] text-white" : "bg-white text-[color:var(--muted)]")
                }
              >
                Patient
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("staff")}
                className={
                  "focus-ring px-4 py-2 text-sm font-semibold rounded-r-full transition-colors " +
                  (activeTab === "staff" ? "bg-[var(--accent)] text-white" : "bg-white text-[color:var(--muted)]")
                }
              >
                Staff
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section
              className={
                "rounded-[1.2rem] border border-[rgba(15,118,110,0.22)] bg-[rgba(15,118,110,0.06)] p-4 sm:p-5 " +
                (activeTab === "patient" ? "block" : "hidden") +
                " lg:block"
              }
            >
              <h2 className="text-xl font-semibold text-[color:var(--foreground)]">Patient Login</h2>
              <div className="mt-4 space-y-3">
                <input
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setSelectedPatientId("");
                  }}
                  placeholder="Phone number"
                  className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
                />
                <input
                  value={patientOtp}
                  onChange={(event) => setPatientOtp(event.target.value)}
                  placeholder="OTP"
                  className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
                />
                <select
                  value={selectedPatientId}
                  onChange={(event) => setSelectedPatientId(event.target.value)}
                  className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 outline-none"
                >
                  <option value="">Select demo patient fallback</option>
                  {demoPatientsForPhone.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.age}y · {item.region}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[color:var(--muted)]">Registered demo phones: {demoPatientPhones.join(", ")}</p>
                <div className="rounded-xl bg-white px-3 py-2 text-xs text-[color:var(--muted)]">
                  Demo OTP: <span className="font-semibold tracking-[0.15em] text-[var(--accent)]">{demoOtpCode}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(demoOtpCode);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1200);
                    }}
                    className="ml-3 rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-2.5 py-1 font-semibold"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                {patientMessage ? <p className="text-sm font-medium text-[color:#b23b1e]">{patientMessage}</p> : null}
                <button
                  type="button"
                  onClick={handlePatientLogin}
                  disabled={patientSubmitting}
                  className="focus-ring w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {patientSubmitting ? "Logging in..." : "Continue to questionnaire"}
                </button>
              </div>
            </section>

            <section
              className={
                "rounded-[1.2rem] border border-[rgba(21,32,43,0.12)] bg-[rgba(248,245,240,0.8)] p-4 sm:p-5 " +
                (activeTab === "staff" ? "block" : "hidden") +
                " lg:block"
              }
            >
              <h2 className="text-xl font-semibold text-[color:var(--foreground)]">Staff Login</h2>
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
                  className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
                />
                <input
                  type="password"
                  value={staffPassword}
                  onChange={(event) => setStaffPassword(event.target.value)}
                  placeholder="Password"
                  className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
                />
                <p className="rounded-xl bg-white px-3 py-2 text-xs text-[color:var(--muted)]">
                  Demo staff credentials: doctor@spinexpert.local / Doctor@123, reception@spinexpert.local / Reception@123, admin@spinexpert.local / Admin@123. Admin can create additional users from Admin panel.
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
        </div>
      </div>
    </div>
  );
}
