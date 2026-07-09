"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { patientWorkflowSections } from "@/lib/workflow-data";
import type { PatientQuestionContent, PatientQuestionnaireRecord } from "@/lib/patient-questionnaire-db";
import { calculateBmi, summarizeAnswer } from "@/lib/questionnaire";
import { savePatientQuestionnaire } from "@/lib/portal-storage";

type AnswerValue = string | number | boolean | string[];
type AnswerMap = Record<string, AnswerValue>;
type SectionIconProps = { sectionId: string; className?: string };
type WorkflowSections = typeof patientWorkflowSections;
type WorkflowQuestion = WorkflowSections[number]["questions"][number];

const redFlagKeys = [
  "redFlagBladderBowel",
  "redFlagRapidWeakness",
  "redFlagFever",
  "redFlagTrauma",
  "redFlagCancer",
  "redFlagWeightLoss",
];

const celebrationConfetti = [
  { left: "8%", delay: "0ms", color: "#0f766e", size: "10px", drift: "-18px", rotate: "28deg" },
  { left: "14%", delay: "220ms", color: "#ff8a5b", size: "7px", drift: "22px", rotate: "-18deg" },
  { left: "22%", delay: "80ms", color: "#f6c85f", size: "9px", drift: "-12px", rotate: "42deg" },
  { left: "34%", delay: "340ms", color: "#15202b", size: "6px", drift: "18px", rotate: "12deg" },
  { left: "45%", delay: "160ms", color: "#0f766e", size: "8px", drift: "-26px", rotate: "-34deg" },
  { left: "56%", delay: "420ms", color: "#ff8a5b", size: "11px", drift: "24px", rotate: "20deg" },
  { left: "66%", delay: "120ms", color: "#f6c85f", size: "7px", drift: "-16px", rotate: "-28deg" },
  { left: "74%", delay: "280ms", color: "#0f766e", size: "9px", drift: "20px", rotate: "38deg" },
  { left: "84%", delay: "40ms", color: "#ff8a5b", size: "6px", drift: "-20px", rotate: "-12deg" },
  { left: "92%", delay: "360ms", color: "#15202b", size: "8px", drift: "14px", rotate: "32deg" },
] as const;

const initialAnswers: AnswerMap = {
  onBehalf: false,
  reviewConsent: false,
};

function SectionIcon({ sectionId, className = "h-5 w-5" }: SectionIconProps) {
  const sharedProps = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.9,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  switch (sectionId) {
    case "red-flags":
      return (
        <svg {...sharedProps}>
          <path d="M12 3.5 3.8 18a1.7 1.7 0 0 0 1.5 2.5h13.4a1.7 1.7 0 0 0 1.5-2.5L12 3.5Z" />
          <path d="M12 8.5v4.5" />
          <path d="M12 16.5h.01" />
        </svg>
      );
    case "patient-profile":
      return (
        <svg {...sharedProps}>
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </svg>
      );
    case "medical-history":
      return (
        <svg {...sharedProps}>
          <path d="M12 21s-7-4.4-7-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21Z" />
          <path d="M9 12h6" />
          <path d="M12 9v6" />
        </svg>
      );
    case "previous-reports":
      return (
        <svg {...sharedProps}>
          <path d="M7 3.5h7l3 3V20a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20V3.5Z" />
          <path d="M14 3.5V7h3" />
          <path d="M9.5 12h5" />
          <path d="M9.5 15.5h5" />
        </svg>
      );
    case "diagnosis-understanding":
      return (
        <svg {...sharedProps}>
          <path d="M12 3.5a6.5 6.5 0 0 0-4 11.6V18h8v-2.9a6.5 6.5 0 0 0-4-11.6Z" />
          <path d="M9 21h6" />
          <path d="M10 18h4" />
        </svg>
      );
    case "current-problem":
      return (
        <svg {...sharedProps}>
          <path d="M12 20.5c4-3.4 6-6.4 6-9a6 6 0 0 0-12 0c0 2.6 2 5.6 6 9Z" />
          <path d="M12 13.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </svg>
      );
    case "pain-behaviour":
      return (
        <svg {...sharedProps}>
          <path d="M4 15c2.6-6.4 5.4-6.4 8 0s5.4 6.4 8 0" />
          <path d="M5 9h3" />
          <path d="M16 9h3" />
        </svg>
      );
    case "symptom-severity":
      return (
        <svg {...sharedProps}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M22 19H2" />
        </svg>
      );
    case "neurological-symptoms":
      return (
        <svg {...sharedProps}>
          <path d="M9 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 5.5 1.7" />
          <path d="M15 4.5a3 3 0 0 1 3 3v9a3 3 0 0 1-5.5 1.7" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
        </svg>
      );
    case "functional-disability":
      return (
        <svg {...sharedProps}>
          <path d="M7 20 12 4l5 16" />
          <path d="M9 14h6" />
          <path d="M5 20h14" />
        </svg>
      );
    case "previous-treatment":
      return (
        <svg {...sharedProps}>
          <path d="M6 7h12" />
          <path d="M6 12h12" />
          <path d="M6 17h8" />
          <path d="M4 7h.01" />
          <path d="M4 12h.01" />
          <path d="M4 17h.01" />
        </svg>
      );
    case "concerns-goals":
      return (
        <svg {...sharedProps}>
          <path d="M12 21s7-4.3 7-10.5A4.5 4.5 0 0 0 12 7a4.5 4.5 0 0 0-7 3.5C5 16.7 12 21 12 21Z" />
          <path d="m9.5 12 1.6 1.6 3.4-3.6" />
        </svg>
      );
    default:
      return (
        <svg {...sharedProps}>
          <path d="M5 4.5h14v15H5z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      );
  }
}

function applyQuestionContentOverrides(questionContent: PatientQuestionContent[] = []): WorkflowSections {
  if (questionContent.length === 0) {
    return patientWorkflowSections;
  }

  const contentById = new Map(questionContent.map((question) => [question.id, question]));

  return patientWorkflowSections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => {
      const override = contentById.get(question.id);

      if (!override) {
        return question;
      }

      return {
        ...question,
        label: override.label,
        type: override.type as typeof question.type,
        helpText: override.helpText ?? question.helpText,
        required: override.required ?? question.required,
        options: override.options ?? question.options,
      };
    }),
  }));
}

