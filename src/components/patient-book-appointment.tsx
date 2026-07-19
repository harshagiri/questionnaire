"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateConsultId, findPatientRecordByPhone, saveAppointment } from "@/lib/portal-storage";
import { formatDoctorDisplayName, formatDoctorOptionLabel } from "@/lib/doctor-display";

type DoctorSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  slotDurationMinutes: number;
};

type DoctorOption = { label: string; value: string; name: string; registrationNumber?: string; slots: DoctorSlot[] };

type BookingForm = {
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  notes: string;
};

type BookedResult = {
  consultId: string;
  appointmentId: string;
  doctorName: string;
  date: string;
  time: string;
  preConsultUrl: string;
  videoConsultUrl: string;
};

const APPOINTMENT_TYPES = [
  { label: "New consultation", value: "new" },
  { label: "Follow-up", value: "follow-up" },
  { label: "Teleconsult (video)", value: "teleconsult" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatSlotLabel(slot: DoctorSlot) {
  return `${slot.startTime} (${slot.slotDurationMinutes}m)`;
}

function ConfirmationScreen({ result, onDone }: { result: BookedResult; onDone: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 mb-4">
            <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Appointment booked!</h1>
          <p className="text-gray-500 mt-1 text-sm">{formatDoctorDisplayName(result.doctorName)} · {result.date} at {result.time}</p>
        </div>

        {/* Consult ID */}
        <div className="bg-teal-700 text-white rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-teal-200 mb-1">Your consult ID</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold tracking-widest">{result.consultId}</span>
            <button onClick={() => copy(result.consultId, "cid")} className="text-teal-200 text-xs hover:text-white">
              {copied === "cid" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Simulated notification notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex gap-2 items-start">
          <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2v-3H6v3a2 2 0 002 2zm10-12V7a6 6 0 00-12 0v2H4l1 9h14l1-9h-2z" />
          </svg>
          <p className="text-xs text-amber-700">
            Pre-consult link and appointment details sent to your registered phone and email.
          </p>
        </div>

        {/* Pre-consult link */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Step 1 — Fill your pre-consult questionnaire</p>
          <p className="text-xs font-mono text-gray-500 bg-gray-50 rounded-lg p-2 mb-3 break-all">{result.preConsultUrl}</p>
          <div className="flex gap-2">
            <a
              href={result.preConsultUrl}
              className="flex-1 text-center bg-teal-600 text-white text-sm font-semibold py-2.5 px-4 rounded-lg hover:bg-teal-700 transition-colors"
            >
              Fill now
            </a>
            <button
              onClick={() => copy(result.preConsultUrl, "pre")}
              className="px-3 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copied === "pre" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Upload link */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Step 2 — Upload your lab reports / MRI films (optional)</p>
          <a
            href={`/patient/upload/${result.consultId}`}
            className="block w-full text-center border border-teal-600 text-teal-600 text-sm font-semibold py-2.5 px-4 rounded-lg hover:bg-teal-50 transition-colors"
          >
            Upload reports
          </a>
        </div>

        {/* Video consult link */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-gray-500 mb-1">Video consult link (active after pre-consult submitted)</p>
          <p className="text-xs font-mono text-gray-400 mb-2 break-all">{result.videoConsultUrl}</p>
          <button
            onClick={() => copy(result.videoConsultUrl, "video")}
            className="w-full border border-gray-200 text-xs text-gray-500 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied === "video" ? "Copied!" : "Copy video link"}
          </button>
        </div>

        <button
          onClick={onDone}
          className="w-full bg-gray-100 text-gray-700 font-semibold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors"
        >
          Back to my appointments
        </button>
      </div>
    </div>
  );
}

export function PatientBookAppointment({ phone }: { phone: string }) {
  const router = useRouter();
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [form, setForm] = useState<BookingForm>({
    doctorId: "",
    doctorName: "",
    appointmentDate: "",
    appointmentTime: "",
    appointmentType: "new",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<BookedResult | null>(null);

  const patientRecord = findPatientRecordByPhone(phone);
  const selectedDoctor = useMemo(
    () => doctorOptions.find((doctor) => doctor.value === form.doctorId) ?? null,
    [doctorOptions, form.doctorId],
  );
  const selectedDateDay = form.appointmentDate ? new Date(form.appointmentDate).getDay() : null;
  const availableSlots = useMemo(() => {
    if (!selectedDoctor) {
      return [] as DoctorSlot[];
    }

    if (selectedDateDay === null || Number.isNaN(selectedDateDay)) {
      return selectedDoctor.slots;
    }

    return selectedDoctor.slots.filter((slot) => slot.dayOfWeek === selectedDateDay);
  }, [selectedDateDay, selectedDoctor]);

  useEffect(() => {
    async function loadDoctors() {
      try {
        const res = await fetch("/api/doctors?withSlots=true", { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          doctors?: Array<{
            id: string;
            name: string;
            registrationNumber?: string;
            slots?: DoctorSlot[];
          }>;
        };
        if (res.ok && data.ok) {
          setDoctorOptions(
            (data.doctors ?? []).map((d) => ({
              label: formatDoctorOptionLabel(d.name, d.registrationNumber),
              value: d.id,
              name: d.name,
              registrationNumber: d.registrationNumber,
              slots: d.slots ?? [],
            })),
          );
        }
      } catch {
        setDoctorOptions([]);
      }
    }
    loadDoctors();
  }, []);

  function setField(key: keyof BookingForm, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "doctorId") {
        const opt = doctorOptions.find((d) => d.value === value);
        next.doctorName = opt?.label ?? "";
        next.appointmentTime = "";
      }
      if (key === "appointmentDate") {
        next.appointmentTime = "";
      }
      return next;
    });
  }

  function canSubmit() {
    if (!form.doctorId || !form.appointmentDate || !form.appointmentTime || !form.appointmentType) {
      return false;
    }

    return availableSlots.some((slot) => slot.startTime === form.appointmentTime);
  }

  async function handleBook() {
    setError("");
    setSubmitting(true);
    try {
      const patientName = patientRecord?.fullName ?? phone;
      if (!canSubmit()) {
        setError("Choose one of the doctor's available time slots.");
        return;
      }
      const consultId = generateConsultId();
      const origin = window.location.origin;
      const preConsultUrl = `${origin}/patient/consult/${consultId}`;
      const videoConsultUrl = `https://meet.spinexpert.ai/consult/${consultId}`;

      const body = {
        patientName,
        patientPhone: phone,
        doctorId: form.doctorId,
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        appointmentType: form.appointmentType,
        consultSessionId: consultId,
        consultId,
        videoConsultLink: videoConsultUrl,
        preConsultLink: preConsultUrl,
        status: "booked",
        notes: form.notes || "",
      };

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await res.json()) as { ok?: boolean; appointment?: { id?: string }; message?: string };

      if (!res.ok || !payload.ok) {
        // Save locally as fallback
        const now = new Date().toISOString();
        saveAppointment({
          sessionId: consultId,
          consultId,
          patientRecordId: patientRecord?.patientId,
          patientName,
          patientPhone: phone,
          doctorName: form.doctorName,
          doctorId: form.doctorId,
          appointmentDate: form.appointmentDate,
          appointmentTime: form.appointmentTime,
          appointmentType: form.appointmentType,
          status: "booked",
          notes: form.notes,
          videoConsultLink: videoConsultUrl,
          preConsultLink: preConsultUrl,
          createdAt: now,
          updatedAt: now,
        });
      }

      setBooked({
        consultId,
        appointmentId: payload.appointment?.id ?? consultId,
        doctorName: form.doctorName,
        date: form.appointmentDate,
        time: form.appointmentTime,
        preConsultUrl,
        videoConsultUrl,
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (booked) {
    return <ConfirmationScreen result={booked} onDone={() => router.push("/patient")} />;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/patient")} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Book an appointment</h1>
        </div>

        {/* Patient info summary */}
        {patientRecord && (
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold">
              {patientRecord.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{patientRecord.fullName}</p>
              <p className="text-xs text-teal-600 font-mono">{patientRecord.patientId}</p>
            </div>
          </div>
        )}

        <div className="space-y-5 bg-white rounded-2xl border border-gray-200 p-5">
          {/* Doctor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select doctor <span className="text-red-500">*</span></label>
            <select
              value={form.doctorId}
              onChange={(e) => setField("doctorId", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Choose a doctor…</option>
              {doctorOptions.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Appointment date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.appointmentDate}
              min={today}
              onChange={(e) => setField("appointmentDate", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time slot <span className="text-red-500">*</span></label>
            {!form.doctorId ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                Select a doctor first to see their availability.
              </p>
            ) : form.appointmentDate ? (
              availableSlots.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setField("appointmentTime", slot.startTime)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${form.appointmentTime === slot.startTime ? "border-teal-600 bg-teal-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-teal-400"}`}
                    >
                      <span className="block text-sm font-semibold">{formatSlotLabel(slot)}</span>
                      <span className={`block mt-0.5 ${form.appointmentTime === slot.startTime ? "text-teal-50" : "text-gray-500"}`}>
                        {DAY_NAMES[selectedDateDay ?? 0]}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                  No slots are configured for {formatDoctorDisplayName(selectedDoctor?.name ?? "") || "this doctor"} on {DAY_NAMES[selectedDateDay ?? 0]}.
                </p>
              )
            ) : (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                Choose an appointment date to load the doctor's available slots.
              </p>
            )}
          </div>

          {/* Appointment type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Appointment type <span className="text-red-500">*</span></label>
            <div className="space-y-2">
              {APPOINTMENT_TYPES.map((type) => (
                <label key={type.value} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${form.appointmentType === type.value ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input
                    type="radio"
                    name="appointmentType"
                    value={type.value}
                    checked={form.appointmentType === type.value}
                    onChange={() => setField("appointmentType", type.value)}
                    className="h-4 w-4 text-teal-600"
                  />
                  <span className="text-sm text-gray-700">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={2}
              placeholder="Any specific concerns or requests…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={handleBook}
          disabled={!canSubmit() || submitting}
          className="w-full mt-6 bg-teal-600 text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Booking…" : "Confirm appointment"}
        </button>
      </div>
    </div>
  );
}
