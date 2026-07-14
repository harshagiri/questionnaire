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

type AvailabilitySlot = {
  id: string;
  doctorProfileId: string;
  dayOfWeek: number;
  startTime: string;
  slotDurationMinutes: number;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL  = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAX_SLOTS = 5;

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

// ── Slot Manager Panel ────────────────────────────────────────────────────────

function SlotManager({
  doctor,
  onClose,
}: {
  doctor: DoctorRecord;
  onClose: () => void;
}) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Global duration applied to every new slot
  const [globalDuration, setGlobalDuration] = useState(30);
  // New slot form
  const [newDay, setNewDay] = useState(1);
  const [newTime, setNewTime] = useState("09:00");

  useEffect(() => {
    if (!doctor.id) return;
    setLoading(true);
    fetch(`/api/doctor-slots?doctorProfileId=${doctor.id}`)
      .then((r) => r.json())
      .then((d: { slots?: AvailabilitySlot[] }) => {
        const loaded = d.slots ?? [];
        setSlots(loaded);
        // Pre-fill global duration from first existing slot
        if (loaded.length > 0) setGlobalDuration(loaded[0].slotDurationMinutes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [doctor.id]);

  async function addSlot() {
    if (!doctor.id) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/doctor-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorProfileId: doctor.id,
          dayOfWeek: newDay,
          startTime: newTime,
          slotDurationMinutes: globalDuration,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; slot?: AvailabilitySlot; message?: string };
      if (res.ok && data.ok && data.slot) {
        setSlots((prev) =>
          [...prev, data.slot!].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
        );
      } else {
        setMsg(data.message ?? "Could not add slot.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSlot(id: string) {
    setMsg("");
    try {
      const res = await fetch(`/api/doctor-slots?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSlots((prev) => prev.filter((s) => s.id !== id));
      } else {
        setMsg("Could not remove slot.");
      }
    } catch {
      setMsg("Network error.");
    }
  }

  // Group slots by day for the visual summary
  const slotsByDay = DAY_FULL.map((_, i) => slots.filter((s) => s.dayOfWeek === i));
  const totalSlots = slots.length;
  const canAdd = totalSlots < MAX_SLOTS;

  return (
    <div className="mt-6 rounded-[1.5rem] border-2 border-teal-200 bg-teal-50/40 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Weekly availability — {doctor.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Up to {MAX_SLOTS} slots per week. Slots can be on any combination of days.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white transition-colors"
          title="Close slot editor"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-2">Loading slots…</p>
      ) : (
        <>
          {/* Slot duration setting */}
          <div className="mb-4 flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
            <svg className="w-4 h-4 text-teal-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <label className="text-sm font-medium text-gray-700 flex-1">
              Slot duration — applies to all slots for this doctor
            </label>
            <div className="flex items-center gap-2">
              <select
                value={globalDuration}
                onChange={(e) => setGlobalDuration(Number(e.target.value))}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {[15, 20, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>
          </div>

          {/* Slot count pill */}
          <div className="flex items-center gap-2 mb-4">
            {[...Array(MAX_SLOTS)].map((_, i) => (
              <div
                key={i}
                className={`h-2.5 flex-1 rounded-full transition-colors ${i < totalSlots ? "bg-teal-500" : "bg-gray-200"}`}
              />
            ))}
            <span className="text-xs font-semibold text-gray-500 ml-1 whitespace-nowrap">
              {totalSlots} / {MAX_SLOTS} slots
            </span>
          </div>

          {/* Weekly visual — show configured slots grouped by day */}
          {totalSlots > 0 && (
            <div className="grid grid-cols-7 gap-1 mb-4">
              {DAY_LABELS.map((day, dayIdx) => {
                const daySlotsArr = slotsByDay[dayIdx];
                return (
                  <div key={dayIdx} className="text-center">
                    <div className={`text-[10px] font-semibold mb-1 ${daySlotsArr.length > 0 ? "text-teal-700" : "text-gray-300"}`}>
                      {day}
                    </div>
                    {daySlotsArr.length > 0 ? (
                      daySlotsArr.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => removeSlot(s.id)}
                          title={`${DAY_FULL[s.dayOfWeek]} ${s.startTime} — click to remove`}
                          className="block w-full mb-1 rounded-lg bg-teal-600 text-white text-[10px] font-medium px-1 py-1.5 hover:bg-red-500 transition-colors leading-tight"
                        >
                          {s.startTime}
                          <span className="block text-[9px] opacity-80">{s.slotDurationMinutes}m</span>
                        </button>
                      ))
                    ) : (
                      <div className="h-8 rounded-lg border border-dashed border-gray-200" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {totalSlots === 0 && (
            <div className="rounded-xl border border-dashed border-teal-200 px-4 py-6 text-center mb-4">
              <p className="text-sm text-gray-400">No slots configured yet.</p>
              <p className="text-xs text-gray-300 mt-0.5">Add up to {MAX_SLOTS} weekly recurring time slots below.</p>
            </div>
          )}

          {/* Add new slot */}
          {canAdd ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-600 mb-3">
                Add slot ({totalSlots < MAX_SLOTS ? `${MAX_SLOTS - totalSlots} remaining` : "full"})
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Day of week</label>
                  <select
                    value={newDay}
                    onChange={(e) => setNewDay(Number(e.target.value))}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {DAY_FULL.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="text-xs text-gray-400 self-end pb-2">
                  Duration: <strong className="text-gray-700">{globalDuration} min</strong> (set above)
                </div>
                <button
                  onClick={addSlot}
                  disabled={saving}
                  className="ml-auto rounded-xl bg-teal-600 text-white text-sm font-semibold px-4 py-2 hover:bg-teal-700 disabled:opacity-60 transition-colors"
                >
                  {saving ? "Adding…" : `+ Add ${DAY_FULL[newDay]} ${newTime}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              Maximum {MAX_SLOTS} slots reached. Remove a slot to add a different one.
            </div>
          )}

          {totalSlots > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Tip: Click any slot in the weekly grid above to remove it.
            </p>
          )}
          {msg && <p className="text-xs text-red-600 mt-2">{msg}</p>}
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AdminDoctorManagement() {
  const [expanded, setExpanded] = useState(false);
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [managingSlotsFor, setManagingSlotsFor] = useState<DoctorRecord | null>(null);

  async function loadDoctors() {
    try {
      const response = await fetch("/api/doctors?withSlots=true", { cache: "no-store" });
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
    return form.photoUrl.trim() || "https://www.gravatar.com/avatar/?d=identicon&s=256";
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
      const doctorPayload = (await doctorResponse.json()) as { ok: boolean; message?: string; doctor?: DoctorRecord };

      if (!doctorResponse.ok || !doctorPayload.ok) {
        setMessage(doctorPayload.message ?? "Could not create doctor profile.");
        return;
      }

      await fetch("/api/staff-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "doctor", email: form.email, password: form.password, displayName: form.name }),
      }).catch(() => {});

      setMessage("Doctor created. Configure their weekly availability slots →");
      setForm(initialForm);
      await loadDoctors();
      if (doctorPayload.doctor) setManagingSlotsFor(doctorPayload.doctor);
    } catch {
      setMessage("Could not create doctor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white shadow-sm overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); if (managingSlotsFor) setManagingSlotsFor(null); }}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[rgba(21,32,43,0.02)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white bg-teal-600">
            D
          </span>
          <div>
            <p className="text-base font-semibold text-gray-900">Doctors</p>
            <p className="text-xs text-[color:var(--muted)]">
              {doctors.length === 0 ? "No doctors added yet" : `${doctors.length} doctor${doctors.length > 1 ? "s" : ""} — click to manage profiles and availability slots`}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          <div className="space-y-4">
            <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              {/* ── Left: Add doctor form ── */}
              <div className="rounded-[1.25rem] border border-[rgba(21,32,43,0.08)] bg-[rgba(21,32,43,0.01)] p-5">
                <h3 className="text-base font-semibold text-gray-900">Add doctor</h3>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  Creates profile + login. Configure availability slots after saving.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Doctor full name" className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none" />
                  <input value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="Doctor email" className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none" />
                  <input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} placeholder="Phone" className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none" />
                  <input value={form.registrationNumber} onChange={(e) => setForm((c) => ({ ...c, registrationNumber: e.target.value }))} placeholder="Registration number" className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none" />
                  <input value={form.licenseNumber} onChange={(e) => setForm((c) => ({ ...c, licenseNumber: e.target.value }))} placeholder="License number" className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none" />
                  <input type="password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} placeholder="Login password (min 8)" className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none" />
                  <input value={form.photoUrl} onChange={(e) => setForm((c) => ({ ...c, photoUrl: e.target.value }))} placeholder="Photo URL (optional)" className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none" />
                  <textarea value={form.bio} onChange={(e) => setForm((c) => ({ ...c, bio: e.target.value }))} placeholder="Bio (optional)" rows={2} className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none" />
                </div>

                <div className="mt-3 flex items-center gap-3 rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedPreview} alt="Doctor preview" className="h-11 w-11 rounded-full object-cover" />
                  <div className="text-xs text-[color:var(--muted)]">Gravatar identicon used when no URL provided.</div>
                </div>

                {message && <p className="mt-3 text-sm text-[color:var(--muted)]">{message}</p>}

                <button type="button" onClick={handleCreateDoctor} disabled={submitting} className="focus-ring mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {submitting ? "Saving..." : "Add doctor"}
                </button>
              </div>

              {/* ── Right: Doctor roster ── */}
              <div className="rounded-[1.25rem] border border-[rgba(21,32,43,0.08)] bg-[rgba(21,32,43,0.01)] p-5">
                <h3 className="text-base font-semibold text-gray-900">Doctor roster</h3>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  Click <span className="font-semibold text-teal-700">Manage slots</span> to configure weekly availability.
                </p>
                <div className="mt-4 space-y-2">
                  {doctors.length === 0 ? (
                    <div className="rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-4 text-sm text-[color:var(--muted)] text-center">
                      No doctors added yet.
                    </div>
                  ) : (
                    doctors.map((doctor) => {
                      const isActive = managingSlotsFor?.id === doctor.id;
                      const slotCount = (doctor as DoctorRecord & { slots?: unknown[] }).slots?.length ?? 0;
                      return (
                        <div key={doctor.id ?? doctor.email} className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${isActive ? "border-teal-300 bg-teal-50/40" : "border-[rgba(21,32,43,0.08)]"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={doctor.photoUrl ?? "https://www.gravatar.com/avatar/?d=identicon&s=256"} alt={doctor.name} className="h-10 w-10 rounded-full object-cover shrink-0 border border-white shadow-sm" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{doctor.name}</div>
                            <div className="text-xs text-[color:var(--muted)] truncate">{doctor.registrationNumber}</div>
                          </div>
                          <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${slotCount > 0 ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500"}`}>
                            {slotCount}/{MAX_SLOTS} slots
                          </div>
                          <button
                            onClick={() => setManagingSlotsFor(isActive ? null : doctor)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isActive ? "bg-gray-200 text-gray-700" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                          >
                            {isActive ? "Close" : "Manage slots"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            {/* ── Full-width Slot Manager ── */}
            {managingSlotsFor && (
              <SlotManager
                doctor={managingSlotsFor}
                onClose={() => setManagingSlotsFor(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}


