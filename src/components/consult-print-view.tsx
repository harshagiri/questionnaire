"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { doctorQuestionnaireDefinition, summarizeAnswer } from "@/lib/questionnaire";
import { patientWorkflowSections, preConsultSections } from "@/lib/workflow-data";
import { formatDoctorDisplayName } from "@/lib/doctor-display";

type QuestionnaireAnswer = string | number | boolean | string[];
type AnswerMap = Record<string, QuestionnaireAnswer>;

type AppointmentRecord = {
  id: string;
  consultSessionId: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  status: string;
  notes: string;
};

type PatientProfileRecord = {
  age?: number | null;
  gender?: string | null;
  region?: string | null;
  preferredLanguage?: string | null;
};

type PrintData = {
  appointment: AppointmentRecord | null;
  patientAnswers: AnswerMap;
  doctorAnswers: AnswerMap;
  patientProfile: PatientProfileRecord | null;
};

function titleize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^q\d+\s*/i, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatValue(value: QuestionnaireAnswer | undefined) {
  if (typeof value === "undefined") {
    return "Not filled";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Not filled";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string") {
    return value.trim() || "Not filled";
  }

  return summarizeAnswer(value);
}

function buildLabelMap() {
  const map = new Map<string, string>();

  for (const section of preConsultSections) {
    for (const question of section.questions) {
      map.set(question.id, question.label);
    }
  }

  for (const section of patientWorkflowSections) {
    for (const question of section.questions) {
      map.set(question.id, question.label);
    }
  }

  for (const question of doctorQuestionnaireDefinition.questions) {
    map.set(question.id, question.label);
  }

  return map;
}

function groupPatientAnswers(answers: AnswerMap) {
  const answerKeys = new Set(Object.keys(answers));
  const candidates = [preConsultSections, patientWorkflowSections] as const;

  const best = candidates
    .map((sections) => {
      const sectionKeys = new Set(sections.flatMap((section) => section.questions.map((question) => question.id)));
      let matches = 0;
      for (const key of answerKeys) {
        if (sectionKeys.has(key)) {
          matches += 1;
        }
      }
      return { sections, matches };
    })
    .sort((a, b) => b.matches - a.matches)[0];

  const sections = best.matches > 0 ? best.sections : patientWorkflowSections;
  const sectionByQuestion = new Map<string, { id: string; title: string }>();

  for (const section of sections) {
    for (const question of section.questions) {
      sectionByQuestion.set(question.id, { id: section.id, title: section.title });
    }
  }

  const grouped = new Map<string, { id: string; title: string; keys: string[] }>();

  for (const key of Object.keys(answers)) {
    const sectionMeta = sectionByQuestion.get(key) ?? { id: "additional", title: "Additional details" };
    const existing = grouped.get(sectionMeta.id) ?? { id: sectionMeta.id, title: sectionMeta.title, keys: [] };
    existing.keys.push(key);
    grouped.set(sectionMeta.id, existing);
  }

  const orderedIds = [
    ...sections.map((section) => section.id),
    ...Array.from(grouped.keys()).filter((id) => !sections.some((section) => section.id === id)),
  ];

  return orderedIds
    .map((id) => grouped.get(id))
    .filter((item): item is { id: string; title: string; keys: string[] } => Boolean(item));
}

function groupDoctorAnswers(answers: AnswerMap) {
  const sectionByQuestion = new Map<string, { id: string; title: string }>();

  for (const question of doctorQuestionnaireDefinition.questions) {
    sectionByQuestion.set(question.id, {
      id: question.sectionId ?? "general",
      title: question.sectionTitle ?? "General",
    });
  }

  const grouped = new Map<string, { id: string; title: string; keys: string[] }>();

  for (const key of Object.keys(answers)) {
    const sectionMeta = sectionByQuestion.get(key) ?? { id: "additional", title: "Additional details" };
    const existing = grouped.get(sectionMeta.id) ?? { id: sectionMeta.id, title: sectionMeta.title, keys: [] };
    existing.keys.push(key);
    grouped.set(sectionMeta.id, existing);
  }

  const orderedSectionIds = [
    ...Array.from(new Set(doctorQuestionnaireDefinition.questions.map((question) => question.sectionId ?? "general"))),
    ...Array.from(grouped.keys()).filter((id) => !doctorQuestionnaireDefinition.questions.some((question) => (question.sectionId ?? "general") === id)),
  ];

  return orderedSectionIds
    .map((id) => grouped.get(id))
    .filter((item): item is { id: string; title: string; keys: string[] } => Boolean(item));
}

