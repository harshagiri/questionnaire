"use client";

import { useEffect, useState } from "react";
import { receptionistAppointmentFields } from "@/lib/workflow-data";
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

const queueStatusOptions = [
  { label: "Booked", value: "booked" },
  { label: "Waiting", value: "waiting" },
  { label: "Submitted", value: "submitted" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Follow-up", value: "follow_up" },
] as const;

export function ReceptionistWorkflow() {
  const [doctorOptions, setDoctorOptions] = useState<Array<{ label: string; value: string }>>([]);
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

  useEffect(() => {
    let active = true;

    async function loadDoctors() {
      try {
        const response = await fetch("/api/doctors", { cache: "no-store" });
        const payload = (await response.json()) as {
          ok: boolean;
          doctors?: Array<{ id: string; name: string; registrationNumber?: string }>;
        };

        if (!active || !response.ok || !payload.ok) {
          return;
        }

        const options = (payload.doctors ?? []).map((doctor) => ({
          label: doctor.registrationNumber
            ? `${doctor.name} (${doctor.registrationNumber})`
            : doctor.name,
          value: doctor.id,
        }));
        setDoctorOptions(options);
      } catch {
        if (active) {
          setDoctorOptions([]);
        }
      }
    }

    loadDoctors();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      try {
        const response = await fetch("/api/appointments", { cache: "no-store" });
        const payload = (await response.json()) as {
          ok: boolean;
          appointments?: QueueAppointment[];
        };

        if (!active || !response.ok || !payload.ok) {
          return;
        }

        setSavedQueue(payload.appointments ?? []);
      } catch {
        if (active) {
          setSavedQueue([]);
        }
      } finally {
        if (active) {
          setIsLoadingQueue(false);
        }
      }
    }

    loadAppointments();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveReceptionDraft({
      sessionId: "booking",
      ...bookingDraft,
      updatedAt: new Date().toISOString(),
    });
  }, [bookingDraft]);

  const updateBookingField = (field: string, value: string) => {
    setBookingDraft((current) => ({ ...current, [field]: value }));
    setSaveMessage("");
  };

  const saveBooking = async (issueLink = false) => {
    const doctorId = bookingDraft.doctorName.trim() || doctorOptions[0]?.value || "";

    if (!bookingDraft.patientName.trim() || !bookingDraft.patientPhone.trim() || !doctorId) {
      setSaveMessage("Fill patient name, phone, and doctor before saving.");
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

      setSavedQueue((current) => {
        const next = [responsePayload.appointment as QueueAppointment, ...current.filter((item) => item.id !== responsePayload.appointment?.id)];
        return next;
      });

      const consultLink = responsePayload.consultLink ?? `${window.location.origin}/access?role=patient&next=/patient/${sessionId}`;
      setIssuedLink(consultLink);
      setSaveMessage(issueLink ? "Appointment saved and consult link ready." : "Appointment saved.");

      if (issueLink && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(consultLink);
        setSaveMessage("Appointment saved and link copied to clipboard.");
      }
    } catch {
      setSaveMessage("Network error while saving appointment.");
    }
  };

  const updateQueueStatus = async (id: string, status: string) => {
    try {
      const response = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        appointment?: QueueAppointment;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.appointment) {
        setSaveMessage(payload.message ?? "Could not update appointment status.");
        return;
      }

      setSavedQueue((current) => current.map((item) => (item.id === id ? payload.appointment as QueueAppointment : item)));
      setSaveMessage("");
    } catch {
      setSaveMessage("Network error while updating appointment.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
          <h2 className="headline text-3xl font-semibold">Book appointment</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {receptionistAppointmentFields.map((field) => (
              <label key={field.id} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                <span className="text-sm font-semibold text-[color:var(--foreground)]">{field.label}</span>
                {field.type === "select" ? (
                  <select
                    value={field.id === "doctorName" ? bookingDraft[field.id] ?? doctorOptions[0]?.value ?? "" : bookingDraft[field.id] ?? ""}
                    onChange={(event) => updateBookingField(field.id, event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3"
                  >
                    {(field.id === "doctorName" ? doctorOptions : field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    {field.id === "doctorName" && doctorOptions.length === 0 ? (
                      <option>No doctors yet. Add from admin.</option>
                    ) : null}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={bookingDraft[field.id] ?? ""}
                    onChange={(event) => updateBookingField(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none"
                  />
                ) : (
                  <input
                    type={field.type}
                    value={bookingDraft[field.id] ?? ""}
                    onChange={(event) => updateBookingField(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none"
                  />
                )}
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => saveBooking(false)} className="focus-ring rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">Save appointment</button>
            <button type="button" onClick={() => saveBooking(true)} className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold">Save and issue consult link</button>
          </div>
          {saveMessage ? <p className="mt-3 text-sm font-medium text-[color:#2f6f57]">{saveMessage}</p> : null}
          {issuedLink ? <p className="mt-2 break-all text-xs text-[color:var(--muted)]">{issuedLink}</p> : null}
        </div>

        <div className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
          <h2 className="headline text-3xl font-semibold">Today’s queue</h2>
          <div className="mt-4 space-y-3">
            {savedQueue.length ? savedQueue.map((item) => (
              <div key={item.id} className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-semibold">{item.patientName}</span>
                  <select
                    value={item.status}
                    onChange={(event) => updateQueueStatus(item.id, event.target.value)}
                    className="rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-3 py-1 text-xs font-semibold outline-none"
                  >
                    {queueStatusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">{item.doctorName} · {`${item.appointmentDate || "today"} ${item.appointmentTime || ""}`.trim()}</div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-[rgba(21,32,43,0.14)] px-4 py-6 text-sm text-[color:var(--muted)]">
                {isLoadingQueue ? "Loading appointments..." : "No appointments yet."}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}