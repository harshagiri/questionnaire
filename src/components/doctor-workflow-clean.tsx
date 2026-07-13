"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateBmi,
  doctorQuestionnaireDefinition,
  summarizeAnswer,
  type QuestionnaireDefinition,
} from "@/lib/questionnaire";
import { QuestionnaireFlow } from "@/components/questionnaire-flow";
import { patientWorkflowSections } from "@/lib/workflow-data";

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

type QuestionnaireAnswer = string | number | boolean | string[];
type IntakeRecord = { sessionId: string; answers?: Record<string, QuestionnaireAnswer> };

type DoctorPatient = {
  id: string;
  consultSessionId: string;
  name: string;
  patientId: string;
  phone: string;
  age: string;
  sex: string;
  answers: Record<string, QuestionnaireAnswer>;
  appointmentDate: string;
  appointmentTime: string;
  consultationType: string;
  summary: string;
  bmi: string;
  painScore: string;
  mriAvailable: string;
  status: string;
};

const appointmentTypeLabels: Record<string, string> = {
  new: "New consult",
  "follow-up": "Follow-up",
  teleconsult: "Teleconsult",
  "walk-in": "Walk-in",
  questionnaire: "Intake draft",
};

const genderLabels: Record<string, string> = {
  female: "Female",
  male: "Male",
  "non-binary": "Non-binary",
  "prefer-not-to-say": "Prefer not to say",
};

function titleize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusLabel(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === "follow_up") {
    return "Follow up";
  }

  return titleize(normalized);
}

function formatMaybeLabel(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string" && value.trim()) {
    return titleize(value);
  }

  return "Not captured";
}

function formatPainScore(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "Not captured";
}

function calculatePatientScore(value: unknown) {
  const numericValue =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number.parseFloat(value)
        : Number.NaN;

  if (Number.isNaN(numericValue)) {
    return "Not captured";
  }

  return String(Math.max(0, Math.min(100, Math.round(100 - numericValue * 5))));
}

function formatChoice(value: unknown, labels?: Record<string, string>) {
  if (typeof value === "string" && labels?.[value]) {
    return labels[value];
  }

  return summarizeAnswer(value as string | number | boolean | string[] | undefined);
}

function formatMriValue(answers: Record<string, QuestionnaireAnswer>) {
  const mriAvailability = answers.mriAvailability;
  if (typeof mriAvailability === "string" && mriAvailability.trim()) {
    return formatChoice(mriAvailability, {
      "report-only": "MRI report only",
      "images-and-report": "MRI images and report",
      none: "No MRI yet",
    });
  }

  const reportsWithPatient = answers.reportsWithPatient;
  if (Array.isArray(reportsWithPatient) && (reportsWithPatient.includes("mri-images") || reportsWithPatient.includes("mri-report"))) {
    return "MRI available";
  }

  return "Not captured";
}

function getCurrentDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function loadAppointments(date?: string) {
  const url = date ? `/api/appointments?date=${encodeURIComponent(date)}` : "/api/appointments";
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as { ok?: boolean; appointments?: AppointmentRecord[]; message?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? "Could not load appointments");
  }

  return payload.appointments ?? [];
}

