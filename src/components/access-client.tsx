"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { roleLandingCopy } from "@/lib/workflow-data";
import type { AppRole } from "@/lib/rbac";

const roleCards: Array<{ role: AppRole; label: string; note: string }> = [
  { role: "patient", label: "Patient", note: "Intake, secure access code, and questionnaire start" },
  { role: "doctor", label: "Doctor", note: "Consult review and sectioned validation" },
  { role: "receptionist", label: "Receptionist", note: "Appointment booking only" },
  { role: "admin", label: "Admin", note: "Usage metrics and RBAC controls" },
];

export function AccessClient({ searchParams }: { searchParams: { next?: string; role?: string } }) {
  const router = useRouter();
  const nextPath = searchParams.next ?? "/";
  const presetRole = (searchParams.role as AppRole | undefined) ?? "patient";
  const [selectedRole, setSelectedRole] = useState<AppRole>(presetRole);
  const [patientOtp, setPatientOtp] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const patientCopy = useMemo(() => "Ask reception for the temporary access code", []);

  async function continueAccess(role: AppRole) {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, name: name || `${role} user`, otp: role === "patient" ? patientOtp : undefined, nextPath }),
      });

      const payload = (await response.json()) as { ok: boolean; message?: string; nextPath?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Could not start session");
        return;
      }

      router.push(payload.nextPath ?? nextPath);
    } catch {
      setMessage("Network error while starting session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="glass-panel rounded-[2rem] p-6 lg:p-8">
          <div className="relative mb-4 h-14 w-[180px] overflow-hidden rounded-lg border border-[rgba(21,32,43,0.08)] bg-white/70 p-1.5">
            <Image
              src="/logo.jpg"
              alt="SpinExperts India"
              fill
              sizes="180px"
              className="object-contain"
            />
          </div>
          <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">Secure access</span>
          <h1 className="headline mt-4 text-4xl font-semibold sm:text-5xl">Choose your role and continue</h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-[color:var(--muted)]">{roleLandingCopy[selectedRole]}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {roleCards.map((card) => (
              <button
                key={card.role}
                type="button"
                onClick={() => setSelectedRole(card.role)}
                className={`focus-ring rounded-[1.35rem] border p-4 text-left transition ${selectedRole === card.role ? "border-[var(--accent)] bg-[rgba(15,118,110,0.08)]" : "border-[rgba(21,32,43,0.12)] bg-white"}`}
              >
                <div className="text-lg font-semibold">{card.label}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">{card.note}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3 rounded-[1.5rem] bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-[color:var(--foreground)]">Display name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              className="focus-ring w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none"
            />
            <label className="block text-sm font-semibold text-[color:var(--foreground)]">Session note</label>
            <div className="rounded-2xl bg-[rgba(15,118,110,0.06)] px-4 py-3 text-sm leading-7 text-[color:var(--muted)]">
              Role access is enforced by cookie-backed route guards.
            </div>
          </div>

          {message ? <div className="mt-4 rounded-2xl bg-[rgba(255,138,91,0.12)] px-4 py-3 text-sm font-medium text-[color:var(--foreground)]">{message}</div> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => continueAccess(selectedRole)} disabled={submitting} className="focus-ring rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {submitting ? "Starting..." : `Continue as ${selectedRole}`}
            </button>
            <button type="button" onClick={() => router.push(nextPath)} className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold">
              Back to requested page
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel rounded-[2rem] p-6 lg:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Patient Access</div>
                <h2 className="headline mt-2 text-3xl font-semibold">Request code from reception desk</h2>
              </div>
              <span className="rounded-full bg-[rgba(15,118,110,0.08)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">No SMS / WhatsApp required</span>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-[rgba(15,118,110,0.16)] bg-[linear-gradient(180deg,rgba(15,118,110,0.08),rgba(255,255,255,0.88))] p-5">
              <div className="text-sm text-[color:var(--muted)]">Temporary access code</div>
              <div className="mt-2 text-xl font-semibold text-[var(--accent)]">{patientCopy}</div>
              <div className="mt-2 text-sm text-[color:var(--muted)]">Reception can view and rotate your code for your registered phone number. Codes expire automatically.</div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-4 py-2 text-sm font-semibold" onClick={() => setSelectedRole("patient")}>
                  Open patient login
                </button>
              </div>
            </div>
          </div>

          {selectedRole === "patient" ? (
            <div className="glass-panel rounded-[2rem] p-6 lg:p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Patient login</div>
              <div className="mt-2 text-2xl font-semibold">Enter the access code from reception</div>
              <div className="mt-4 space-y-3">
                <input value={patientOtp} onChange={(event) => setPatientOtp(event.target.value)} className="focus-ring w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" placeholder="Enter access code" />
                <button type="button" onClick={() => continueAccess("patient")} disabled={submitting} className="focus-ring w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  Verify and continue
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}