export function ConsultPrintView({ consultSessionId, role }: { consultSessionId: string; role: string }) {
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState("");
  const [printedAt, setPrintedAt] = useState("");
  const [printPending, setPrintPending] = useState(false);

  const labelMap = useMemo(() => buildLabelMap(), []);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [appointmentRes, patientRes, doctorRes] = await Promise.all([
          fetch(`/api/appointments?consultSessionId=${encodeURIComponent(consultSessionId)}`, { cache: "no-store" }),
          fetch(`/api/patient-intake?sessionId=${encodeURIComponent(consultSessionId)}`, { cache: "no-store" }),
          fetch(`/api/doctor-intake?consultSessionId=${encodeURIComponent(consultSessionId)}`, { cache: "no-store" }),
        ]);

        const appointmentPayload = (await appointmentRes.json().catch(() => null)) as
          | { ok?: boolean; appointments?: AppointmentRecord[] }
          | null;
        const patientPayload = (await patientRes.json().catch(() => null)) as
          | { ok?: boolean; record?: { answers?: AnswerMap } | null }
          | null;
        const doctorPayload = (await doctorRes.json().catch(() => null)) as
          | { ok?: boolean; record?: { answers?: AnswerMap } | null }
          | null;

        const appointment = appointmentPayload?.appointments?.[0] ?? null;

        let patientProfile: PatientProfileRecord | null = null;
        if (appointment?.patientPhone) {
          const profileRes = await fetch(`/api/patient-register?phone=${encodeURIComponent(appointment.patientPhone)}`, {
            cache: "no-store",
          });
          const profilePayload = (await profileRes.json().catch(() => null)) as
            | { ok?: boolean; record?: PatientProfileRecord | null }
            | null;

          if (profileRes.ok && profilePayload?.ok && profilePayload.record) {
            patientProfile = profilePayload.record;
          }
        }

        if (!active) {
          return;
        }

        setData({
          appointment,
          patientAnswers: patientPayload?.record?.answers ?? {},
          doctorAnswers: doctorPayload?.record?.answers ?? {},
          patientProfile,
        });
      } catch {
        if (!active) {
          return;
        }

        setError("Could not load consult summary for printing.");
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [consultSessionId]);

  const patientSections = useMemo(() => groupPatientAnswers(data?.patientAnswers ?? {}), [data?.patientAnswers]);
  const doctorSections = useMemo(() => groupDoctorAnswers(data?.doctorAnswers ?? {}), [data?.doctorAnswers]);

  useEffect(() => {
    setPrintedAt(new Date().toLocaleString());
  }, []);

  function handlePrint() {
    setPrintPending(true);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        setPrintPending(false);
      }, 600);
    }, 80);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 print:max-w-none print:p-0">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 16mm 12mm 14mm;
          }
          .print-hide {
            display: none !important;
          }
          .print-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
          }
          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
          }
          .print-content {
            margin-top: 86px;
            margin-bottom: 56px;
          }
        }
      `}</style>

      <div className="print-hide mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-4 py-2 text-sm font-semibold"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={printPending}
          className="focus-ring rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {printPending ? "Opening print dialog..." : "Print / Save PDF"}
        </button>
      </div>

      <header className="print-header rounded-xl border border-[rgba(21,32,43,0.16)] bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-[160px] overflow-hidden rounded-lg border border-[rgba(21,32,43,0.1)] bg-white p-1">
              <Image
                src="/logo.jpg"
                alt="SpinExperts India"
                fill
                sizes="160px"
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="headline text-xl font-semibold">Clinical Consultation Summary</h1>
              <p className="text-xs text-[color:var(--muted)]">SpinExperts India</p>
            </div>
          </div>
          <div className="text-right text-xs text-[color:var(--muted)]">
            <p>Consult ID: {consultSessionId}</p>
            <p>Printed by: {titleize(role)}</p>
            <p>Printed on: {printedAt || "--"}</p>
          </div>
        </div>
      </header>

      <section className="print-content space-y-4">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {!data ? (
          <div className="rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 text-sm text-[color:var(--muted)]">
            Loading consult details...
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-[rgba(21,32,43,0.12)] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">Patient and visit details</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[rgba(21,32,43,0.08)] px-3 py-2 text-sm"><span className="font-semibold">Patient name:</span> {data.appointment?.patientName || "Not captured"}</div>
                <div className="rounded-lg border border-[rgba(21,32,43,0.08)] px-3 py-2 text-sm"><span className="font-semibold">Phone:</span> {data.appointment?.patientPhone || "Not captured"}</div>
                <div className="rounded-lg border border-[rgba(21,32,43,0.08)] px-3 py-2 text-sm"><span className="font-semibold">Doctor:</span> {formatDoctorDisplayName(data.appointment?.doctorName) || "Not captured"}</div>
                <div className="rounded-lg border border-[rgba(21,32,43,0.08)] px-3 py-2 text-sm"><span className="font-semibold">Appointment:</span> {(data.appointment?.appointmentDate || "") + " " + (data.appointment?.appointmentTime || "")}</div>
                <div className="rounded-lg border border-[rgba(21,32,43,0.08)] px-3 py-2 text-sm"><span className="font-semibold">Type:</span> {titleize(data.appointment?.appointmentType || "Not captured")}</div>
                <div className="rounded-lg border border-[rgba(21,32,43,0.08)] px-3 py-2 text-sm"><span className="font-semibold">Status:</span> {titleize(data.appointment?.status || "Not captured")}</div>
                <div className="rounded-lg border border-[rgba(21,32,43,0.08)] px-3 py-2 text-sm"><span className="font-semibold">Age:</span> {data.patientProfile?.age ?? "Not captured"}</div>
                <div className="rounded-lg border border-[rgba(21,32,43,0.08)] px-3 py-2 text-sm"><span className="font-semibold">Gender:</span> {data.patientProfile?.gender ? titleize(data.patientProfile.gender) : "Not captured"}</div>
                <div className="rounded-lg border border-[rgba(21,32,43,0.08)] px-3 py-2 text-sm"><span className="font-semibold">Region/City:</span> {data.patientProfile?.region || "Not captured"}</div>
                <div className="rounded-lg border border-[rgba(21,32,43,0.08)] px-3 py-2 text-sm"><span className="font-semibold">Language:</span> {data.patientProfile?.preferredLanguage || "Not captured"}</div>
              </div>
            </section>

            <section className="rounded-xl border border-[rgba(21,32,43,0.12)] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">Patient questionnaire details</h2>
              {patientSections.length === 0 ? (
                <p className="mt-3 text-sm text-[color:var(--muted)]">No patient questionnaire details captured.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {patientSections.map((section) => (
                    <article key={section.id} className="overflow-hidden rounded-lg border border-[rgba(21,32,43,0.08)]">
                      <div className="border-b border-[rgba(21,32,43,0.08)] bg-[rgba(248,245,240,0.72)] px-3 py-2 text-sm font-semibold">{section.title}</div>
                      <div>
                        {section.keys.map((key) => (
                          <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-[rgba(21,32,43,0.06)] px-3 py-2 text-sm last:border-b-0">
                            <div className="font-medium">{labelMap.get(key) ?? titleize(key)}</div>
                            <div className="text-[color:var(--muted)]">{formatValue(data.patientAnswers[key])}</div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[rgba(21,32,43,0.12)] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">Doctor consultation form details</h2>
              {doctorSections.length === 0 ? (
                <p className="mt-3 text-sm text-[color:var(--muted)]">No doctor consultation details captured.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {doctorSections.map((section) => (
                    <article key={section.id} className="overflow-hidden rounded-lg border border-[rgba(21,32,43,0.08)]">
                      <div className="border-b border-[rgba(21,32,43,0.08)] bg-[rgba(248,245,240,0.72)] px-3 py-2 text-sm font-semibold">{section.title}</div>
                      <div>
                        {section.keys.map((key) => (
                          <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-[rgba(21,32,43,0.06)] px-3 py-2 text-sm last:border-b-0">
                            <div className="font-medium">{labelMap.get(key) ?? titleize(key)}</div>
                            <div className="text-[color:var(--muted)]">{formatValue(data.doctorAnswers[key])}</div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>

      <footer className="print-footer rounded-xl border border-[rgba(21,32,43,0.16)] bg-white px-4 py-2 text-[11px] text-[color:var(--muted)]">
        <div className="flex items-center justify-between gap-3">
          <span>SpinExperts India · Expert care. Every spine. Every time. · Confidential Clinical Document</span>
          <span>Doctor Signature: ____________________</span>
        </div>
      </footer>
    </main>
  );
}
