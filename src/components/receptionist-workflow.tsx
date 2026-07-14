"use client";

import { useEffect, useState } from "react";
import type { ReceptionDraftRecord } from "@/lib/portal-storage";
import { createSessionId, loadReceptionDraft, saveReceptionDraft } from "@/lib/portal-storage";

type BookingDraft = Omit<ReceptionDraftRecord, "sessionId" | "updatedAt"> & Record<string, string>;

type QueueAppointment = {
  id: string;
  consultSessionId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type DoctorWithSlots = {
  id: string;
  name: string;
  registrationNumber?: string;
  slots: Array<{ id: string; dayOfWeek: number; startTime: string; slotDurationMinutes: number }>;
};

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const queueStatusOptions = [
  { label: "Booked", value: "booked" },
  { label: "Waiting", value: "waiting" },
  { label: "Submitted", value: "submitted" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Follow-up", value: "follow_up" },
] as const;

const appointmentTypeOptions = [
  { label: "New consult", value: "new" },
  { label: "Follow-up", value: "follow-up" },
  { label: "Teleconsult (video)", value: "teleconsult" },
  { label: "Walk-in", value: "walk-in" },
];

export function ReceptionistWorkflow({ receptionistEmail }: { receptionistEmail?: string }) {
  const [doctors, setDoctors] = useState<DoctorWithSlots[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(() => {
    const savedDraft = loadReceptionDraft("booking");
    return {
      patientName: savedDraft?.patientName ?? "",
      patientPhone: savedDraft?.patientPhone ?? "",
      doctorName: savedDraft?.doctorName ?? "",
      appointmentDate: savedDraft?.appointmentDate ?? "",
      appointmentTime: savedDraft?.appointmentTime ?? "",
      appointmentType: savedDraft?.appointmentType ?? "new",
      status: savedDraft?.status ?? "booked",
      notes: savedDraft?.notes ?? "",
    };
  });
  const [saveMessage, setSaveMessage] = useState("");
  const [issuedLink, setIssuedLink] = useState("");
  const [savedQueue, setSavedQueue] = useState<QueueAppointment[]>([]);

  const selectedDoctor = doctors.find((d) => d.id === bookingDraft.doctorName);

  // Compute available slots for the selected date based on day-of-week
  const availableSlots = (() => {
    if (!selectedDoctor || !bookingDraft.appointmentDate) return [];
    const dow = new Date(bookingDraft.appointmentDate).getDay();
    return selectedDoctor.slots.filter((s) => s.dayOfWeek === dow);
  })();

  useEffect(() => {
    let active = true;

    async function loadDoctors() {
      try {
        // Use receptionistEmail to get only assigned doctors, with their slots
        const url = receptionistEmail
          ? `/api/doctors?receptionistEmail=${encodeURIComponent(receptionistEmail)}&withSlots=true`
          : "/api/doctors?withSlots=true";
        const response = await fetch(url, { cache: "no-store" });
        const payload = (await response.json()) as {
          ok: boolean;
          doctors?: DoctorWithSlots[];
        };

        if (!active || !response.ok || !payload.ok) return;
        setDoctors(payload.doctors ?? []);
      } catch {
        if (active) setDoctors([]);
      }
    }

    loadDoctors();
    return () => { active = false; };
  }, [receptionistEmail]);

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      try {
        const response = await fetch("/api/appointments", { cache: "no-store" });
        const payload = (await response.json()) as {
          ok: boolean;
          appointments?: QueueAppointment[];
        };

        if (!active || !response.ok || !payload.ok) return;
        setSavedQueue(payload.appointments ?? []);
      } catch {
        if (active) setSavedQueue([]);
      } finally {
        if (active) setIsLoadingQueue(false);
      }
    }

    loadAppointments();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    saveReceptionDraft({
      sessionId: "booking",
      ...bookingDraft,
      updatedAt: new Date().toISOString(),
    });
  }, [bookingDraft]);

  const updateField = (field: string, value: string) => {
    setBookingDraft((c) => ({ ...c, [field]: value }));
    setSaveMessage("");
  };

  const saveBooking = async (issueLink = false) => {
    const doctorId = bookingDraft.doctorName.trim();
    const doctor = doctors.find((d) => d.id === doctorId);

    if (!bookingDraft.patientName.trim() || !bookingDraft.patientPhone.trim() || !doctorId) {
      setSaveMessage("Fill patient name, phone, and doctor.");
      return;
    }
    if (!bookingDraft.appointmentDate.trim()) {
      setSaveMessage("Select an appointment date.");
      return;
    }
    if (!bookingDraft.appointmentTime.trim()) {
      setSaveMessage("Select a time slot.");
      return;
    }

    const sessionId = createSessionId(bookingDraft.patientName || bookingDraft.patientPhone);
    const payload = {
      consultSessionId: sessionId,
      patientName: bookingDraft.patientName.trim(),
      patientPhone: bookingDraft.patientPhone.trim(),
      doctorId,
      appointmentDate: bookingDraft.appointmentDate.trim(),
      appointmentTime: bookingDraft.appointmentTime.trim(),
      appointmentType: bookingDraft.appointmentType.trim() || "new",
      status: bookingDraft.status.trim() || "booked",
      notes: bookingDraft.notes.trim(),
    };

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json()) as {
        ok: boolean;
        appointment?: QueueAppointment;
        consultLink?: string;
        message?: string;
      };

      if (!response.ok || !responsePayload.ok) {
        setSaveMessage(responsePayload.message ?? "Could not create appointment.");
        return;
      }

      setSavedQueue((c) => [responsePayload.appointment as QueueAppointment, ...c.filter((i) => i.id !== responsePayload.appointment?.id)]);

      const consultLink = responsePayload.consultLink ?? `${window.location.origin}/access?role=patient&next=/patient/${sessionId}`;
      setIssuedLink(consultLink);
      setSaveMessage(issueLink ? "Appointment saved and consult link ready." : "Appointment saved.");

      if (issueLink && navigator.clipboard) {
        await navigator.clipboard.writeText(consultLink);
        setSaveMessage("Appointment saved and link copied to clipboard.");
      }
    } catch {
      setSaveMessage("Network error.");
    }
  };

  const updateQueueStatus = async (id: string, status: string) => {
    try {
      const response = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      const payload = (await response.json()) as { ok: boolean; appointment?: QueueAppointment; message?: string };
      if (!response.ok || !payload.ok || !payload.appointment) {
        setSaveMessage(payload.message ?? "Could not update status.");
        return;
      }

      setSavedQueue((c) => c.map((item) => (item.id === id ? payload.appointment as QueueAppointment : item)));
    } catch {
      setSaveMessage("Network error.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
          <h2 className="headline text-3xl font-semibold">Book appointment</h2>
          {receptionistEmail && doctors.length === 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
              No doctors assigned to you yet. Ask admin to assign doctors to your account.
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Patient */}
            <label>
              <span className="text-sm font-semibold">Patient name</span>
              <input type="text" value={bookingDraft.patientName} onChange={(e) => updateField("patientName", e.target.value)} placeholder="Full name" className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" />
            </label>
            <label>
              <span className="text-sm font-semibold">Patient phone</span>
              <input type="tel" value={bookingDraft.patientPhone} onChange={(e) => updateField("patientPhone", e.target.value)} placeholder="Mobile number" className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" />
            </label>

            {/* Doctor selector (filtered by assignment) */}
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">Doctor</span>
              <select value={bookingDraft.doctorName} onChange={(e) => { updateField("doctorName", e.target.value); updateField("appointmentTime", ""); }} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3">
                <option value="">Select a doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.registrationNumber ? ` (${d.registrationNumber})` : ""}</option>
                ))}
              </select>
            </label>

            {/* Date */}
            <label>
              <span className="text-sm font-semibold">Appointment date</span>
              <input type="date" value={bookingDraft.appointmentDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { updateField("appointmentDate", e.target.value); updateField("appointmentTime", ""); }} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" />
            </label>

            {/* Time slot picker — from doctor's availability */}
            <label>
              <span className="text-sm font-semibold">
                Time slot
                {bookingDraft.appointmentDate && selectedDoctor && (
                  <span className="ml-1 text-xs font-normal text-[color:var(--muted)]">
                    — {DAY_NAMES[new Date(bookingDraft.appointmentDate).getDay()]}
                  </span>
                )}
              </span>
              {availableSlots.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => updateField("appointmentTime", slot.startTime)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${bookingDraft.appointmentTime === slot.startTime ? "border-teal-500 bg-teal-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-teal-400"}`}
                    >
                      {slot.startTime} <span className="text-xs opacity-70">({slot.slotDurationMinutes}m)</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-2">
                  {selectedDoctor && bookingDraft.appointmentDate ? (
                    <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-[color:var(--muted)]">
                      No slots on {DAY_NAMES[new Date(bookingDraft.appointmentDate).getDay()]}. Try another date.
                    </p>
                  ) : (
                    <input type="time" value={bookingDraft.appointmentTime} onChange={(e) => updateField("appointmentTime", e.target.value)} className="w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" />
                  )}
                </div>
              )}
            </label>

            {/* Appointment type */}
            <label>
              <span className="text-sm font-semibold">Appointment type</span>
              <select value={bookingDraft.appointmentType} onChange={(e) => updateField("appointmentType", e.target.value)} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3">
                {appointmentTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold">Status</span>
              <select value={bookingDraft.status} onChange={(e) => updateField("status", e.target.value)} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3">
                {queueStatusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">Notes</span>
              <textarea rows={2} value={bookingDraft.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Any special instructions" className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => saveBooking(false)} className="focus-ring rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">Save appointment</button>
            <button type="button" onClick={() => saveBooking(true)} className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold">Save and issue consult link</button>
          </div>
          {saveMessage && <p className="mt-3 text-sm font-medium text-[color:#2f6f57]">{saveMessage}</p>}
          {issuedLink && <p className="mt-2 break-all text-xs text-[color:var(--muted)]">{issuedLink}</p>}
        </div>

        <div className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
          <h2 className="headline text-3xl font-semibold">Today's queue</h2>
          <div className="mt-4 space-y-3">
            {savedQueue.length ? savedQueue.map((item) => (
              <div key={item.id} className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-semibold">{item.patientName} · {item.patientPhone}</span>
                  <select value={item.status} onChange={(e) => updateQueueStatus(item.id, e.target.value)} className="rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-3 py-1 text-xs font-semibold outline-none">
                    {queueStatusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">{item.doctorName} · {`${item.appointmentDate || "today"} ${item.appointmentTime || ""}`.trim()}</div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-[rgba(21,32,43,0.14)] px-4 py-6 text-sm text-[color:var(--muted)]">
                {isLoadingQueue ? "Loading appointments…" : "No appointments yet."}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}


