"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateBmi,
  doctorQuestionnaireDefinition,
  summarizeAnswer,
  type QuestionnaireDefinition,
} from "@/lib/questionnaire";
import type { PromDisplaySummary } from "@/lib/prom-scoring";
import { QuestionnaireFlow } from "@/components/questionnaire-flow";
import { patientWorkflowSections, preConsultSections } from "@/lib/workflow-data";
import { findPatientRecordByPhone, listAppointments, loadPatientQuestionnaire, type PatientRecord } from "@/lib/portal-storage";

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
  promSummary?: PromDisplaySummary;
};

type ApiAppointmentsPayload = {
  ok?: boolean;
  appointments?: AppointmentRecord[];
  message?: string;
  storage?: string;
};

type QuestionnaireAnswer = string | number | boolean | string[];
type IntakeRecord = { sessionId: string; answers?: Record<string, QuestionnaireAnswer> };
type PatientProfileSnapshot = Pick<PatientRecord, "age" | "gender" | "region" | "preferredLanguage">;

type PatientDocument = {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes?: number | null;
  storedPath?: string | null;
  uploadedAt: string;
};

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
  language: string;
  region: string;
  mriAvailable: string;
  status: string;
  promSummary?: PromDisplaySummary;
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
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^q\d+\s*/i, "")
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

function formatPromSummary(summary?: PromDisplaySummary) {
  if (!summary) {
    return "Not scored";
  }

  const percentLabel = Number.isFinite(summary.percent) ? `${summary.percent.toFixed(1)}%` : "Not scored";
  return `${summary.instrument} ${percentLabel} (${summary.severity})`;
}

function getPromSeverityTone(summary?: PromDisplaySummary) {
  if (!summary) {
    return {
      badgeClass: "border-slate-300 bg-slate-50 text-slate-700",
      panelClass: "border-slate-300 bg-slate-50 text-slate-800",
      focusLabel: "PROM pending",
    };
  }

  const percent = Number.isFinite(summary.percent) ? summary.percent : 0;

  if (percent >= 61) {
    return {
      badgeClass: "border-red-300 bg-red-50 text-red-800",
      panelClass: "border-red-300 bg-red-50 text-red-900",
      focusLabel: "High disability",
    };
  }

  if (percent >= 41) {
    return {
      badgeClass: "border-orange-300 bg-orange-50 text-orange-800",
      panelClass: "border-orange-300 bg-orange-50 text-orange-900",
      focusLabel: "Severe disability",
    };
  }

  if (percent >= 21) {
    return {
      badgeClass: "border-amber-300 bg-amber-50 text-amber-800",
      panelClass: "border-amber-300 bg-amber-50 text-amber-900",
      focusLabel: "Moderate disability",
    };
  }

  return {
    badgeClass: "border-emerald-300 bg-emerald-50 text-emerald-800",
    panelClass: "border-emerald-300 bg-emerald-50 text-emerald-900",
    focusLabel: "Minimal disability",
  };
}

function getPromUrgencyRank(summary?: PromDisplaySummary) {
  if (!summary || !Number.isFinite(summary.percent)) {
    return -1;
  }

  const percent = summary.percent;
  if (percent >= 61) return 3;
  if (percent >= 41) return 2;
  if (percent >= 21) return 1;
  return 0;
}

function genderSymbol(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "female") {
    return "♀";
  }

  if (normalized === "male") {
    return "♂";
  }

  if (normalized === "non-binary") {
    return "⚧";
  }

  return "•";
}

