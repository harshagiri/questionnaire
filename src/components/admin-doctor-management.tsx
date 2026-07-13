"use client";

import { useEffect, useMemo, useState } from "react";

type DoctorRecord = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  registrationNumber: string;
  licenseNumber: string;
  bio?: string | null;
  photoUrl?: string | null;
};

const initialForm = {
  name: "",
  email: "",
  phone: "",
  registrationNumber: "",
  licenseNumber: "",
  password: "",
  bio: "",
  photoUrl: "",
};

export function AdminDoctorManagement() {
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDoctors() {
    try {
      const response = await fetch("/api/doctors", { cache: "no-store" });
      const payload = (await response.json()) as { ok: boolean; doctors?: DoctorRecord[] };
      if (!response.ok || !payload.ok) {
        setMessage("Could not load doctors from backend.");
        return;
      }

      setDoctors(payload.doctors ?? []);
    } catch {
      setMessage("Could not load doctors from backend.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDoctors();
  }, []);

  const selectedPreview = useMemo(() => {
    if (form.photoUrl.trim()) {
      return form.photoUrl.trim();
    }
    return "https://www.gravatar.com/avatar/?d=identicon&s=256";
  }, [form.photoUrl]);

  async function handleCreateDoctor() {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.registrationNumber.trim() || !form.licenseNumber.trim() || !form.password.trim()) {
      setMessage("Name, email, phone, registration, license, and password are required.");
      return;
    }

    if (form.password.trim().length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const doctorResponse = await fetch("/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const doctorPayload = (await doctorResponse.json()) as { ok: boolean; message?: string };

      if (!doctorResponse.ok || !doctorPayload.ok) {
        setMessage(doctorPayload.message ?? "Could not create doctor profile.");
        return;
      }

      const staffResponse = await fetch("/api/staff-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "doctor",
          email: form.email,
          password: form.password,
          displayName: form.name,
        }),
      });
      const staffPayload = (await staffResponse.json()) as { ok: boolean; message?: string };

      if (!staffResponse.ok || !staffPayload.ok) {
        const staffError = (staffPayload.message ?? "Could not create doctor login.").toLowerCase();
        if (staffError.includes("already exists")) {
          setMessage("Doctor profile added. Login already existed, so existing doctor credentials were kept.");
        } else {
          setMessage(staffPayload.message ?? "Doctor profile added, but login creation failed.");
        }
        setForm(initialForm);
        await loadDoctors();
        return;
      }

      setMessage("Doctor profile and login created successfully.");
      setForm(initialForm);
      await loadDoctors();
    } catch {
      setMessage("Could not create doctor profile and login.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
        <h2 className="headline text-2xl font-semibold">Add doctor</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Admin collects doctor profile details here. Photo is optional; Gravatar identicon is used by default.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Doctor full name"
            className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
          <input
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Doctor email"
            className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="Phone"
            className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
          <input
            value={form.registrationNumber}
            onChange={(event) => setForm((current) => ({ ...current, registrationNumber: event.target.value }))}
            placeholder="Registration number"
            className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
          <input
            value={form.licenseNumber}
            onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))}
            placeholder="License number"
            className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Doctor login password (min 8)"
            className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
          <input
            value={form.photoUrl}
            onChange={(event) => setForm((current) => ({ ...current, photoUrl: event.target.value }))}
            placeholder="Photo URL (optional)"
            className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
          <textarea
            value={form.bio}
            onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
            placeholder="Bio (optional)"
            rows={3}
            className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedPreview} alt="Doctor preview" className="h-11 w-11 rounded-full object-cover" />
          <div className="text-xs text-[color:var(--muted)]">Default avatar: Gravatar identicon. Custom photo URL overrides this.</div>
        </div>

        {message ? <p className="mt-3 text-sm text-[color:var(--muted)]">{message}</p> : null}

        <button
          type="button"
          onClick={handleCreateDoctor}
          disabled={submitting}
          className="focus-ring mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Add doctor"}
        </button>
      </div>

      <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
        <h2 className="headline text-2xl font-semibold">Doctor roster</h2>
        <div className="mt-4 space-y-3">
          {doctors.length === 0 ? (
            <div className="rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2.5 text-sm text-[color:var(--muted)]">No doctors added yet.</div>
          ) : (
            doctors.map((doctor) => (
              <div key={doctor.id ?? doctor.email} className="flex items-center gap-3 rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={doctor.photoUrl ?? "https://www.gravatar.com/avatar/?d=identicon&s=256"} alt={doctor.name} className="h-10 w-10 rounded-full object-cover" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{doctor.name}</div>
                  <div className="truncate text-xs text-[color:var(--muted)]">
                    {doctor.registrationNumber} · {doctor.licenseNumber}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
