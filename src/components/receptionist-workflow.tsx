"use client";

import { useEffect, useState, type MouseEvent } from "react";
import type { ReceptionDraftRecord } from "@/lib/portal-storage";
import type { PromDisplaySummary } from "@/lib/prom-scoring";
import { createSessionId, loadReceptionDraft, saveReceptionDraft } from "@/lib/portal-storage";
import { formatDoctorDisplayName, formatDoctorOptionLabel } from "@/lib/doctor-display";

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
  promSummary?: PromDisplaySummary;
  createdAt: string;
  updatedAt: string;
};

type DoctorWithSlots = {
  id: string;
  name: string;
  registrationNumber?: string;
  slots: Array<{ id: string; dayOfWeek: number; startTime: string; slotDurationMinutes: number }>;
};

type AccessCodePreview = {
  code: string;
  expiresAt: string;
  minutesRemaining: number;
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

function formatPromSummary(summary?: PromDisplaySummary) {
  if (!summary) {
    return "PROM: Not scored";
  }

  return `PROM: ${summary.instrument} ${summary.percent.toFixed(1)}% (${summary.severity})`;
}

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
  const [accessCodesByPhone, setAccessCodesByPhone] = useState<Record<string, AccessCodePreview>>({});
  const [accessCodeLoading, setAccessCodeLoading] = useState<Record<string, boolean>>({});
  const [accessCodeMessageByPhone, setAccessCodeMessageByPhone] = useState<Record<string, string>>({});
  const [selectedQueueCardId, setSelectedQueueCardId] = useState<string | null>(null);

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

  useEffect(() => {
    const phones = Array.from(
      new Set(savedQueue.map((item) => item.patientPhone.replace(/\D/g, "")).filter((value) => value.length > 0)),
    );

    phones.forEach((phone) => {
      if (accessCodesByPhone[phone] || accessCodeLoading[phone]) {
        return;
      }

      void loadAccessCode(phone, false);
    });
  }, [savedQueue, accessCodesByPhone, accessCodeLoading]);

  useEffect(() => {
    if (!selectedQueueCardId) {
      return;
    }

    if (!savedQueue.some((item) => item.id === selectedQueueCardId)) {
      setSelectedQueueCardId(null);
    }
  }, [savedQueue, selectedQueueCardId]);

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

  const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

  const loadAccessCode = async (phone: string, rotate = false) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return;
    }

    setAccessCodeLoading((current) => ({ ...current, [normalizedPhone]: true }));
    setAccessCodeMessageByPhone((current) => ({ ...current, [normalizedPhone]: "" }));

    try {
      const response = await fetch(
        rotate ? "/api/patient-access-code" : `/api/patient-access-code?phone=${encodeURIComponent(normalizedPhone)}`,
        rotate
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: normalizedPhone, rotate: true }),
            }
          : { cache: "no-store" },
      );

      const payload = (await response.json()) as {
        ok?: boolean;
        code?: string;
        expiresAt?: string;
        minutesRemaining?: number;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.code || !payload.expiresAt) {
        setAccessCodeMessageByPhone((current) => ({
          ...current,
          [normalizedPhone]: payload.message ?? "Could not load access code.",
        }));
        return;
      }

      setAccessCodesByPhone((current) => ({
        ...current,
        [normalizedPhone]: {
          code: payload.code as string,
          expiresAt: payload.expiresAt as string,
          minutesRemaining: Number(payload.minutesRemaining ?? 0),
        },
      }));
      setAccessCodeMessageByPhone((current) => ({
        ...current,
        [normalizedPhone]: rotate ? "Access code rotated." : "Access code ready.",
      }));
    } catch {
      setAccessCodeMessageByPhone((current) => ({
        ...current,
        [normalizedPhone]: "Network error while loading access code.",
      }));
    } finally {
      setAccessCodeLoading((current) => ({ ...current, [normalizedPhone]: false }));
    }
  };

  const selectedQueueItem = selectedQueueCardId
    ? savedQueue.find((item) => item.id === selectedQueueCardId) ?? null
    : null;
  const selectedPhone = selectedQueueItem ? normalizePhone(selectedQueueItem.patientPhone) : "";
  const selectedAccessCode = selectedPhone ? accessCodesByPhone[selectedPhone] : undefined;
  const selectedAccessCodeLoading = selectedPhone ? accessCodeLoading[selectedPhone] : false;
  const selectedAccessCodeMessage = selectedPhone ? accessCodeMessageByPhone[selectedPhone] : "";

  const handleQueueCardSelection = (event: MouseEvent<HTMLDivElement>, id: string) => {
    const target = event.target as HTMLElement;
    if (target.closest("button,select,a,input,textarea,label")) {
      return;
    }

    setSelectedQueueCardId(id);
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
                  <option key={d.id} value={d.id}>{formatDoctorOptionLabel(d.name, d.registrationNumber)}</option>
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
              <div
                key={item.id}
                className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3 cursor-pointer sm:cursor-default"
                onClick={(event) => handleQueueCardSelection(event, item.id)}
              >
                {(() => {
                  const normalizedPhone = normalizePhone(item.patientPhone);
                  const accessCode = accessCodesByPhone[normalizedPhone];
                  const isLoadingCode = accessCodeLoading[normalizedPhone];
                  const codeMessage = accessCodeMessageByPhone[normalizedPhone];

                  return (
                    <>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-semibold">{item.patientName} · {item.patientPhone}</span>
                  <div className="rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3 py-1 text-[11px] font-semibold text-[color:var(--muted)] sm:hidden">
                    Tap for actions
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={() => window.open(`/print/consult/${encodeURIComponent(item.consultSessionId)}`, "_blank", "noopener,noreferrer")}
                      className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)]"
                    >
                      Print
                    </button>
                    <select value={item.status} onChange={(e) => updateQueueStatus(item.id, e.target.value)} className="rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-3 py-1 text-xs font-semibold outline-none">
                      {queueStatusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">{formatDoctorDisplayName(item.doctorName)} · {`${item.appointmentDate || "today"} ${item.appointmentTime || ""}`.trim()}</div>
                <div className="mt-1 text-xs font-semibold text-[color:var(--accent)]">{formatPromSummary(item.promSummary)}</div>
                <div className="mt-2 hidden rounded-xl border border-[rgba(21,32,43,0.1)] bg-white px-3 py-2 sm:block">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-[color:var(--muted)]">Patient access code</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => loadAccessCode(item.patientPhone, false)}
                        disabled={Boolean(isLoadingCode)}
                        className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                      >
                        {isLoadingCode ? "Loading..." : accessCode ? "Refresh" : "Reveal"}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadAccessCode(item.patientPhone, true)}
                        disabled={Boolean(isLoadingCode)}
                        className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                  {accessCode ? (
                    <div className="mt-1 text-xs">
                      <span className="font-semibold tracking-[0.2em] text-[var(--accent)]">{accessCode.code}</span>
                      <span className="ml-2 text-[color:var(--muted)]">expires in {accessCode.minutesRemaining} min</span>
                    </div>
                  ) : null}
                  {codeMessage ? <div className="mt-1 text-[11px] text-[color:var(--muted)]">{codeMessage}</div> : null}
                </div>
                    </>
                  );
                })()}
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-[rgba(21,32,43,0.14)] px-4 py-6 text-sm text-[color:var(--muted)]">
                {isLoadingQueue ? "Loading appointments…" : "No appointments yet."}
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedQueueItem ? (
        <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true" aria-label="Queue actions">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedQueueCardId(null)}
            aria-label="Close actions"
          />
          <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-white p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.2)]">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[rgba(21,32,43,0.18)]" />
            <div className="text-sm font-semibold">{selectedQueueItem.patientName} · {selectedQueueItem.patientPhone}</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">{formatDoctorDisplayName(selectedQueueItem.doctorName)} · {`${selectedQueueItem.appointmentDate || "today"} ${selectedQueueItem.appointmentTime || ""}`.trim()}</div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => window.open(`/print/consult/${encodeURIComponent(selectedQueueItem.consultSessionId)}`, "_blank", "noopener,noreferrer")}
                className="focus-ring rounded-xl border border-[rgba(21,32,43,0.14)] bg-white px-3 py-2 text-sm font-semibold text-[var(--accent)]"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setSelectedQueueCardId(null)}
                className="focus-ring rounded-xl border border-[rgba(21,32,43,0.14)] bg-white px-3 py-2 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-[color:var(--muted)]">Status</label>
              <select
                value={selectedQueueItem.status}
                onChange={(event) => updateQueueStatus(selectedQueueItem.id, event.target.value)}
                className="mt-1 w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2 text-sm font-semibold outline-none"
              >
                {queueStatusOptions.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 rounded-xl border border-[rgba(21,32,43,0.1)] bg-[rgba(21,32,43,0.02)] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-[color:var(--muted)]">Patient access code</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadAccessCode(selectedQueueItem.patientPhone, false)}
                    disabled={Boolean(selectedAccessCodeLoading)}
                    className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                  >
                    {selectedAccessCodeLoading ? "Loading..." : selectedAccessCode ? "Refresh" : "Reveal"}
                  </button>
                  <button
                    type="button"
                    onClick={() => loadAccessCode(selectedQueueItem.patientPhone, true)}
                    disabled={Boolean(selectedAccessCodeLoading)}
                    className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
              {selectedAccessCode ? (
                <div className="mt-1 text-xs">
                  <span className="font-semibold tracking-[0.2em] text-[var(--accent)]">{selectedAccessCode.code}</span>
                  <span className="ml-2 text-[color:var(--muted)]">expires in {selectedAccessCode.minutesRemaining} min</span>
                </div>
              ) : null}
              {selectedAccessCodeMessage ? <div className="mt-1 text-[11px] text-[color:var(--muted)]">{selectedAccessCodeMessage}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