function getVisibleQuestions(sections: WorkflowSections, sectionIndex: number, answers: AnswerMap) {
  return sections[sectionIndex].questions.filter((question) =>
    question.showIf ? question.showIf(answers) : true,
  );
}

function isQuestionAnswered(question: WorkflowQuestion, answers: AnswerMap) {
  const value = answers[question.id];

  if (question.id === "reviewConsent") {
    return value === true;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return false;
}

function isQuestionMeaningfullyAnswered(
  question: WorkflowQuestion,
  answers: AnswerMap,
) {
  if (question.type === "info-link") {
    return false;
  }

  const value = answers[question.id];
  const defaultValue = initialAnswers[question.id];

  if (Array.isArray(value)) {
    if (Array.isArray(defaultValue) && value.length === defaultValue.length && value.every((item, index) => item === defaultValue[index])) {
      return false;
    }
    return value.length > 0;
  }

  if (typeof value === "boolean") {
    if (typeof defaultValue === "boolean" && value === defaultValue) {
      return false;
    }
    return true;
  }

  if (typeof value === "number") {
    if (typeof defaultValue === "number" && value === defaultValue) {
      return false;
    }
    return true;
  }

  if (typeof value === "string") {
    if (typeof defaultValue === "string" && value.trim() === defaultValue.trim()) {
      return false;
    }
    return value.trim().length > 0;
  }

  return false;
}

function summarizeQuestionAnswer(sections: WorkflowSections, questionId: string, value: AnswerValue | undefined) {
  const question = sections.flatMap((section) => section.questions).find((item) => item.id === questionId);

  if (!question?.options) {
    return summarizeAnswer(value);
  }

  if (Array.isArray(value)) {
    const labels = value.map((item) => question.options?.find((option) => option.value === item)?.label ?? item);
    return labels.length === 0 ? "Not filled" : labels.join(", ");
  }

  if (typeof value === "string") {
    return question.options.find((option) => option.value === value)?.label ?? summarizeAnswer(value);
  }

  return summarizeAnswer(value);
}

export function PatientWorkflow({
  sessionId,
  initialQuestionContent = [],
  initialSavedWorkflow = null,
}: {
  sessionId: string;
  initialQuestionContent?: PatientQuestionContent[];
  initialSavedWorkflow?: PatientQuestionnaireRecord | null;
}) {
  const workflowSections = useMemo(() => applyQuestionContentOverrides(initialQuestionContent), [initialQuestionContent]);
  const registeredProfileDefaults = useMemo(() => {
    if (typeof window === "undefined") {
      return {} as Partial<AnswerMap>;
    }

    const profileRaw = window.localStorage.getItem(`sei-patient-profile:${sessionId}`);
    if (!profileRaw) {
      return {} as Partial<AnswerMap>;
    }

    try {
      return JSON.parse(profileRaw) as Partial<AnswerMap>;
    } catch {
      window.localStorage.removeItem(`sei-patient-profile:${sessionId}`);
      return {} as Partial<AnswerMap>;
    }
  }, [sessionId]);

  const initialAnswersState = useMemo(
    () => ({
      ...initialAnswers,
      ...registeredProfileDefaults,
      ...(initialSavedWorkflow?.answers ?? {}),
    } as AnswerMap),
    [initialSavedWorkflow, registeredProfileDefaults],
  );
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswersState);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const questionAreaRef = useRef<HTMLDivElement | null>(null);
  const skippedInitialAutosaveRef = useRef(false);
  const latestDraftRef = useRef<{
    sessionId: string;
    patientPhone: string;
    answers: AnswerMap;
    sectionIndex: number;
    questionIndex: number;
    submitted: boolean;
  } | null>(null);

  const patientPhone = String(answers.phone ?? registeredProfileDefaults.phone ?? "").replace(/\D/g, "");

  const persistDraft = (record: {
    sessionId: string;
    patientPhone: string;
    answers: AnswerMap;
    sectionIndex: number;
    questionIndex: number;
    submitted: boolean;
    updatedAt: string;
  }) => {
    savePatientQuestionnaire(record);

    const payload = JSON.stringify(record);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const beaconBody = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/patient-intake", beaconBody)) {
        return;
      }
    }

    void fetch("/api/patient-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  };

  useEffect(() => {
    const saved = initialSavedWorkflow;
    if (!saved) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(() => ({
      ...initialAnswers,
      ...registeredProfileDefaults,
      ...(saved.answers ?? {}),
    } as AnswerMap));
    setSectionIndex(saved.sectionIndex ?? 0);
    setQuestionIndex(saved.questionIndex ?? 0);
    setSubmitted(Boolean(saved.submitted));
  }, [initialSavedWorkflow, registeredProfileDefaults, sessionId]);

  useEffect(() => {
    if (!skippedInitialAutosaveRef.current) {
      skippedInitialAutosaveRef.current = true;
      return;
    }

    const record = {
      sessionId,
      patientPhone,
      answers,
      sectionIndex,
      questionIndex,
      submitted,
      updatedAt: new Date().toISOString(),
    };

    latestDraftRef.current = { sessionId, patientPhone, answers, sectionIndex, questionIndex, submitted };
    persistDraft(record);
  }, [answers, patientPhone, questionIndex, sectionIndex, sessionId, submitted]);

  useEffect(() => {
    const handlePageHide = () => {
      const draft = latestDraftRef.current;
      if (!draft) {
        return;
      }

      persistDraft({
        ...draft,
        updatedAt: new Date().toISOString(),
      });
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  const getSectionQuestions = useMemo(
    () =>
      (index: number) => {
        const sectionQuestions = getVisibleQuestions(workflowSections, index, answers);
        return sectionQuestions;
      },
    [answers, workflowSections],
  );

  const section = workflowSections[sectionIndex];
  const visibleQuestions = getSectionQuestions(sectionIndex);
  const bmi = calculateBmi(Number(answers.weightKg), Number(answers.heightCm));
  const redFlagTriggered = Boolean(
    answers.redFlagBladderBowel ||
      answers.redFlagRapidWeakness ||
      answers.redFlagTrauma ||
      answers.redFlagCancer ||
      answers.redFlagFever ||
      answers.redFlagWeightLoss,
  );
  const isRedFlagSection = section.id === "red-flags";
  const redFlagOptions = visibleQuestions.filter((question) => redFlagKeys.includes(question.id));
  const redFlagNoneQuestion = visibleQuestions.find((question) => question.id === "redFlagNone");
  const redFlagReasonQuestion = workflowSections[0].questions.find((question) => question.id === "redFlagReason");
  const redFlagSectionAnswered =
    answers.redFlagNone === true || redFlagKeys.every((redFlagKey) => typeof answers[redFlagKey] === "boolean");

  const sectionCards = useMemo(
    () =>
      workflowSections.map((item, index) => {
        const sectionQuestions = getSectionQuestions(index);

        if (item.id === "red-flags") {
          return {
            ...item,
            active: index === sectionIndex,
            visibleCount: 1,
            answeredCount: redFlagSectionAnswered ? 1 : 0,
          };
        }

        return {
          ...item,
          active: index === sectionIndex,
          visibleCount: sectionQuestions.length,
          answeredCount: sectionQuestions.filter((question) => isQuestionAnswered(question, answers)).length,
        };
      }),
    [answers, getSectionQuestions, redFlagSectionAnswered, sectionIndex, workflowSections],
  );

  const goToSection = (index: number) => {
    setSectionIndex(index);
    setQuestionIndex(0);

    window.setTimeout(() => {
      questionAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const nextSection = () => {
    setSectionIndex((current) => Math.min(current + 1, workflowSections.length - 1));
    setQuestionIndex(0);
  };

  const prevSection = () => {
    setSectionIndex((current) => Math.max(current - 1, 0));
    setQuestionIndex(0);
  };

  const nextQuestion = () => {
    if (isRedFlagSection && !redFlagSectionAnswered) {
      setValidationMessage("Please answer each red flag item, or choose None of the above.");
      return;
    }

    const firstMissingInSection = visibleQuestions.find((question) => question.required && !isQuestionAnswered(question, answers));

    if (firstMissingInSection) {
      setValidationMessage(`Please complete: ${firstMissingInSection.label}`);
      return;
    }

    nextSection();
  };

  const prevQuestion = () => {
    prevSection();
  };

  const sectionQuestionCount = isRedFlagSection ? 1 : visibleQuestions.length;
  const sectionProgress = useMemo(() => {
    let totalVisibleQuestions = 0;
    let totalAnsweredQuestions = 0;

    for (let index = 0; index < workflowSections.length; index += 1) {
      const questions = getSectionQuestions(index);
      totalVisibleQuestions += questions.length;
      totalAnsweredQuestions += questions.filter((question) => isQuestionMeaningfullyAnswered(question, answers)).length;
    }

    return {
      totalVisibleQuestions,
      totalAnsweredQuestions,
    };
  }, [answers, getSectionQuestions, workflowSections.length]);

  const targetTotalMinutes = 5;
  const completionRatio =
    sectionProgress.totalVisibleQuestions === 0
      ? 0
      : sectionProgress.totalAnsweredQuestions / sectionProgress.totalVisibleQuestions;
  const estimatedMinutesSpent = Math.min(targetTotalMinutes, Math.round(completionRatio * targetTotalMinutes));
  const estimatedMinutesRemaining = Math.max(0, Math.round((1 - completionRatio) * targetTotalMinutes));
  const hasConsent = answers.reviewConsent === true;
  const patientDisplayName = String(answers.patientName ?? "").trim() || "Patient";
  const requiredQuestions = useMemo(
    () => workflowSections.flatMap((_, index) => getSectionQuestions(index).filter((question) => question.required)),
    [getSectionQuestions, workflowSections],
  );
  const missingRequiredQuestions = requiredQuestions.filter((question) => !isQuestionAnswered(question, answers));
  const requiredComplete = missingRequiredQuestions.length === 0;
  const patientCompletion = Math.round(completionRatio * 100);
  const sectionJourneyCompletion = Math.round(((sectionIndex + 1) / workflowSections.length) * 100);
  const currentSectionCard = sectionCards[sectionIndex];
  const currentSectionAnswered = currentSectionCard?.answeredCount ?? 0;
  const currentSectionTotal = currentSectionCard?.visibleCount ?? sectionQuestionCount;
  const nextSectionTitle = sectionCards[sectionIndex + 1]?.title;
  const answeredForSummary = sectionProgress.totalAnsweredQuestions;
  const submittedSummaryCards = [
    { label: "Visit reason", value: summarizeQuestionAnswer(workflowSections, "consultReason", answers.consultReason) },
    { label: "Main concern", value: summarizeQuestionAnswer(workflowSections, "mainConcern", answers.mainConcern) },
    { label: "Pain score", value: summarizeQuestionAnswer(workflowSections, "painScore", answers.painScore) },
    { label: "Pain location", value: summarizeQuestionAnswer(workflowSections, "painLocation", answers.painLocation) },
    { label: "Duration", value: answers.symptomDuration ? `${summarizeAnswer(answers.symptomDuration)} days` : "Not filled" },
    { label: "Treatment goal", value: summarizeQuestionAnswer(workflowSections, "careGoal", answers.careGoal) },
  ];
  const doctorReadyItems = [
    `Reason for visit: ${summarizeQuestionAnswer(workflowSections, "consultReason", answers.consultReason)}`,
    `Current concern: ${summarizeQuestionAnswer(workflowSections, "mainConcern", answers.mainConcern)}`,
    `Red flag screen: ${redFlagTriggered ? "Clinic attention needed" : "No urgent red flags reported"}`,
    `Reports available: ${summarizeQuestionAnswer(workflowSections, "reportsWithPatient", answers.reportsWithPatient)}`,
    `Patient goal: ${summarizeQuestionAnswer(workflowSections, "careGoal", answers.careGoal)}`,
  ];

  const setValue = (key: string, value: AnswerValue) =>
    setAnswers((current) => {
      const nextAnswers = { ...current, [key]: value };
      setValidationMessage("");

      if (key === "redFlagNone" && Boolean(value)) {
        for (const redFlagKey of redFlagKeys) {
          nextAnswers[redFlagKey] = false;
        }
      }

      if (redFlagKeys.includes(key) && Boolean(value)) {
        nextAnswers.redFlagNone = false;
      }

      if (redFlagKeys.includes(key) && !Boolean(value)) {
        const allRedFlagsAnsweredNo = redFlagKeys.every((redFlagKey) => nextAnswers[redFlagKey] === false);
        if (allRedFlagsAnsweredNo) {
          nextAnswers.redFlagNone = true;
        }
      }

      return nextAnswers;
    });

  const toggleMultiSelectValue = (question: (typeof visibleQuestions)[number], optionValue: string) => {
    const currentAnswer = answers[question.id];
    const currentValues = Array.isArray(currentAnswer) ? currentAnswer : currentAnswer ? [String(currentAnswer)] : [];
    const isSelected = currentValues.includes(optionValue);
    let nextValues = isSelected ? currentValues.filter((value) => value !== optionValue) : [...currentValues, optionValue];

    if (optionValue === "none" && !isSelected) {
      nextValues = ["none"];
    } else if (optionValue !== "none") {
      nextValues = nextValues.filter((value) => value !== "none");
    }

    setValue(question.id, nextValues);
  };

  const saveDraft = (nextSubmitted = submitted) => {
    const record = {
      sessionId,
      patientPhone,
      answers,
      sectionIndex,
      questionIndex,
      submitted: nextSubmitted,
      updatedAt: new Date().toISOString(),
    };

    latestDraftRef.current = { sessionId, patientPhone, answers, sectionIndex, questionIndex, submitted: nextSubmitted };
    persistDraft(record);
  };

  const submitQuestionnaire = () => {
    if (!requiredComplete) {
      const firstMissing = missingRequiredQuestions[0];

      for (let index = 0; index < workflowSections.length; index += 1) {
        const sectionQuestions = getSectionQuestions(index);
        const targetQuestionIndex = sectionQuestions.findIndex((question) => question.id === firstMissing.id);

        if (targetQuestionIndex >= 0) {
          setSectionIndex(index);
          setQuestionIndex(targetQuestionIndex);
          break;
        }
      }

      setValidationMessage(`Please complete: ${firstMissing.label}`);
      return;
    }

    setSubmitted(true);
    saveDraft(true);
  };

  const renderRedFlagSection = () => (
    <article className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Urgent safety check</div>
          <h2 className="headline mt-1.5 text-xl font-semibold leading-tight sm:text-2xl">Do any of these urgent red flags apply?</h2>
          <p className="mt-1 text-xs leading-6 text-[color:var(--muted)]">
            Answer each item Yes or No, or choose None of the above if none apply.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[rgba(21,32,43,0.1)] bg-white">
        {redFlagOptions.map((question) => (
          <div key={question.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(120px,0.42fr)] items-center gap-2 border-b border-[rgba(21,32,43,0.08)] px-3 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.32fr)] sm:gap-3">
            <div className="min-w-0 text-sm font-medium leading-6 text-[color:var(--foreground)] [overflow-wrap:anywhere]">{question.label}</div>
            <select
              aria-label={question.label}
              value={typeof answers[question.id] === "boolean" ? String(answers[question.id]) : ""}
              onChange={(event) => setValue(question.id, event.target.value === "true")}
              className="focus-ring min-w-0 max-w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Select</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        ))}
      </div>

      {redFlagNoneQuestion ? (
        <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(120px,0.42fr)] items-center gap-2 rounded-xl border border-[rgba(21,32,43,0.1)] bg-white px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.32fr)] sm:gap-3">
          <div className="min-w-0 text-sm font-medium leading-6 text-[color:var(--foreground)] [overflow-wrap:anywhere]">{redFlagNoneQuestion.label}</div>
          <select
            aria-label={redFlagNoneQuestion.label}
            value={answers.redFlagNone === true ? "true" : ""}
            onChange={(event) => setValue(redFlagNoneQuestion.id, event.target.value === "true")}
            className="focus-ring min-w-0 max-w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 text-sm outline-none"
          >
            <option value="">Select</option>
            <option value="true">None of the above</option>
          </select>
        </div>
      ) : null}

      {redFlagReasonQuestion ? (
        <div className={`mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(120px,0.42fr)] items-start gap-2 rounded-xl border px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.46fr)] sm:gap-3 ${redFlagTriggered ? "border-[rgba(255,138,91,0.24)] bg-[rgba(255,138,91,0.08)]" : "border-[rgba(21,32,43,0.08)] bg-[rgba(21,32,43,0.03)]"}`}>
          <div className="min-w-0">
            <label className="text-sm font-medium leading-6 text-[color:var(--foreground)]" htmlFor="redFlagReason">
              {redFlagReasonQuestion.label}
            </label>
            <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
              Add details only if you want the clinic to see them before the consultation.
            </p>
          </div>
          <div className="min-w-0">
            <textarea
              id="redFlagReason"
              aria-label={redFlagReasonQuestion.label}
              disabled={!redFlagTriggered}
              value={String(answers.redFlagReason ?? "")}
              onChange={(event) => setValue(redFlagReasonQuestion.id, event.target.value)}
              rows={3}
              placeholder={redFlagTriggered ? "Enter urgent details" : "Enabled after Yes"}
              className="focus-ring min-w-0 max-w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:bg-[rgba(21,32,43,0.05)] disabled:text-[color:var(--muted)]"
            />
          </div>
        </div>
      ) : null}

      {validationMessage ? <p className="mt-3 text-sm font-semibold text-[color:#a34722]">{validationMessage}</p> : null}
    </article>
  );

  const renderQuestionInput = (question: (typeof visibleQuestions)[number]) => {
    if (question.type === "toggle") {
      return (
        <select
          aria-label={question.label}
          value={typeof answers[question.id] === "boolean" ? String(answers[question.id]) : ""}
          onChange={(event) => setValue(question.id, event.target.value === "true")}
          className="focus-ring min-w-0 max-w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 text-sm outline-none"
        >
          <option value="">Select</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    if (question.type === "multi-select") {
      const currentAnswer = answers[question.id];
      const selectedValues = Array.isArray(currentAnswer) ? currentAnswer : currentAnswer ? [String(currentAnswer)] : [];
      const selectedLabels = selectedValues
        .map((value) => question.options?.find((option) => option.value === value)?.label ?? value)
        .filter(Boolean);

      return (
        <details className="group relative min-w-0">
          <summary className="focus-ring flex min-w-0 max-w-full cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 text-sm outline-none [&::-webkit-details-marker]:hidden">
            <span className={`min-w-0 truncate ${selectedLabels.length ? "text-[color:var(--foreground)]" : "text-[color:var(--muted)]"}`}>
              {selectedLabels.length ? selectedLabels.join(", ") : "Select one or more"}
            </span>
            <span className="shrink-0 text-[10px] font-semibold text-[color:var(--muted)] group-open:rotate-180">⌄</span>
          </summary>
          <div className="absolute right-0 z-30 mt-2 max-h-72 w-full min-w-[min(18rem,calc(100vw-2rem))] overflow-auto rounded-xl border border-[rgba(21,32,43,0.12)] bg-white p-2 shadow-[0_18px_45px_rgba(21,32,43,0.16)]">
            {question.options?.map((option) => {
              const checked = selectedValues.includes(option.value);

              return (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm leading-5 text-[color:var(--foreground)] hover:bg-[rgba(15,118,110,0.06)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMultiSelectValue(question, option.value)}
                    className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{option.label}</span>
                </label>
              );
            })}
          </div>
        </details>
      );
    }

    if (question.type === "radio" || question.type === "select") {
      return (
        <select
          aria-label={question.label}
          value={String(answers[question.id] ?? "")}
          onChange={(event) => setValue(question.id, event.target.value)}
          className="focus-ring min-w-0 max-w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 text-sm outline-none"
        >
          <option value="">Select an option</option>
          {question.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (question.type === "range") {
      return (
        <select
          aria-label={question.label}
          value={answers[question.id] === undefined ? "" : String(answers[question.id])}
          onChange={(event) => setValue(question.id, Number(event.target.value))}
          className="focus-ring min-w-0 max-w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 text-sm outline-none"
        >
          <option value="">Select score</option>
          {Array.from({ length: 11 }, (_, score) => (
            <option key={score} value={score}>
              {score}
            </option>
          ))}
        </select>
      );
    }

    if (question.type === "info-link") {
      return (
        <input
          aria-label={question.label}
          readOnly
          value={bmi ?? "Pending"}
          className="focus-ring min-w-0 max-w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-[rgba(21,32,43,0.04)] px-3 py-2.5 text-sm text-[color:var(--muted)] outline-none"
        />
      );
    }

    if (question.type === "textarea") {
      return (
        <textarea
          aria-label={question.label}
          value={String(answers[question.id] ?? "")}
          onChange={(event) => setValue(question.id, event.target.value)}
          rows={4}
          placeholder="Enter details"
          className="focus-ring min-w-0 max-w-full rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 text-sm outline-none"
        />
      );
    }

    return (
      <input
        aria-label={question.label}
        value={String(answers[question.id] ?? "")}
        onChange={(event) => setValue(question.id, question.type === "number" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)}
        type={question.type === "number" ? "number" : question.type === "tel" ? "tel" : question.type === "date" ? "date" : question.type === "time" ? "time" : "text"}
        inputMode={question.type === "number" ? "numeric" : question.type === "tel" ? "tel" : undefined}
        placeholder="Enter answer"
        className="focus-ring min-w-0 max-w-full rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 text-sm outline-none"
      />
    );
  };

  const renderSectionForm = () => {
    if (isRedFlagSection) {
      return renderRedFlagSection();
    }

    if (visibleQuestions.length === 0) {
      return (
        <div className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-white px-3 py-3 text-xs text-[color:var(--muted)]">
          No visible questions in this section for current answers.
        </div>
      );
    }

    return (
      <div className="min-w-0 overflow-hidden rounded-xl border border-[rgba(21,32,43,0.08)] bg-white shadow-sm">
        {visibleQuestions.map((question) => (
          <div key={question.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(120px,0.78fr)] items-start gap-2 border-b border-[rgba(21,32,43,0.08)] px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(240px,0.72fr)] sm:gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {question.required ? <span className="rounded-full bg-[rgba(255,138,91,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[color:#a34722]">Required</span> : null}
                {question.linkedFrom ? <span className="rounded-full bg-[rgba(15,118,110,0.08)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">Linked</span> : null}
              </div>
              <label className="mt-1 block text-sm font-medium leading-6 text-[color:var(--foreground)] [overflow-wrap:anywhere]">
                {question.label}
              </label>
              {question.helpText ? <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{question.helpText}</p> : null}
            </div>
            <div className="min-w-0">{renderQuestionInput(question)}</div>
          </div>
        ))}
        {validationMessage ? <p className="text-sm font-semibold text-[color:#a34722]">{validationMessage}</p> : null}
      </div>
    );
  };

  if (submitted) {
    return (
      <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.9)] shadow-[0_24px_80px_rgba(21,32,43,0.12)]">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,rgba(15,118,110,0.16),rgba(255,138,91,0.14)_55%,rgba(255,255,255,0.65))] p-6 sm:p-8 lg:p-10">
          <div className="absolute left-0 top-0 h-full w-full opacity-60 [background-image:linear-gradient(120deg,rgba(15,118,110,0.16)_0_12px,transparent_12px_32px),linear-gradient(60deg,rgba(255,138,91,0.16)_0_10px,transparent_10px_30px)]" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {celebrationConfetti.map((piece) => (
              <span
                key={`${piece.left}-${piece.delay}`}
                className="confetti-piece"
                style={{
                  "--confetti-left": piece.left,
                  "--confetti-delay": piece.delay,
                  "--confetti-color": piece.color,
                  "--confetti-size": piece.size,
                  "--confetti-drift": piece.drift,
                  "--confetti-rotate": piece.rotate,
                } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute right-6 top-6 hidden h-28 w-28 rounded-full border border-white/70 bg-white/35 shadow-[0_18px_40px_rgba(15,118,110,0.16)] backdrop-blur sm:block" aria-hidden="true">
            <div className="absolute inset-4 rounded-full border border-[rgba(15,118,110,0.16)]" />
            <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(15,118,110,0.12)]" />
          </div>
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <span className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent)] shadow-sm">
                Cheers, {patientDisplayName}
              </span>
              <h1 className="headline mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
                Congratulations, your health story is ready for the doctor.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-8 text-[color:var(--foreground)]">
                Thank you for completing this before the consultation. Your answers give the doctor a faster, clearer starting point so the visit can focus on decisions, reassurance, and next steps.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-[1.5rem] bg-white/80 p-3 shadow-sm backdrop-blur">
              <div className="rounded-2xl bg-[rgba(15,118,110,0.08)] p-3 text-center">
                <div className="headline text-3xl font-semibold text-[var(--accent)]">{answeredForSummary}</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">answers captured</div>
              </div>
              <div className="rounded-2xl bg-[rgba(255,138,91,0.12)] p-3 text-center">
                <div className="headline text-3xl font-semibold text-[color:#a34722]">8-10</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">minutes prepared</div>
              </div>
              <div className="rounded-2xl bg-[rgba(21,32,43,0.04)] p-3 text-center">
                <div className="headline text-3xl font-semibold text-[color:var(--foreground)]">{redFlagTriggered ? "Yes" : "Clear"}</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">red flag screen</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[0.92fr_1.08fr] lg:p-8">
          <section className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">What your doctor can now see</div>
            <div className="mt-4 space-y-3">
              {doctorReadyItems.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-[rgba(15,118,110,0.05)] px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-[rgba(255,138,91,0.22)] bg-[rgba(255,138,91,0.1)] p-4 text-sm leading-6 text-[color:var(--foreground)]">
              This helps reduce repeat history-taking and gives both you and the doctor more room for the actual consultation conversation.
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Visit summary</div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">Session ID: {sessionId}</div>
              </div>
              <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]">
                Ready for review
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">Patient</div>
                <div className="mt-1 font-semibold text-[color:var(--foreground)]">{summarizeAnswer(answers.patientName)}</div>
              </div>
              <div className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">BMI</div>
                <div className="mt-1 font-semibold text-[color:var(--foreground)]">{bmi ?? "Pending"}</div>
              </div>
              {submittedSummaryCards.map((item) => (
                <div key={item.label} className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3 text-sm sm:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">{item.label}</div>
                  <div className="mt-1 font-semibold leading-6 text-[color:var(--foreground)]">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  saveDraft(false);
                }}
                className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-4 py-2.5 text-sm font-semibold"
              >
                Edit answers
              </button>
              <div className="rounded-full bg-[rgba(15,118,110,0.06)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)]">
                Thank you. We will take it from here.
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-20 rounded-2xl border border-[rgba(21,32,43,0.08)] bg-[rgba(255,255,255,0.96)] px-3 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-[color:var(--muted)]">{patientDisplayName}</div>
            <div className="text-sm font-semibold text-[color:var(--foreground)]">{patientCompletion}% complete</div>
          </div>
          <div className="text-right text-xs text-[color:var(--muted)]">
            <div>Section {sectionIndex + 1} / {workflowSections.length}</div>
            <div>{estimatedMinutesSpent} min done • {estimatedMinutesRemaining} min left</div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[rgba(15,118,110,0.14)] bg-[rgba(15,118,110,0.06)] p-3 sm:hidden">
          <div className="flex items-start gap-2">
            <button
              type="button"
              aria-label="Previous section"
              onClick={prevQuestion}
              disabled={sectionIndex === 0}
              className="focus-ring mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[rgba(21,32,43,0.12)] bg-white text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              &lt;
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[var(--accent)] shadow-sm">
                  <SectionIcon sectionId={section.id} className="h-4 w-4" />
                </span>
                <span>Chapter {sectionIndex + 1} of {workflowSections.length}</span>
              </div>
              <div className="mt-1 text-base font-semibold leading-snug text-[color:var(--foreground)] [overflow-wrap:anywhere]">
                {section.title}
              </div>
              <div className="mt-1 text-xs leading-5 text-[color:var(--muted)] [overflow-wrap:anywhere]">
                {section.subtitle}
              </div>
            </div>

            <button
              type="button"
              aria-label="Next section"
              onClick={nextQuestion}
              disabled={sectionIndex === workflowSections.length - 1}
              className="focus-ring mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              &gt;
            </button>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${sectionJourneyCompletion}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-medium text-[color:var(--muted)]">
            <span>{currentSectionAnswered}/{currentSectionTotal} answered here</span>
            <span>{sectionJourneyCompletion}% journey</span>
          </div>
          {nextSectionTitle ? (
            <div className="mt-2 truncate rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-[color:var(--muted)]">
              Next: {nextSectionTitle}
            </div>
          ) : null}
        </div>

        <div className="mt-3 hidden items-center gap-2 sm:flex">
          <button
            type="button"
            aria-label="Previous section"
            onClick={prevQuestion}
            disabled={sectionIndex === 0}
            className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[rgba(21,32,43,0.12)] bg-white text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            &lt;
          </button>

          <div className="grid min-w-0 flex-1 grid-cols-12 gap-1.5">
            {sectionCards.map((item, index) => {
              const completed = item.answeredCount >= item.visibleCount && item.visibleCount > 0;
              const inProgress = item.answeredCount > 0 && !completed;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Go to ${item.title}`}
                  title={item.title}
                  onClick={() => goToSection(index)}
                  className={`focus-ring h-3 rounded-full transition ${item.active ? "bg-[var(--accent)] ring-2 ring-[rgba(15,118,110,0.24)]" : completed ? "bg-[rgba(15,118,110,0.45)]" : inProgress ? "bg-[color:#f6a44d]" : "bg-[rgba(21,32,43,0.14)]"}`}
                />
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Next section"
            onClick={nextQuestion}
            disabled={sectionIndex === workflowSections.length - 1}
            className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            &gt;
          </button>
        </div>

        <div className="mt-2 hidden h-1.5 overflow-hidden rounded-full bg-[rgba(21,32,43,0.08)] sm:block">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${sectionJourneyCompletion}%` }} />
        </div>
      </div>

      <section ref={questionAreaRef} className="rounded-[1.1rem] border border-white/70 bg-[rgba(255,255,255,0.9)] p-3.5 shadow-[0_20px_60px_rgba(21,32,43,0.12)] sm:rounded-[1.75rem] sm:p-4 lg:p-8">

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] sm:px-3 sm:py-1.5 sm:text-xs">
              Confidential patient document
            </span>
            <div className="mt-2 flex min-w-0 items-center gap-3 sm:mt-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[rgba(15,118,110,0.14)] bg-[rgba(15,118,110,0.08)] text-[var(--accent)] shadow-sm sm:h-14 sm:w-14 sm:rounded-[1.25rem]">
                <SectionIcon sectionId={section.id} className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <h1 className="headline min-w-0 text-xl font-semibold leading-tight [overflow-wrap:anywhere] sm:text-4xl">{section.title}</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[color:var(--muted)] sm:mt-1.5 sm:text-sm sm:leading-6">{section.subtitle}</p>
            <div className="mt-2 text-xs font-medium text-[color:var(--muted)]">
              {sectionQuestionCount} question{sectionQuestionCount === 1 ? "" : "s"} in this section • about {estimatedMinutesRemaining} min left
            </div>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[rgba(21,32,43,0.08)]">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${patientCompletion}%` }} />
        </div>

        {redFlagTriggered && section.id === "red-flags" ? (
          <div className="mt-4 rounded-xl border border-[rgba(255,138,91,0.24)] bg-[rgba(255,138,91,0.12)] p-3 text-xs leading-6 text-[color:var(--foreground)]">
            One or more red flags are positive. The clinic should review this case before continuing routine intake.
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">{renderSectionForm()}</div>

        <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              aria-label="Previous section"
              onClick={prevQuestion}
              disabled={sectionIndex === 0}
              className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous section
            </button>
            <button
              type="button"
              aria-label="Next section"
              onClick={nextQuestion}
              disabled={sectionIndex === workflowSections.length - 1}
              className="focus-ring rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next section
            </button>
        </div>
      </section>

        <div className="pt-1">
          {!requiredComplete ? (
            <p className="mb-2 text-xs text-[color:var(--muted)]">
              Complete required answers before submitting. Remaining: {missingRequiredQuestions.length}
            </p>
          ) : !hasConsent ? (
            <p className="mb-2 text-xs text-[color:var(--muted)]">
              Please accept the consent statement in the final section before review.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={submitQuestionnaire}
              disabled={!requiredComplete}
              className={`focus-ring w-full rounded-full border px-4 py-2.5 text-sm font-semibold sm:w-auto ${requiredComplete ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "cursor-not-allowed border-[rgba(21,32,43,0.12)] bg-[rgba(21,32,43,0.08)] text-[color:var(--muted)]"}`}
            >
              Submit for clinical review
            </button>
            <p className="text-xs font-medium text-[color:var(--muted)]">
              Draft autosaves as you answer. Use the same session link to resume.
            </p>
          </div>
        </div>
    </div>
  );
}