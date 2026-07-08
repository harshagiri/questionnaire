"use client";

import { useEffect, useMemo, useState } from "react";
import { builderQuestionTypeCatalog, builderStarterQuestions, demoAppointments, receptionistAppointmentFields } from "@/lib/workflow-data";
import type { BuilderQuestionType, WorkflowQuestion } from "@/lib/workflow-data";
import type { ReceptionDraftRecord } from "@/lib/portal-storage";
import { createSessionId, listAppointments, loadReceptionDraft, saveAppointment, saveReceptionDraft } from "@/lib/portal-storage";

type BuilderDraft = WorkflowQuestion & {
  optionsText: string;
};

type BookingDraft = Omit<ReceptionDraftRecord, "sessionId" | "updatedAt"> & Record<string, string>;

const initialBuilderDraft: BuilderDraft = {
  id: "",
  label: "",
  type: "text",
  helpText: "",
  required: false,
  optionsText: "",
  linkedFrom: "",
  branchOn: "",
  branchValue: "",
};

function toOptions(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((item) => {
      const [label, value] = item.split("|").map((part) => part.trim());
      return { label: label || item, value: value || item.toLowerCase().replace(/\s+/g, "-") };
    });
}

export function ReceptionistWorkflow() {
  const [activeTab, setActiveTab] = useState<"appointments" | "builder" | "handoff">("appointments");
  const [builderQuestions, setBuilderQuestions] = useState<BuilderDraft[]>(builderStarterQuestions.map((question) => ({ ...question, optionsText: "" })));
  const [draft, setDraft] = useState<BuilderDraft>(initialBuilderDraft);
  const [doctorOptions, setDoctorOptions] = useState<Array<{ label: string; value: string }>>([]);
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
  const [savedQueue, setSavedQueue] = useState(() => listAppointments());

  useEffect(() => {
    let active = true;

    async function loadDoctors() {
      try {
        const response = await fetch("/api/doctors", { cache: "no-store" });
        const payload = (await response.json()) as {
          ok: boolean;
          doctors?: Array<{ name: string; registrationNumber?: string }>;
        };

        if (!active || !response.ok || !payload.ok) {
          return;
        }

        const options = (payload.doctors ?? []).map((doctor) => ({
          label: doctor.registrationNumber
            ? `${doctor.name} (${doctor.registrationNumber})`
            : doctor.name,
          value: doctor.name,
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
    saveReceptionDraft({
      sessionId: "booking",
      ...bookingDraft,
      updatedAt: new Date().toISOString(),
    });
  }, [bookingDraft]);

  const builderPreview = useMemo(
    () =>
      builderQuestions.map((question) => ({
        ...question,
        options: question.optionsText ? toOptions(question.optionsText) : question.options,
      })),
    [builderQuestions],
  );

  const addQuestion = () => {
    if (!draft.label.trim()) return;

    setBuilderQuestions((current) => [
      ...current,
      {
        ...draft,
        id: draft.id || draft.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        options: draft.optionsText ? toOptions(draft.optionsText) : draft.options,
      },
    ]);
    setDraft(initialBuilderDraft);
  };

  const updateBookingField = (field: string, value: string) => {
    setBookingDraft((current) => ({ ...current, [field]: value }));
    setSaveMessage("");
  };

  const saveBooking = async (issueLink = false) => {
    if (!bookingDraft.patientName.trim() || !bookingDraft.patientPhone.trim() || !bookingDraft.doctorName.trim()) {
      setSaveMessage("Fill patient name, phone, and doctor before saving.");
      return;
    }

    const sessionId = createSessionId(bookingDraft.patientName || bookingDraft.patientPhone);
    const now = new Date().toISOString();
    const record = {
      sessionId,
      patientName: bookingDraft.patientName.trim(),
      patientPhone: bookingDraft.patientPhone.trim(),
      doctorName: bookingDraft.doctorName.trim(),
      appointmentDate: bookingDraft.appointmentDate.trim(),
      appointmentTime: bookingDraft.appointmentTime.trim(),
      appointmentType: bookingDraft.appointmentType.trim() || "new",
      status: bookingDraft.status.trim() || "booked",
      notes: bookingDraft.notes.trim(),
      createdAt: now,
      updatedAt: now,
    };

    saveAppointment(record);
    setSavedQueue(listAppointments());
    setIssuedLink(`${window.location.origin}/access?role=patient&next=/patient/${sessionId}`);
    setSaveMessage(issueLink ? "Appointment saved and consult link ready." : "Appointment saved.");

    if (issueLink && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(`${window.location.origin}/access?role=patient&next=/patient/${sessionId}`);
      setSaveMessage("Appointment saved and link copied to clipboard.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[2rem] p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">Receptionist workspace</span>
            <h1 className="headline mt-4 text-4xl font-semibold sm:text-5xl">Appointment booking, patient handoff, and questionnaire builder</h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[color:var(--muted)]">
              Use this screen to book appointments, match patients to doctors, and build questionnaire templates with simple branching and linked question info.
            </p>
          </div>

          <div className="rounded-[1.75rem] bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Demo OTP popup</div>
            <div className="mt-2 text-4xl font-semibold tracking-[0.25em] text-[var(--accent)]">482931</div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">Copy this into the patient login popup when handing off the consultation link.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        {[
          { id: "appointments", label: "Appointments" },
          { id: "builder", label: "Questionnaire builder" },
          { id: "handoff", label: "Patient handoff" },
        ].map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as typeof activeTab)} className={`focus-ring rounded-full px-5 py-3 text-sm font-semibold ${activeTab === tab.id ? "bg-[var(--accent)] text-white" : "border border-[rgba(21,32,43,0.12)] bg-white"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "appointments" ? (
        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
            <h2 className="headline text-3xl font-semibold">Book appointment</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {receptionistAppointmentFields.map((field) => (
                <label key={field.id} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                  <span className="text-sm font-semibold text-[color:var(--foreground)]">{field.label}</span>
                  {field.type === "select" ? (
                    <select
                      value={bookingDraft[field.id] ?? ""}
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
              {(savedQueue.length ? savedQueue.map((item) => ({
                name: item.patientName,
                doctor: item.doctorName,
                slot: `${item.appointmentDate || "today"} ${item.appointmentTime || ""}`.trim(),
                status: item.status,
              })) : demoAppointments).map((item) => (
                <div key={`${item.name}-${item.slot}`} className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold">{item.name}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{item.status}</span>
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">{item.doctor} · {item.slot}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "builder" ? (
        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
            <h2 className="headline text-3xl font-semibold">Questionnaire builder</h2>
            <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">Add a question, link it to another question, and create a simple branch rule without a complicated editor.</p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold">Label</span>
                <input value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" placeholder="Question label" />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">Type</span>
                <select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as BuilderQuestionType }))} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 outline-none">
                  {builderQuestionTypeCatalog.map((type) => <option key={type.value} value={type.value}>{type.label} - {type.description}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold">Help text</span>
                <input value={draft.helpText ?? ""} onChange={(event) => setDraft((current) => ({ ...current, helpText: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" placeholder="Helpful note for patients" />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">Options, one per line</span>
                <textarea value={draft.optionsText} onChange={(event) => setDraft((current) => ({ ...current, optionsText: event.target.value }))} rows={4} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" placeholder="Option label | value" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold">Branch on question</span>
                  <select value={draft.branchOn ?? ""} onChange={(event) => setDraft((current) => ({ ...current, branchOn: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 outline-none">
                    <option value="">None</option>
                    {builderPreview.map((question) => <option key={question.id} value={question.id}>{question.label}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Branch value</span>
                  <input value={draft.branchValue ?? ""} onChange={(event) => setDraft((current) => ({ ...current, branchValue: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" placeholder="Show when answer equals..." />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-semibold">Link info from another question</span>
                  <select value={draft.linkedFrom ?? ""} onChange={(event) => setDraft((current) => ({ ...current, linkedFrom: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 outline-none">
                    <option value="">No linked info</option>
                    {builderPreview.map((question) => <option key={question.id} value={question.id}>{question.label}</option>)}
                  </select>
                </label>
              </div>

              <button onClick={addQuestion} className="focus-ring rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">Add question</button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
            <h2 className="headline text-3xl font-semibold">Preview and branching</h2>
            <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">The builder stays simple: select a question type, add options, link metadata, and define one conditional rule.</p>

            <div className="mt-5 space-y-3">
              {builderPreview.map((question, index) => (
                <div key={`${question.id}-${index}`} className="rounded-2xl border border-[rgba(21,32,43,0.08)] bg-[rgba(21,32,43,0.03)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                    <span>{index + 1}. {question.label || "Untitled question"}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs">{question.type}</span>
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--muted)]">
                    {question.linkedFrom ? `Linked info from ${question.linkedFrom}. ` : ""}
                    {question.branchOn ? `Branch when ${question.branchOn} = ${question.branchValue}.` : ""}
                  </div>
                  {question.options?.length ? <div className="mt-2 flex flex-wrap gap-2">{question.options.map((option) => <span key={option.value} className="rounded-full bg-white px-3 py-1 text-xs font-medium">{option.label}</span>)}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "handoff" ? (
        <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
            <h2 className="headline text-3xl font-semibold">Patient handoff</h2>
            <div className="mt-4 rounded-3xl bg-[rgba(15,118,110,0.06)] p-5 text-sm leading-7 text-[color:var(--foreground)]">
              Show the patient the OTP popup, then copy the code into the login flow to continue to the questionnaire. This is the placeholder for SMS / WhatsApp integration.
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                "Generate appointment link",
                "Show OTP popup",
                "Set doctor association",
                "Confirm consent",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-[rgba(21,32,43,0.08)] bg-white px-4 py-3 text-sm font-medium">{item}</div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
            <h2 className="headline text-3xl font-semibold">Builder shortcuts</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--muted)]">
              <div className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3">Add branching with a single rule: if answer equals value, show the next question or hide a follow-up.</div>
              <div className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3">Link a question to another question for auto-filled information or context reuse.</div>
              <div className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3">Keep the builder mobile-friendly with stacked cards and large touch targets.</div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}