function calculateAgeFromDob(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function getRiskTag(answers: Record<string, QuestionnaireAnswer>) {
  const hasRedFlag = [
    "redFlagBladderBowel",
    "redFlagRapidWeakness",
    "redFlagFever",
    "redFlagTrauma",
    "redFlagCancer",
    "redFlagWeightLoss",
  ].some((key) => answers[key] === true);

  return hasRedFlag ? "Red flag" : "Routine";
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

function firstNonEmptyAnswer(answers: Record<string, QuestionnaireAnswer>, ...keys: string[]) {
  for (const key of keys) {
    const value = answers[key];

    if (Array.isArray(value) && value.length > 0) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

function getCurrentDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function loadPatientProfileByPhone(phone: string): Promise<PatientProfileSnapshot | null> {
  const normalizedPhone = String(phone ?? "").replace(/\D/g, "");
  if (!normalizedPhone) {
    return null;
  }

  const local = findPatientRecordByPhone(normalizedPhone);
  if (local) {
    return {
      age: local.age,
      gender: local.gender,
      region: local.region,
      preferredLanguage: local.preferredLanguage,
    };
  }

  try {
    const response = await fetch(`/api/patient-register?phone=${encodeURIComponent(normalizedPhone)}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          record?: {
            age?: number | null;
            gender?: string | null;
            region?: string | null;
            preferredLanguage?: string | null;
          } | null;
        }
      | null;

    if (!response.ok || !payload?.ok || !payload.record) {
      return null;
    }

    return {
      age: typeof payload.record.age === "number" ? payload.record.age : undefined,
      gender: payload.record.gender ?? undefined,
      region: payload.record.region ?? undefined,
      preferredLanguage: payload.record.preferredLanguage ?? undefined,
    };
  } catch {
    return null;
  }
}

async function loadAppointments(date?: string, doctorEmail?: string) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (doctorEmail) params.set("doctorEmail", doctorEmail);
  const url = `/api/appointments${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as ApiAppointmentsPayload;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? "Could not load appointments");
  }

  const apiAppointments = payload.appointments ?? [];
  const localAppointments: AppointmentRecord[] = listAppointments().map((item) => ({
    id: item.consultId ?? item.sessionId,
    consultSessionId: item.sessionId,
    patientName: item.patientName,
    patientPhone: item.patientPhone,
    doctorName: item.doctorName,
    appointmentDate: item.appointmentDate,
    appointmentTime: item.appointmentTime,
    appointmentType: item.appointmentType,
    status: item.status,
    notes: item.notes,
    promSummary: undefined,
  }));

  if (doctorEmail && localAppointments.length > 0) {
    // local fallback does not have doctor email mapping; include only when API is empty or unavailable
    if (apiAppointments.length === 0) {
      return localAppointments;
    }
  }

  const dedupedBySession = new Map<string, AppointmentRecord>();
  for (const item of [...localAppointments, ...apiAppointments]) {
    dedupedBySession.set(item.consultSessionId || item.id, item);
  }

  return Array.from(dedupedBySession.values());
}

async function loadIntakeBySession(sessionId: string) {
  try {
    const response = await fetch(`/api/patient-intake?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    const payload = (await response.json()) as { ok?: boolean; record?: IntakeRecord | null };

    if (response.ok && payload.ok) {
      if (payload.record) {
        return payload.record;
      }

      const localRecord = loadPatientQuestionnaire(sessionId);
      if (localRecord) {
        return {
          sessionId: localRecord.sessionId,
          answers: localRecord.answers as Record<string, QuestionnaireAnswer>,
        };
      }

      return null;
    }

    const localRecord = loadPatientQuestionnaire(sessionId);
    if (localRecord) {
      return {
        sessionId: localRecord.sessionId,
        answers: localRecord.answers as Record<string, QuestionnaireAnswer>,
      };
    }

    return null;
  } catch {
    const localRecord = loadPatientQuestionnaire(sessionId);
    if (localRecord) {
      return {
        sessionId: localRecord.sessionId,
        answers: localRecord.answers as Record<string, QuestionnaireAnswer>,
      };
    }

    return null;
  }
}

async function loadDoctorQueue(doctorEmail?: string) {
  const appointments = await loadAppointments(undefined, doctorEmail);

  const patientProfileByPhone = new Map<string, Promise<PatientProfileSnapshot | null>>();

  return Promise.all(
    appointments.map(async (appointment) => {
      const intake = await loadIntakeBySession(appointment.consultSessionId || appointment.id);
      const sessionId = appointment.consultSessionId || appointment.id;
      const answers = intake?.answers && Object.keys(intake.answers).length > 0 ? intake.answers : {};
      const patientName = String(answers.patientName ?? appointment.patientName ?? "Patient").trim() || "Patient";
      const phone = String(answers.phone ?? appointment.patientPhone ?? "").replace(/\D/g, "") || appointment.patientPhone;
      if (!patientProfileByPhone.has(phone)) {
        patientProfileByPhone.set(phone, loadPatientProfileByPhone(phone));
      }
      const patientProfile = (await patientProfileByPhone.get(phone)) ?? null;
      const bmiValue = calculateBmi(Number(answers.weightKg), Number(answers.heightCm));
      const resolvedGender = firstNonEmptyAnswer(answers, "gender", "sex") ?? patientProfile?.gender;
      const resolvedLanguage =
        firstNonEmptyAnswer(answers, "preferredLanguage", "language", "consultLanguage") ??
        patientProfile?.preferredLanguage;
      const resolvedRegion = firstNonEmptyAnswer(answers, "region", "city", "location") ?? patientProfile?.region;
      const resolvedPainScore = firstNonEmptyAnswer(answers, "painScore", "q6VasPain", "vasPain", "pain_scale");
      const ageFromDob = calculateAgeFromDob(answers.dateOfBirth);
      const ageFromProfile = typeof patientProfile?.age === "number" && Number.isFinite(patientProfile.age) ? patientProfile.age : Number.NaN;
      const ageFromField =
        typeof answers.age === "number" && Number.isFinite(answers.age)
          ? answers.age
          : typeof answers.age === "string" && answers.age.trim()
            ? Number.parseInt(answers.age, 10)
            : Number.NaN;
      const resolvedAge = Number.isFinite(ageFromField)
        ? String(ageFromField)
        : Number.isFinite(ageFromProfile)
          ? String(ageFromProfile)
          : ageFromDob === null
            ? "Not captured"
            : String(ageFromDob);
      const queueStatus = statusLabel(appointment.status);

      return {
        id: appointment.id,
        consultSessionId: sessionId,
        name: patientName,
        patientId: sessionId,
        phone,
        age: resolvedAge,
        sex: formatChoice(resolvedGender, genderLabels),
        answers,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        consultationType: appointmentTypeLabels[appointment.appointmentType] ?? titleize(appointment.appointmentType),
        summary: String(answers.mainConcern ?? answers.symptomFocus ?? appointment.notes ?? "").trim() || "Pending intake",
        bmi: bmiValue === null ? "Not captured" : bmiValue.toFixed(1),
        painScore: formatPainScore(resolvedPainScore),
        language: formatMaybeLabel(resolvedLanguage),
        region: formatMaybeLabel(resolvedRegion),
        mriAvailable: formatMriValue(answers),
        status: queueStatus,
        promSummary: appointment.promSummary,
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

export function DoctorWorkflow({ doctorEmail }: { doctorEmail?: string }) {
  const [todayPatients, setTodayPatients] = useState<DoctorPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"patient-details" | "doctor">("patient-details");
  const [doctorDefinition, setDoctorDefinition] = useState<QuestionnaireDefinition>(doctorQuestionnaireDefinition);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [patientsError, setPatientsError] = useState("");
  const [patientDocuments, setPatientDocuments] = useState<PatientDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [expandedPatientSectionId, setExpandedPatientSectionId] = useState<string | null>(null);
  const [mobileSort, setMobileSort] = useState<"severity" | "time">("severity");

  const selectedPatient = useMemo(
    () => (selectedPatientId ? todayPatients.find((item) => item.id === selectedPatientId) ?? null : null),
    [selectedPatientId, todayPatients],
  );

  const desktopQueueRows = useMemo(() => {
    return [...todayPatients].sort((a, b) => {
      const urgencyDelta = getPromUrgencyRank(b.promSummary) - getPromUrgencyRank(a.promSummary);
      if (urgencyDelta !== 0) {
        return urgencyDelta;
      }

      return a.appointmentTime.localeCompare(b.appointmentTime);
    });
  }, [todayPatients]);

  const mobileQueueRows = useMemo(() => {
    return [...todayPatients].sort((a, b) => {
      if (mobileSort === "time") {
        return a.appointmentTime.localeCompare(b.appointmentTime);
      }

      const urgencyDelta = getPromUrgencyRank(b.promSummary) - getPromUrgencyRank(a.promSummary);
      if (urgencyDelta !== 0) {
        return urgencyDelta;
      }

      const bProm = b.promSummary?.percent ?? -1;
      const aProm = a.promSummary?.percent ?? -1;
      return bProm - aProm;
    });
  }, [todayPatients, mobileSort]);

  const activePatientSections = useMemo(() => {
    if (!selectedPatient) {
      return patientWorkflowSections;
    }

    const answerKeys = new Set(Object.keys(selectedPatient.answers));
    const sectionCandidates = [preConsultSections, patientWorkflowSections] as const;

    const withScores = sectionCandidates.map((sections) => {
      const questionKeys = new Set(sections.flatMap((section) => section.questions.map((question) => question.id)));
      let matches = 0;
      for (const key of answerKeys) {
        if (questionKeys.has(key)) {
          matches += 1;
        }
      }
      return { sections, matches };
    });

    const best = withScores.sort((a, b) => b.matches - a.matches)[0];
    return best.matches > 0 ? best.sections : patientWorkflowSections;
  }, [selectedPatient]);

  const patientQuestionMap = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        optionLabelByValue: Map<string, string>;
      }
    >();

    for (const section of activePatientSections) {
      for (const question of section.questions) {
        map.set(question.id, {
          label: question.label,
          optionLabelByValue: new Map(
            (question.options ?? []).map((option) => [option.value, option.label]),
          ),
        });
      }
    }

    return map;
  }, [activePatientSections]);

  const patientReadOnlyRows = useMemo(() => {
    if (!selectedPatient) {
      return [] as Array<{ key: string; label: string; value: string }>;
    }

    const answerKeys = new Set(Object.keys(selectedPatient.answers));
    const orderedKeys = activePatientSections
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

  const patientReadOnlySections = useMemo(() => {
    if (!selectedPatient || patientReadOnlyRows.length === 0) {
      return [] as Array<{ id: string; title: string; rows: Array<{ key: string; label: string; value: string }> }>;
    }

    const sectionByQuestionKey = new Map<string, { id: string; title: string }>();
    for (const section of activePatientSections) {
      for (const question of section.questions) {
        sectionByQuestionKey.set(question.id, { id: section.id, title: section.title });
      }
    }

    const grouped = new Map<string, { id: string; title: string; rows: Array<{ key: string; label: string; value: string }> }>();

    for (const row of patientReadOnlyRows) {
      const sectionMeta = sectionByQuestionKey.get(row.key);
      const sectionId = sectionMeta?.id ?? "additional-details";
      const sectionTitle = sectionMeta?.title ?? "Additional details";

      const existing = grouped.get(sectionId) ?? { id: sectionId, title: sectionTitle, rows: [] };
      existing.rows.push(row);
      grouped.set(sectionId, existing);
    }

    const orderedSectionIds = [
      ...activePatientSections.map((section) => section.id),
      ...Array.from(grouped.keys()).filter((key) => !activePatientSections.some((section) => section.id === key)),
    ];

    return orderedSectionIds
      .map((sectionId) => grouped.get(sectionId))
      .filter((section): section is { id: string; title: string; rows: Array<{ key: string; label: string; value: string }> } => Boolean(section));
  }, [activePatientSections, patientReadOnlyRows, selectedPatient]);

  useEffect(() => {
    if (patientReadOnlySections.length === 0) {
      setExpandedPatientSectionId(null);
      return;
    }

    setExpandedPatientSectionId((current) => {
      if (current && patientReadOnlySections.some((section) => section.id === current)) {
        return current;
      }
      return patientReadOnlySections[0]?.id ?? null;
    });
  }, [patientReadOnlySections, selectedPatient?.id]);

  useEffect(() => {
    let active = true;

    async function loadPatients() {
      setIsLoadingPatients(true);
      setPatientsError("");

      try {
        const patients = await loadDoctorQueue(doctorEmail);

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
  }, [doctorEmail]);

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

  useEffect(() => {
    const patientPhone = selectedPatient?.phone;

    if (!patientPhone) {
      setPatientDocuments([]);
      return;
    }

    let active = true;

    async function loadPatientDocuments() {
      setLoadingDocuments(true);
      try {
        const response = await fetch(`/api/uploads/lab-reports?patientPhone=${encodeURIComponent(String(patientPhone))}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; reports?: PatientDocument[] } | null;

        if (!active) {
          return;
        }

        if (!response.ok || !payload?.ok) {
          setPatientDocuments([]);
          return;
        }

        setPatientDocuments(payload.reports ?? []);
      } catch {
        if (active) {
          setPatientDocuments([]);
        }
      } finally {
        if (active) {
          setLoadingDocuments(false);
        }
      }
    }

    void loadPatientDocuments();

    return () => {
      active = false;
    };
  }, [selectedPatient?.phone]);

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
  const canEditDoctorForm = selectedPatient ? selectedPatient.appointmentDate === getCurrentDateKey() : false;

  const selectedPromTone = getPromSeverityTone(selectedPatient?.promSummary);

  const demographicPairs = selectedPatient
    ? [
        { key: "PROM", value: formatPromSummary(selectedPatient.promSummary), isProm: true },
        { key: "Patient ID", value: selectedPatient.patientId },
        { key: "Language", value: selectedPatient.language },
        { key: "Region", value: selectedPatient.region },
        { key: "BMI", value: selectedPatient.bmi },
        { key: "Pain score", value: selectedPatient.painScore },
        { key: "Visit type", value: selectedPatient.consultationType },
      ]
    : [];

  if (!selectedPatientId) {
    const queueTotal = todayPatients.length;
    const highDisabilityCount = todayPatients.filter((patient) => getPromUrgencyRank(patient.promSummary) >= 2).length;

    return (
      <section className="rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.9)] p-4 shadow-[0_24px_80px_rgba(21,32,43,0.12)] sm:p-6">
        <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-[0_10px_24px_rgba(21,32,43,0.08)]">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Doctor queue</div>
          <h2 className="headline mt-1 text-2xl font-semibold">Patient list</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-[rgba(21,32,43,0.12)] bg-[rgba(248,245,240,0.65)] px-2.5 py-1 font-semibold text-[color:var(--foreground)]">
              Total {queueTotal}
            </span>
            <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-700">
              High disability {highDisabilityCount}
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-[rgba(21,32,43,0.08)] bg-[rgba(248,245,240,0.45)] p-3 lg:hidden">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">
              Sort (mobile/tablet)
              <select
                value={mobileSort}
                onChange={(event) => setMobileSort(event.target.value as "severity" | "time")}
                className="mt-1 w-full rounded-lg border border-[rgba(21,32,43,0.12)] bg-white px-2.5 py-2 text-sm font-medium text-[color:var(--foreground)]"
              >
                <option value="severity">Severity</option>
                <option value="time">Time</option>
              </select>
            </label>
          </div>

          {isLoadingPatients ? (
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">Loading current queue...</p>
          ) : null}

          {!isLoadingPatients && patientsError ? (
            <p className="mt-3 text-sm leading-7 text-[color:#a34722]">{patientsError}</p>
          ) : null}

          {!isLoadingPatients && !patientsError && todayPatients.length === 0 ? (
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">No patients in queue right now.</p>
          ) : null}

          {!isLoadingPatients && !patientsError && todayPatients.length > 0 ? (
            <>
              <div className="mt-4 hidden overflow-hidden rounded-xl border border-[rgba(21,32,43,0.08)] lg:block">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_110px_120px_130px_minmax(0,1fr)] bg-[rgba(248,245,240,0.7)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">
                  <div>Patient</div>
                  <div>PROM</div>
                  <div>Status</div>
                  <div>Time</div>
                  <div>Visit</div>
                  <div>Summary</div>
                </div>
                <div className="divide-y divide-[rgba(21,32,43,0.08)] bg-white">
                  {desktopQueueRows.map((patient) => {
                    const promTone = getPromSeverityTone(patient.promSummary);
                    return (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(patient.id);
                          setActiveDetailTab("patient-details");
                        }}
                        className="focus-ring grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_110px_120px_130px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left transition hover:bg-[rgba(21,32,43,0.03)]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[color:var(--foreground)]">{patient.name}</div>
                          <div className="truncate text-xs text-[color:var(--muted)]">{patient.phone}</div>
                        </div>
                        <div>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${promTone.badgeClass}`}>
                            {formatPromSummary(patient.promSummary)}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-[color:var(--muted)]">{patient.status}</div>
                        <div className="text-xs font-medium text-[color:var(--foreground)]">{patient.appointmentTime}</div>
                        <div className="text-xs font-medium text-[color:var(--muted)]">{patient.consultationType}</div>
                        <div className="truncate text-xs text-[color:var(--muted)]">{patient.summary || "No summary"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-2 lg:hidden">
                {mobileQueueRows.map((patient) => {
                  const promTone = getPromSeverityTone(patient.promSummary);
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(patient.id);
                        setActiveDetailTab("patient-details");
                      }}
                      className="focus-ring w-full rounded-xl border border-[rgba(21,32,43,0.08)] bg-white px-3 py-3 text-left shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[color:var(--foreground)]">{patient.name}</div>
                          <div className="truncate text-xs text-[color:var(--muted)]">{patient.phone}</div>
                        </div>
                        <div className="text-right text-xs font-medium text-[color:var(--muted)]">
                          <div>{patient.appointmentTime}</div>
                          <div>{patient.consultationType}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${promTone.badgeClass}`}>
                          {formatPromSummary(patient.promSummary)}
                        </span>
                        <span className="rounded-full border border-[rgba(21,32,43,0.14)] bg-[rgba(248,245,240,0.6)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]">
                          {patient.status}
                        </span>
                      </div>
                      <div className="mt-2 truncate text-xs text-[color:var(--muted)]">{patient.summary || "No summary"}</div>
                    </button>
                  );
                })}
              </div>
            </>
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
          <span className="rounded-full border border-[rgba(21,32,43,0.14)] bg-white/85 px-2.5 py-1 text-xs font-semibold text-[color:var(--foreground)]">
            <span aria-label={`Gender ${selectedPatient.sex}`}>{genderSymbol(selectedPatient.sex)}</span> {selectedPatient.age}
          </span>
          <span className="text-sm text-[color:var(--muted)]">{selectedPatient.appointmentTime}</span>
          <button
            type="button"
            onClick={() => window.open(`/print/consult/${encodeURIComponent(selectedPatient.consultSessionId)}`, "_blank", "noopener,noreferrer")}
            className="focus-ring ml-auto inline-flex items-center gap-2 rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
          >
            Print
          </button>
        </div>

        <div className="mt-2 hidden sm:block">
          <div className={`mb-2 rounded-xl border px-3 py-2 ${selectedPromTone.panelClass}`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em]">Clinical Disability Index</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">{formatPromSummary(selectedPatient.promSummary)}</span>
              <span className="rounded-full border border-current/30 bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                {selectedPromTone.focusLabel}
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-2 rounded-xl border border-[rgba(21,32,43,0.08)] bg-white/90 p-3 sm:grid-cols-2">
            {demographicPairs.map((item) => (
              <div
                key={item.key}
                className={`flex items-center justify-between gap-3 rounded-lg border px-2.5 py-2 ${
                  item.isProm
                    ? `${selectedPromTone.panelClass} border-current/25`
                    : "border-[rgba(21,32,43,0.08)] bg-[rgba(248,245,240,0.55)]"
                }`}
              >
                <dt className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${item.isProm ? "text-current" : "text-[color:var(--muted)]"}`}>
                  {item.key}
                </dt>
                <dd className={`text-sm font-semibold ${item.isProm ? "text-current" : "text-[color:var(--foreground)]"}`}>{item.value}</dd>
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
        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-[color:var(--foreground)]">Patient form details</div>
            <div className="overflow-hidden rounded-xl border border-[rgba(21,32,43,0.08)]">
              {patientReadOnlySections.length === 0 ? (
                <div className="px-4 py-4 text-sm text-[color:var(--muted)]">No submitted patient answers found for this session.</div>
              ) : (
                <div className="divide-y divide-[rgba(21,32,43,0.08)]">
                  {patientReadOnlySections.map((section, index) => {
                    const isExpanded = expandedPatientSectionId === section.id;
                    const colorBand =
                      index % 4 === 0
                        ? "from-teal-50 to-cyan-50 border-teal-200"
                        : index % 4 === 1
                          ? "from-amber-50 to-orange-50 border-amber-200"
                          : index % 4 === 2
                            ? "from-emerald-50 to-lime-50 border-emerald-200"
                            : "from-sky-50 to-indigo-50 border-sky-200";

                    return (
                      <div key={section.id} className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setExpandedPatientSectionId((current) => (current === section.id ? null : section.id))}
                          className={`focus-ring flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                            isExpanded
                              ? `bg-gradient-to-r ${colorBand} text-[color:var(--foreground)] shadow-sm`
                              : "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)] hover:bg-[rgba(21,32,43,0.03)]"
                          }`}
                          aria-expanded={isExpanded}
                          aria-controls={`patient-section-${section.id}`}
                        >
                          <span className="text-sm font-semibold">{section.title}</span>
                          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--muted)]">
                            {section.rows.length}
                            <svg
                              className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              viewBox="0 0 20 20"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path d="m5 7 5 6 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </button>

                        {isExpanded ? (
                          <div id={`patient-section-${section.id}`} className="mt-2 overflow-hidden rounded-xl border border-[rgba(21,32,43,0.08)] bg-white">
                            {section.rows.map((row) => (
                              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-[rgba(21,32,43,0.08)] px-4 py-2.5 text-sm last:border-b-0">
                                <div className="font-medium text-[color:var(--foreground)]">{row.label}</div>
                                <div className="text-[color:var(--muted)]">{row.value}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-[color:var(--foreground)]">Uploaded documents</div>
            <div className="overflow-hidden rounded-xl border border-[rgba(21,32,43,0.08)]">
              {loadingDocuments ? (
                <div className="px-4 py-4 text-sm text-[color:var(--muted)]">Loading uploaded documents...</div>
              ) : patientDocuments.length === 0 ? (
                <div className="px-4 py-4 text-sm text-[color:var(--muted)]">No uploaded documents found for this patient.</div>
              ) : (
                patientDocuments.map((doc) => (
                  <div key={doc.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[rgba(21,32,43,0.08)] px-4 py-2.5 text-sm last:border-b-0">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[color:var(--foreground)]">{doc.fileName}</div>
                      <div className="text-xs text-[color:var(--muted)]">
                        {doc.fileType}
                        {typeof doc.fileSizeBytes === "number" && doc.fileSizeBytes > 0 ? ` · ${(doc.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB` : ""}
                        {doc.uploadedAt ? ` · ${new Date(doc.uploadedAt).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    {doc.storedPath ? (
                      <a
                        href={doc.storedPath}
                        target="_blank"
                        rel="noreferrer"
                        className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-[color:var(--muted)]">Path unavailable</span>
                    )}
                  </div>
                ))
              )}
            </div>
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
            allowSubmittedEdit={canEditDoctorForm}
          />
        </div>
      )}
    </section>
  );
}
