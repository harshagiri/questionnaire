"use client";

import { useEffect, useState } from "react";
import { formatDoctorDisplayName } from "@/lib/doctor-display";

type JourneyBookingContext = {
  consultId: string;
  doctorName: string;
  date: string;
  time: string;
  preConsultUrl: string;
  videoConsultUrl: string;
  phone?: string;
};

type AppointmentPayload = {
  consultId?: string;
  sessionId?: string;
  doctorName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  preConsultLink?: string;
  videoConsultLink?: string;
};

export function PatientJourneyConfirm({
  consultId,
  phone,
}: {
  consultId: string;
  phone: string;
}) {
  const [context, setContext] = useState<JourneyBookingContext | null>(null);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(`sei-patient-journey:${consultId}`);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as JourneyBookingContext;
            if (active) {
              setContext(parsed);
              return;
            }
          } catch {
            // Ignore malformed client snapshot and continue to API fallback.
          }
        }
      }

      const normalizedPhone = phone.replace(/\D/g, "");
      if (normalizedPhone.length < 10) {
        return;
      }

      try {
        const response = await fetch(`/api/appointments?phone=${encodeURIComponent(normalizedPhone)}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; appointments?: AppointmentPayload[] }
          | null;

        if (!active || !response.ok || !payload?.ok) {
          return;
        }

        const appointment = (payload.appointments ?? []).find(
          (item) => item.consultId === consultId || item.sessionId === consultId,
        );

        if (!appointment) {
          return;
        }

        setContext({
          consultId,
          doctorName: appointment.doctorName ?? "Doctor",
          date: appointment.appointmentDate ?? "",
          time: appointment.appointmentTime ?? "",
          preConsultUrl: appointment.preConsultLink ?? `${window.location.origin}/patient/consult/${consultId}`,
          videoConsultUrl: appointment.videoConsultLink ?? `https://meet.spinexpert.ai/consult/${consultId}`,
          phone: normalizedPhone,
        });
      } catch {
        // Keep fallback view when API data is unavailable.
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, [consultId, phone]);

  const summaryHref = `/patient/consult/${encodeURIComponent(consultId)}?phone=${encodeURIComponent(phone)}&journey=1&summary=1`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-blue-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Booking confirmed</p>
              <h1 className="text-xl font-bold text-gray-900">Appointment successfully booked</h1>
            </div>
          </div>

          <div className="rounded-xl bg-blue-700 p-4 text-white">
            <p className="text-xs text-blue-100">Consult ID</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{consultId}</p>
            {context ? (
              <p className="mt-1 text-xs text-blue-100">
                {formatDoctorDisplayName(context.doctorName)}{context.date ? ` · ${context.date}` : ""}{context.time ? ` at ${context.time}` : ""}
              </p>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800">Message sent to patient</p>
            <p className="mt-1 text-xs text-amber-700">
              Appointment details, pre-consult link, and consult ID have been sent to the patient phone and email.
            </p>
          </div>

          <a
            href={summaryHref}
            className="mt-5 block w-full rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white transition-colors hover:bg-blue-700"
          >
            View summary screen
          </a>

          <a
            href="/patient"
            className="mt-3 block w-full rounded-xl border border-gray-200 px-4 py-3 text-center font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