async function loadIntakeBySession(sessionId: string) {
  try {
    const response = await fetch(`/api/patient-intake?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    const payload = (await response.json()) as { ok?: boolean; record?: IntakeRecord | null };

    if (!response.ok || !payload.ok) {
      return null;
    }

    return payload.record ?? null;
  } catch {
    return null;
  }
}

async function loadDoctorQueue() {
  const todayAppointments = await loadAppointments(getCurrentDateKey());
  const appointments = todayAppointments;

  return Promise.all(
    appointments.map(async (appointment) => {
      const intake = await loadIntakeBySession(appointment.consultSessionId || appointment.id);
      const sessionId = appointment.consultSessionId || appointment.id;
      const answers = intake?.answers && Object.keys(intake.answers).length > 0 ? intake.answers : {};
      const patientName = String(answers.patientName ?? appointment.patientName ?? "Patient").trim() || "Patient";
      const phone = String(answers.phone ?? appointment.patientPhone ?? "").replace(/\D/g, "") || appointment.patientPhone;
      const bmiValue = calculateBmi(Number(answers.weightKg), Number(answers.heightCm));

      return {
        id: appointment.id,
        consultSessionId: sessionId,
        name: patientName,
        patientId: sessionId,
        phone,
        age: formatMaybeLabel(answers.age),
        sex: formatChoice(answers.gender, genderLabels),
        answers,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        consultationType: appointmentTypeLabels[appointment.appointmentType] ?? titleize(appointment.appointmentType),
        summary: String(answers.mainConcern ?? answers.symptomFocus ?? appointment.notes ?? "").trim() || "Pending intake",
        bmi: bmiValue === null ? "Not captured" : bmiValue.toFixed(1),
        painScore: formatPainScore(answers.painScore),
        mriAvailable: formatMriValue(answers),
        status: titleize(appointment.status),
      } satisfies DoctorPatient;
    }),
  );
}

async function loadDoctorQuestionnaireDefinition() {
  const response = await fetch("/api/doctor-questionnaire", { cache: "no-store" });
  const payload = (await response.json()) as {
    ok?: boolean;
    questionnaire?: { definition?: QuestionnaireDefinition };
  };

  if (!response.ok || !payload.ok || !payload.questionnaire?.definition) {
    return doctorQuestionnaireDefinition;
  }

  return payload.questionnaire.definition;
}

export function DoctorWorkflow() {
  const [todayPatients, setTodayPatients] = useState<DoctorPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"patient-details" | "doctor">("patient-details");
  const [doctorDefinition, setDoctorDefinition] = useState<QuestionnaireDefinition>(doctorQuestionnaireDefinition);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [patientsError, setPatientsError] = useState("");

  const selectedPatient = useMemo(
    () => (selectedPatientId ? todayPatients.find((item) => item.id === selectedPatientId) ?? null : null),
    [selectedPatientId, todayPatients],
  );

  const groupedQueue = useMemo(() => {
    const groups = new Map<string, DoctorPatient[]>();

    for (const patient of todayPatients) {
      const key = statusLabel(patient.status);
      const list = groups.get(key) ?? [];
      list.push(patient);
      groups.set(key, list);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [todayPatients]);

  const patientQuestionMap = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        optionLabelByValue: Map<string, string>;
      }
    >();

    for (const section of patientWorkflowSections) {
      for (const question of section.questions) {
        map.set(question.id, {
          label: question.label,
          optionLabelByValue: new Map((question.options ?? []).map((option) => [option.value, option.label])),
        });
      }
    }

    return map;
  }, []);

  const patientReadOnlyRows = useMemo(() => {
    if (!selectedPatient) {
      return [] as Array<{ key: string; label: string; value: string }>;
    }

    const answerKeys = new Set(Object.keys(selectedPatient.answers));
    const orderedKeys = patientWorkflowSections
      .flatMap((section) => section.questions.map((question) => question.id))
      .filter((key) => answerKeys.has(key));
    const unorderedKeys = Array.from(answerKeys).filter((key) => !orderedKeys.includes(key));

    return [...orderedKeys, ...unorderedKeys]
      .map((key) => {
        const value = selectedPatient.answers[key];

        if (Array.isArray(value) && value.length === 0) {
          return null;
        }

        if (typeof value === "string" && value.trim().length === 0) {
          return null;
        }

        if (typeof value === "number" && !Number.isFinite(value)) {
          return null;
        }

        if (typeof value === "undefined") {
          return null;
        }

        const questionMeta = patientQuestionMap.get(key);
        const label = questionMeta?.label ?? titleize(key);

        if (Array.isArray(value)) {
          const mapped = value.map((entry) => questionMeta?.optionLabelByValue.get(entry) ?? entry);
          return { key, label, value: mapped.join(", ") || "Not filled" };
        }

        if (typeof value === "string") {
          return { key, label, value: questionMeta?.optionLabelByValue.get(value) ?? value };
        }

        return { key, label, value: summarizeAnswer(value) };
      })
      .filter((row): row is { key: string; label: string; value: string } => row !== null);
  }, [patientQuestionMap, selectedPatient]);

  useEffect(() => {
    let active = true;

    async function loadPatients() {
      setIsLoadingPatients(true);
      setPatientsError("");

      try {
        const patients = await loadDoctorQueue();

        if (!active) {
          return;
        }

        setTodayPatients(patients);
        setSelectedPatientId((current) => {
          if (!current) {
            return null;
          }

          const stillPresent = patients.some((item) => item.id === current);
          return stillPresent ? current : null;
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setTodayPatients([]);
        setPatientsError(error instanceof Error ? error.message : "Could not load today's patients");
      } finally {
        if (active) {
          setIsLoadingPatients(false);
        }
      }
    }

    loadPatients();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDefinition() {
      try {
        const definition = await loadDoctorQuestionnaireDefinition();
        if (active) {
          setDoctorDefinition(definition);
        }
      } catch {
        if (active) {
          setDoctorDefinition(doctorQuestionnaireDefinition);
        }
      }
    }

    loadDefinition();

    return () => {
      active = false;
    };
  }, []);

  const doctorSaveContext = useMemo(
    () => ({
      consultSessionId: selectedPatient?.consultSessionId ?? null,
      patientName: selectedPatient?.name ?? null,
      patientPhone: selectedPatient?.phone ?? null,
      appointmentTime: selectedPatient?.appointmentTime ?? null,
      appointmentType: selectedPatient?.consultationType ?? null,
      appointmentStatus: selectedPatient?.status ?? null,
    }),
    [
      selectedPatient?.appointmentTime,
      selectedPatient?.consultSessionId,
      selectedPatient?.consultationType,
      selectedPatient?.name,
      selectedPatient?.phone,
      selectedPatient?.status,
    ],
  );

  const doctorLoadApiPath = selectedPatient
    ? `/api/doctor-intake?consultSessionId=${encodeURIComponent(selectedPatient.consultSessionId)}`
    : undefined;

  const demographicPairs = selectedPatient
    ? [
        { key: "Age", value: selectedPatient.age },
        { key: "Sex", value: selectedPatient.sex },
        { key: "Phone", value: selectedPatient.phone },
        { key: "Language", value: formatMaybeLabel(selectedPatient.answers.preferredLanguage) },
        { key: "Region", value: formatMaybeLabel(selectedPatient.answers.region) },
        { key: "BMI", value: selectedPatient.bmi },
        { key: "Pain", value: selectedPatient.painScore },
        { key: "Score", value: calculatePatientScore(selectedPatient.answers.painScore) },
        { key: "Type", value: selectedPatient.consultationType },
        { key: "State", value: statusLabel(selectedPatient.status) },
      ]
    : [];

  if (!selectedPatientId) {
    return (
      <section className="rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.9)] p-4 shadow-[0_24px_80px_rgba(21,32,43,0.12)] sm:p-6">
        <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-[0_10px_24px_rgba(21,32,43,0.08)]">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Doctor queue</div>
          <h2 className="headline mt-1 text-2xl font-semibold">Current patients grouped by state</h2>

          {isLoadingPatients ? (
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">Loading current queue...</p>
          ) : null}

          {!isLoadingPatients && patientsError ? (
            <p className="mt-3 text-sm leading-7 text-[color:#a34722]">{patientsError}</p>
          ) : null}

          {!isLoadingPatients && !patientsError && groupedQueue.length === 0 ? (
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">No patients in queue right now.</p>
          ) : null}

          {!isLoadingPatients && !patientsError && groupedQueue.length > 0 ? (
            <div className="mt-5 space-y-5">
              {groupedQueue.map(([state, patients]) => (
                <section key={state} className="rounded-2xl border border-[rgba(21,32,43,0.08)] bg-[rgba(248,245,240,0.5)] p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">{state}</h3>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[color:var(--muted)]">{patients.length}</span>
                  </div>
                  <div className="space-y-2">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(patient.id);
                          setActiveDetailTab("patient-details");
                        }}
                        className="focus-ring grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[rgba(21,32,43,0.08)] bg-white px-3 py-3 text-left shadow-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[color:var(--foreground)]">{patient.name}</div>
                          <div className="truncate text-xs text-[color:var(--muted)]">{patient.summary || "No summary"}</div>
                        </div>
                        <div className="text-right text-xs font-medium text-[color:var(--muted)]">
                          <div>{patient.appointmentTime}</div>
                          <div>{patient.consultationType}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (!selectedPatient) {
    return null;
  }

  return (
    <section className="space-y-5 rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.9)] p-4 shadow-[0_24px_80px_rgba(21,32,43,0.12)] sm:p-6">
      <div className="sticky top-16 z-20 rounded-xl border border-[rgba(15,118,110,0.16)] bg-[linear-gradient(135deg,rgba(15,118,110,0.12),rgba(255,255,255,0.94)_45%,rgba(255,138,91,0.1))] p-1 backdrop-blur sm:top-[4.75rem]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedPatientId(null)}
            aria-label="Back to patient queue"
            className="focus-ring inline-flex h-7 items-center justify-center gap-1 rounded-md px-1.5 text-base font-semibold leading-none text-[color:var(--muted)]"
          >
            &lt;
            <span className="text-xs font-medium">Queue</span>
          </button>
          <h2 className="headline text-2xl font-semibold sm:text-3xl">{selectedPatient.name}</h2>
          <span className="text-sm text-[color:var(--muted)]">{selectedPatient.appointmentTime}</span>
        </div>

        <div className="mt-2">
          <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[color:var(--foreground)]">
            {demographicPairs.map((item, index) => (
              <div key={item.key} className="inline-flex flex-none items-baseline gap-1.5 whitespace-nowrap">
                <dt className="shrink-0 text-[color:var(--muted)]">{item.key}</dt>
                <dd className="shrink-0 font-medium whitespace-nowrap">{item.value}</dd>
                {index < demographicPairs.length - 1 ? <span className="flex-none text-[color:var(--muted)]">|</span> : null}
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-1 text-sm text-[color:var(--muted)]">Summary: {selectedPatient.summary}</p>
      </div>

      <div className="border-b border-[rgba(21,32,43,0.12)]">
        <div className="flex items-end gap-6">
          <button
            type="button"
            onClick={() => setActiveDetailTab("patient-details")}
            className={`focus-ring border-b-2 pb-2 text-sm font-semibold transition ${
              activeDetailTab === "patient-details"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            }`}
          >
            Patient details
          </button>
          <button
            type="button"
            onClick={() => setActiveDetailTab("doctor")}
            className={`focus-ring border-b-2 pb-2 text-sm font-semibold transition ${
              activeDetailTab === "doctor"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            }`}
          >
            Doctor
          </button>
        </div>
      </div>

      {activeDetailTab === "patient-details" ? (
        <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
          <div className="mb-2 text-sm font-semibold text-[color:var(--foreground)]">Patient form details</div>
          <div className="overflow-hidden rounded-xl border border-[rgba(21,32,43,0.08)]">
            {patientReadOnlyRows.length === 0 ? (
              <div className="px-4 py-4 text-sm text-[color:var(--muted)]">No submitted patient answers found for this session.</div>
            ) : (
              patientReadOnlyRows.map((row) => (
                <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-[rgba(21,32,43,0.08)] px-4 py-2.5 text-sm last:border-b-0">
                  <div className="font-medium text-[color:var(--foreground)]">{row.label}</div>
                  <div className="text-[color:var(--muted)]">{row.value}</div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div>
          <QuestionnaireFlow
            key={selectedPatient.consultSessionId}
            sessionId={selectedPatient.consultSessionId}
            definition={doctorDefinition}
            layout="sectioned"
            showAutosaveSection={false}
            showSidePanel={false}
            skipIntro={true}
            showSessionDetails={false}
            loadApiPath={doctorLoadApiPath}
            saveApiPath="/api/doctor-intake"
            saveApiContext={doctorSaveContext}
          />
        </div>
      )}
    </section>
  );
}
