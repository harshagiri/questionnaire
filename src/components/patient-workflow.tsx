"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { patientWorkflowSections, preConsultSections } from "@/lib/workflow-data";
import type { PatientQuestionContent, PatientQuestionnaireRecord } from "@/lib/patient-questionnaire-db";
import { calculateBmi, summarizeAnswer } from "@/lib/questionnaire";
import { findPatientRecordByPhone, savePatientQuestionnaire } from "@/lib/portal-storage";

type AnswerValue = string | number | boolean | string[];
type AnswerMap = Record<string, AnswerValue>;
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

function getSectionIntro(sectionId: string, sectionTitle: string) {
  switch (sectionId) {
    case "red-flags":
      return {
        kicker: "Safety first",
        title: "Before we dive in, let’s check the smoke alarm.",
        body:
          "A quick safety check is a bit like glancing at the dashboard before driving off. If a warning light is on, you want to know before the engine starts complaining.",
        summary: "This section checks for anything urgent that should be escalated before the rest of the visit.",
        buttonLabel: "Start safety check",
      };
    case "patient-profile":
      return {
        kicker: "A quick hello",
        title: "Let’s pin down the basics.",
        body:
          "This is the part where the form learns who you are, so the doctor does not have to do an awkward ‘Now, who are we meeting today?’ routine.",
        summary: "This section captures your identity, contact details, and the quick facts the clinic needs to reach you.",
        buttonLabel: "Start profile",
      };
    case "medical-history":
      return {
        kicker: "Background check",
        title: "A little context goes a long way.",
        body:
          "Old health facts can change the whole script. A blood pressure issue, diabetes, or a previous surgery can turn a simple plan into a very different one.",
        summary: "This section gathers the health history that can change how today’s symptoms are interpreted.",
        buttonLabel: "Start medical history",
      };
    case "previous-reports":
      return {
        kicker: "Paper trail",
        title: "Let’s see what clues you brought with you.",
        body:
          "Reports are the breadcrumbs that keep everyone from wandering into the forest of ‘maybe it’s this, maybe it’s that.’ One look can save a lot of guesswork.",
        summary: "This section collects reports, scans, and notes that help the doctor connect the dots faster.",
        buttonLabel: "Start reports",
      };
    case "diagnosis-understanding":
      return {
        kicker: "What you were told",
        title: "We’re checking the story you were given before.",
        body:
          "A diagnosis can travel through too many hands and come back wearing a different hat. This helps the doctor compare the original story with what you heard.",
        summary: "This section captures the diagnosis or explanation you were given, so the visit starts from the same page.",
        buttonLabel: "Start diagnosis check",
      };
    case "current-problem":
      return {
        kicker: "Main complaint",
        title: "Now we get to the main character.",
        body:
          "Every visit has a main character, and this is it. If the spine problem were a movie, this would be the scene where the plot finally makes sense.",
        summary: "This section tells the doctor what is bothering you most and what brought you in today.",
        buttonLabel: "Start main complaint",
      };
    case "pain-behaviour":
      return {
        kicker: "Pain map",
        title: "Let’s find the mischief maker on the map.",
        body:
          "Pain likes to play hide-and-seek in inconvenient places. The map helps the doctor stop guessing where the trouble is hiding.",
        summary: "This section shows exactly where the pain lives and how it spreads around the body.",
        buttonLabel: "Start pain map",
      };
    case "symptom-severity":
      return {
        kicker: "How loud it feels",
        title: "Now let’s measure how much the trouble is shouting.",
        body:
          "A pain score is the fastest way to tell whether this is a whisper, a grumble, or a full brass band. That helps the doctor judge urgency without needing a drama degree.",
        summary: "This section captures how strong the symptoms feel right now and how intense the discomfort is.",
        buttonLabel: "Start severity",
      };
    case "neurological-symptoms":
      return {
        kicker: "Nerves and signals",
        title: "We’re checking the wires.",
        body:
          "Numbness and weakness are the body’s version of a bad Wi-Fi signal. This section helps the doctor tell the difference between a wobble and a warning.",
        summary: "This section checks for numbness, weakness, and other nerve-related warning signs.",
        buttonLabel: "Start nerve check",
      };
    case "functional-disability":
      return {
        kicker: "Day-to-day life",
        title: "Let’s see what the pain is bossing around.",
        body:
          "Pain has a nasty habit of acting like a tiny manager. These answers show whether it’s only being annoying, or whether it’s running the whole office.",
        summary: "This section shows how the symptoms are affecting your walking, sleep, work, and everyday tasks.",
        buttonLabel: "Start daily function",
      };
    case "previous-treatment":
      return {
        kicker: "What you’ve tried",
        title: "We’re checking the treatment trail.",
        body:
          "Nobody wants the same treatment remix on repeat. This section shows what already helped, what did not, and what deserves a firmer handshake next time.",
        summary: "This section records what treatments, exercises, or medicines you have already tried.",
        buttonLabel: "Start treatment history",
      };
    case "concerns-goals":
      return {
        kicker: "Closing thoughts",
        title: "Almost there, just the patient side of the story.",
        body:
          "This is the part where we ask what you’re worried about and what you want most from the visit. It helps the doctor aim at the right finish line, not just any finish line.",
        summary: "This section captures your concerns, goals, and what you hope this visit will fix.",
        buttonLabel: "Start final section",
      };
    default:
      return {
        kicker: "Section start",
        title: sectionTitle,
        body: "Let’s open this section and keep moving through the questions.",
        summary: "This section gathers the details the doctor needs to understand this part of the story.",
        buttonLabel: "Start section",
      };
  }
}

function formatDisplayLabel(label: string) {
  return label.trim();
}

function progressMood(percent: number) {
  if (percent >= 90) {
    return "Brilliant pace. You are almost consultation-ready.";
  }

  if (percent >= 75) {
    return "Excellent progress. Just a quick final stretch.";
  }

  if (percent >= 50) {
    return "Great momentum. You are past the halfway mark.";
  }

  if (percent >= 25) {
    return "Nice start. Your doctor will thank you for this clarity.";
  }

  return "Strong start. Each answer helps your doctor prepare better.";
}

function milestoneLabel(percent: number) {
  if (percent >= 75) {
    return "Milestone unlocked: 75% complete";
  }

  if (percent >= 50) {
    return "Milestone unlocked: halfway done";
  }

  if (percent >= 25) {
    return "Milestone unlocked: great start";
  }

  return "Your care journey has begun";
}

type SectionVisual = {
  emoji: string;
  iconLabel: string;
  spotlight: string;
  imageSrc: string;
  imageAlt: string;
};

function getSectionVisual(sectionId: string): SectionVisual {
  switch (sectionId) {
    case "red-flags":
      return {
        emoji: "🚦",
        iconLabel: "Safety",
        spotlight: "Why this matters: this is your emergency brake check; red flags here can change triage immediately.",
        imageSrc: "/illustrations/section-celebration.svg",
        imageAlt: "Safety and section progress illustration",
      };
    case "patient-profile":
      return {
        emoji: "🪪",
        iconLabel: "Profile",
        spotlight: "Why this matters: boring admin, heroic impact; correct identity and demographics prevent wrong-path decisions.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Patient profile context illustration",
      };
    case "medical-history":
      return {
        emoji: "🩺",
        iconLabel: "History",
        spotlight: "Why this matters: your medical backstory is the plot twist; diabetes, thyroid, or prior issues change the plan.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Medical history relevance illustration",
      };
    case "previous-reports":
      return {
        emoji: "🧾",
        iconLabel: "Reports",
        spotlight: "Why this matters: old scans are cheat codes; they reduce repeat tests and sharpen decisions faster.",
        imageSrc: "/illustrations/section-celebration.svg",
        imageAlt: "Previous reports relevance illustration",
      };
    case "diagnosis-understanding":
      return {
        emoji: "🧠",
        iconLabel: "Diagnosis",
        spotlight: "Why this matters: same words, different meanings; this aligns what you heard with what symptoms now show.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Diagnosis understanding relevance illustration",
      };
    case "current-problem":
      return {
        emoji: "🎯",
        iconLabel: "Current issue",
        spotlight: "Why this matters: this picks the main villain; your top complaint sets consultation priority and focus.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Current problem relevance illustration",
      };
    case "pain-behaviour":
      return {
        emoji: "🧭",
        iconLabel: "Pain map",
        spotlight: "Why this matters: pain behavior is a map, not drama; location and spread narrow likely causes.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Care journey illustration",
      };
    case "symptom-severity":
      return {
        emoji: "📈",
        iconLabel: "Severity",
        spotlight: "Why this matters: severity scores are your speedometer; they guide urgency and track if treatment is working.",
        imageSrc: "/illustrations/section-celebration.svg",
        imageAlt: "Symptom severity relevance illustration",
      };
    case "neurological-symptoms":
      return {
        emoji: "🧬",
        iconLabel: "Neurology",
        spotlight: "Why this matters: numbness and weakness are nerve warning lights; this section checks neurological risk early.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Neurological symptoms relevance illustration",
      };
    case "functional-disability":
      return {
        emoji: "🚶",
        iconLabel: "Function",
        spotlight: "Why this matters: pain is one thing, life impact is another; function limits reveal real-world severity.",
        imageSrc: "/illustrations/section-celebration.svg",
        imageAlt: "Functional disability relevance illustration",
      };
    case "previous-treatment":
      return {
        emoji: "💊",
        iconLabel: "Treatment history",
        spotlight: "Why this matters: no reruns please; what helped or failed shapes smarter next-step treatment.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Previous treatment relevance illustration",
      };
    case "concerns-goals":
      return {
        emoji: "🌼",
        iconLabel: "Final focus",
        spotlight: "Why this matters: this is your wishlist with clinical intent; goals align treatment with what matters to you.",
        imageSrc: "/illustrations/completion-bloom.svg",
        imageAlt: "Completion bloom illustration",
      };
    case "primary-complaint":
      return {
        emoji: "🎯",
        iconLabel: "Complaint",
        spotlight: "Why this matters: this section picks the lane early; complaint type routes the rest of the questionnaire correctly.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Primary complaint routing illustration",
      };
    case "symptom-details":
      return {
        emoji: "🕒",
        iconLabel: "Symptom details",
        spotlight: "Why this matters: duration, onset, and trend are the timeline clues; they separate flare-ups from progressive problems.",
        imageSrc: "/illustrations/section-celebration.svg",
        imageAlt: "Symptom details timeline illustration",
      };
    case "neuro-screen":
      return {
        emoji: "🧠",
        iconLabel: "Neuro screen",
        spotlight: "Why this matters: think of this as the nerve systems check; it flags early neurological risk before it worsens.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Neurological screening illustration",
      };
    case "mechanical-treatment":
      return {
        emoji: "🛠️",
        iconLabel: "Mechanics",
        spotlight: "Why this matters: what worsens or relieves pain reveals mechanical patterns and guides targeted treatment choices.",
        imageSrc: "/illustrations/section-celebration.svg",
        imageAlt: "Mechanical pattern and treatment illustration",
      };
    case "function-domains":
      return {
        emoji: "📏",
        iconLabel: "Function score",
        spotlight: "Why this matters: these functional domains quantify daily impact, not just pain intensity, for better baseline scoring.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Function domain scoring illustration",
      };
    case "adaptive-tail":
      return {
        emoji: "🧩",
        iconLabel: "Adaptive path",
        spotlight: "Why this matters: this smart tail asks neck- or back-specific questions so your data stays relevant, not repetitive.",
        imageSrc: "/illustrations/section-celebration.svg",
        imageAlt: "Adaptive questionnaire path illustration",
      };
    case "outcome-myelopathy":
      return {
        emoji: "🌉",
        iconLabel: "Outcome",
        spotlight: "Why this matters: this creates your baseline bridge for follow-up and checks higher-risk neck signs when needed.",
        imageSrc: "/illustrations/completion-bloom.svg",
        imageAlt: "Outcome baseline and myelopathy check illustration",
      };
    default:
      return {
        emoji: "✨",
        iconLabel: "Journey",
        spotlight: "Why this matters: every section here adds a useful clue so the doctor can decide faster and safer.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Patient care journey illustration",
      };
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
        options: (override.options ?? question.options)?.map((option) => ({
          ...option,
          label: option.label,
        })),
      };
    }),
  }));
}

function getVisibleQuestions(sections: WorkflowSections, sectionIndex: number, answers: AnswerMap) {
  const section = sections[sectionIndex];
  if (!section) {
    return [];
  }

  return section.questions.filter((question) =>
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

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function PatientWorkflow({
  sessionId,
  initialQuestionContent = [],
  initialSavedWorkflow = null,
  mode = "full",
  dashboardHref,
}: {
  sessionId: string;
  initialQuestionContent?: PatientQuestionContent[];
  initialSavedWorkflow?: PatientQuestionnaireRecord | null;
  mode?: "full" | "pre-consult";
  dashboardHref?: string;
}) {
  const workflowSections = useMemo(() => {
    if (mode === "pre-consult") return preConsultSections;
    return applyQuestionContentOverrides(initialQuestionContent);
  }, [initialQuestionContent, mode]);
  const registeredProfileDefaults = useMemo(() => {
    if (typeof window === "undefined") {
      return {} as Partial<AnswerMap>;
    }

    const profileRaw = window.localStorage.getItem(`sei-patient-profile:${sessionId}`) ?? window.localStorage.getItem("sei-patient-profile-latest");
    if (!profileRaw) {
      return {} as Partial<AnswerMap>;
    }

    try {
      const parsed = JSON.parse(profileRaw) as Partial<AnswerMap>;
      const resolvedPatientName = String(parsed.patientName ?? parsed.fullName ?? "").trim();

      return {
        ...parsed,
        ...(resolvedPatientName ? { patientName: resolvedPatientName } : {}),
      } as Partial<AnswerMap>;
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
  const [questionIndex, setQuestionIndex] = useState(-1);
  const [submitted, setSubmitted] = useState(false);
  const [sectionTransition, setSectionTransition] = useState<{ from: number; to: number } | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [profileBmi, setProfileBmi] = useState<number | null>(null);
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

    const maxSectionIndex = Math.max(workflowSections.length - 1, 0);
    const nextSectionIndex = Math.min(Math.max(saved.sectionIndex ?? 0, 0), maxSectionIndex);
    const sectionQuestions = getVisibleQuestions(
      workflowSections,
      nextSectionIndex,
      {
        ...initialAnswers,
        ...registeredProfileDefaults,
        ...(saved.answers ?? {}),
      } as AnswerMap,
    );
    const maxQuestionIndex = Math.max(sectionQuestions.length - 1, -1);
    const rawQuestionIndex = typeof saved.questionIndex === "number" ? saved.questionIndex : -1;
    const nextQuestionIndex = Math.min(Math.max(rawQuestionIndex, -1), maxQuestionIndex);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(() => ({
      ...initialAnswers,
      ...registeredProfileDefaults,
      ...(saved.answers ?? {}),
    } as AnswerMap));
    setSectionIndex(nextSectionIndex);
    setQuestionIndex(nextQuestionIndex);
    setSubmitted(Boolean(saved.submitted));
  }, [initialSavedWorkflow, registeredProfileDefaults, sessionId, workflowSections]);

  useEffect(() => {
    const currentName = String(answers.patientName ?? "").trim();
    if (currentName) {
      return;
    }

    const phone = normalizePhone(answers.phone ?? registeredProfileDefaults.phone);
    if (phone.length < 10) {
      return;
    }

    let cancelled = false;

    async function resolvePatientName() {
      try {
        const [patientResponse, appointmentResponse] = await Promise.all([
          fetch(`/api/patient-register?phone=${encodeURIComponent(phone)}`, { cache: "no-store" }),
          fetch(`/api/appointments?phone=${encodeURIComponent(phone)}`, { cache: "no-store" }),
        ]);

        const patientPayload = (await patientResponse.json().catch(() => null)) as
          | { ok?: boolean; record?: { fullName?: string } | null }
          | null;
        const appointmentPayload = (await appointmentResponse.json().catch(() => null)) as
          | { ok?: boolean; appointments?: Array<{ patientName?: string }> }
          | null;

        const resolvedName =
          (patientResponse.ok && patientPayload?.ok && String(patientPayload.record?.fullName ?? "").trim()) ||
          (appointmentResponse.ok && appointmentPayload?.ok && String(appointmentPayload.appointments?.[0]?.patientName ?? "").trim()) ||
          "";

        if (cancelled || !resolvedName) {
          return;
        }

        setAnswers((current) => (current.patientName ? current : { ...current, patientName: resolvedName }));

        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            `sei-patient-profile:${sessionId}`,
            JSON.stringify({
              ...registeredProfileDefaults,
              patientName: resolvedName,
              fullName: resolvedName,
              phone,
            }),
          );
        }
      } catch {
        // Ignore lookup errors and keep the form editable.
      }
    }

    void resolvePatientName();

    return () => {
      cancelled = true;
    };
  }, [answers.patientName, answers.phone, registeredProfileDefaults, sessionId]);

  useEffect(() => {
    const phone = normalizePhone(answers.phone ?? registeredProfileDefaults.phone);
    if (phone.length < 10) {
      return;
    }

    let cancelled = false;

    const applyMetrics = (record: { heightCm?: number | null; weightKg?: number | null; bmi?: number | null } | null | undefined) => {
      if (!record || cancelled) {
        return;
      }

      const profileHeight = typeof record.heightCm === "number" && record.heightCm > 0 ? record.heightCm : null;
      const profileWeight = typeof record.weightKg === "number" && record.weightKg > 0 ? record.weightKg : null;
      const profileCalculatedBmi =
        typeof record.bmi === "number" && record.bmi > 0
          ? record.bmi
          : profileHeight && profileWeight
            ? calculateBmi(profileWeight, profileHeight)
            : null;

      if (profileCalculatedBmi !== null) {
        setProfileBmi(profileCalculatedBmi);
      }

      setAnswers((current) => {
        const currentHeight = Number(current.heightCm);
        const currentWeight = Number(current.weightKg);
        const next: AnswerMap = { ...current };
        let changed = false;

        if ((!currentHeight || currentHeight <= 0) && profileHeight) {
          next.heightCm = profileHeight;
          changed = true;
        }
        if ((!currentWeight || currentWeight <= 0) && profileWeight) {
          next.weightKg = profileWeight;
          changed = true;
        }

        return changed ? next : current;
      });
    };

    applyMetrics(findPatientRecordByPhone(phone));

    async function resolveProfileMetrics() {
      try {
        const response = await fetch(`/api/patient-register?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; record?: { heightCm?: number | null; weightKg?: number | null; bmi?: number | null } | null }
          | null;

        if (!response.ok || !payload?.ok) {
          return;
        }

        applyMetrics(payload.record);
      } catch {
        // Ignore profile metric lookup errors; questionnaire remains usable.
      }
    }

    void resolveProfileMetrics();

    return () => {
      cancelled = true;
    };
  }, [answers.phone, registeredProfileDefaults.phone]);

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
        if (workflowSections[index]?.id === "symptom-severity") {
          return sectionQuestions.filter((question) => question.id !== "painScore");
        }
        return sectionQuestions;
      },
    [answers, workflowSections],
  );

  const safeSectionIndex = Math.min(Math.max(sectionIndex, 0), Math.max(workflowSections.length - 1, 0));
  const section = workflowSections[safeSectionIndex];
  const visibleQuestions = getSectionQuestions(safeSectionIndex);

  if (!section) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Questionnaire configuration is unavailable. Please return to the dashboard and try again.
      </div>
    );
  }

  const isRedFlagSection = section.id === "red-flags";
  const sectionQuestionCount = isRedFlagSection ? 1 : visibleQuestions.length;
  const isSectionIntro = questionIndex < 0;
  const currentQuestionIndex = Math.min(Math.max(questionIndex, 0), Math.max(sectionQuestionCount - 1, 0));
  const currentQuestion = visibleQuestions[currentQuestionIndex];
  const bmi = calculateBmi(Number(answers.weightKg), Number(answers.heightCm));
  const resolvedBmi = bmi ?? profileBmi;
  const redFlagTriggered = Boolean(
    answers.redFlagBladderBowel ||
      answers.redFlagRapidWeakness ||
      answers.redFlagTrauma ||
      answers.redFlagCancer ||
      answers.redFlagFever ||
      answers.redFlagWeightLoss,
  );
  const redFlagOptions = visibleQuestions.filter((question) => redFlagKeys.includes(question.id));
  const redFlagNoneQuestion = visibleQuestions.find((question) => question.id === "redFlagNone");
  const redFlagReasonQuestion = workflowSections[0]?.questions.find((question) => question.id === "redFlagReason");
  const redFlagPositiveQuestions = redFlagOptions.filter((question) => answers[question.id] === true);
  const redFlagSectionAnswered =
    answers.redFlagNone === true || redFlagKeys.every((redFlagKey) => typeof answers[redFlagKey] === "boolean");

  const findNextSectionWithQuestions = (fromIndex: number) => {
    for (let index = fromIndex + 1; index < workflowSections.length; index += 1) {
      if (getSectionQuestions(index).length > 0) {
        return index;
      }
    }

    return fromIndex;
  };

  const findPreviousSectionWithQuestions = (fromIndex: number) => {
    for (let index = fromIndex - 1; index >= 0; index -= 1) {
      if (getSectionQuestions(index).length > 0) {
        return index;
      }
    }

    return fromIndex;
  };

  const nextSection = () => {
    setSectionIndex((current) => findNextSectionWithQuestions(current));
    setQuestionIndex(-1);
  };

  const nextQuestion = () => {
    if (isSectionIntro) {
      if (sectionQuestionCount === 0) {
        nextSection();
        return;
      }

      setQuestionIndex(0);
      return;
    }

    if (isRedFlagSection && !redFlagSectionAnswered) {
      setValidationMessage("Please answer each red flag item, or choose None of the above.");
      return;
    }

    if (!currentQuestion) {
      nextSection();
      return;
    }

    if (currentQuestion.required && !isQuestionAnswered(currentQuestion, answers)) {
      setValidationMessage(`Please complete: ${formatDisplayLabel(currentQuestion.label)}`);
      return;
    }

    if (currentQuestionIndex < sectionQuestionCount - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    const nextIndex = findNextSectionWithQuestions(safeSectionIndex);
    if (nextIndex > safeSectionIndex) {
      setSectionTransition({ from: safeSectionIndex, to: nextIndex });
    }
  };

  const prevQuestion = () => {
    if (questionIndex > 0) {
      setQuestionIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (safeSectionIndex > 0) {
      const previousSectionIndex = findPreviousSectionWithQuestions(safeSectionIndex);
      if (previousSectionIndex === safeSectionIndex) {
        return;
      }

      const previousSectionQuestions = getSectionQuestions(previousSectionIndex);
      setSectionIndex(previousSectionIndex);
      setQuestionIndex(Math.max(previousSectionQuestions.length - 1, 0));
    }
  };

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

  const sectionCompletionStats = useMemo(
    () =>
      workflowSections.map((_, index) => {
        const questions = getSectionQuestions(index);
        const answered = questions.filter((question) => isQuestionMeaningfullyAnswered(question, answers)).length;

        return {
          answered,
          total: questions.length,
          complete: questions.length > 0 && answered === questions.length,
        };
      }),
    [answers, getSectionQuestions, workflowSections],
  );

  const renderableSectionIndices = useMemo(
    () => workflowSections.map((_, index) => index).filter((index) => sectionCompletionStats[index]?.total > 0),
    [sectionCompletionStats, workflowSections],
  );
  const firstRenderableSectionIndex = renderableSectionIndices[0] ?? 0;
  const lastRenderableSectionIndex = renderableSectionIndices[renderableSectionIndices.length - 1] ?? 0;
  const totalRenderableSections = Math.max(renderableSectionIndices.length, 1);
  const completedSectionsCount = renderableSectionIndices.filter((index) => sectionCompletionStats[index]?.complete).length;

  const questionsBeforeCurrentSection = useMemo(() => {
    let total = 0;

    for (let index = 0; index < sectionIndex; index += 1) {
      total += getSectionQuestions(index).length;
    }

    return total;
  }, [getSectionQuestions, sectionIndex]);

  const totalQuestionCount = sectionProgress.totalVisibleQuestions;
  const currentQuestionNumber = questionsBeforeCurrentSection + (isRedFlagSection ? 1 : currentQuestionIndex + 1);
  const overallCompletionPercent = Math.round(
    (sectionProgress.totalAnsweredQuestions / Math.max(totalQuestionCount, 1)) * 100,
  );
  const isFirstQuestion =
    !isSectionIntro &&
    safeSectionIndex === firstRenderableSectionIndex &&
    (isRedFlagSection || currentQuestionIndex === 0);
  const isLastQuestionInSection = !isSectionIntro && (isRedFlagSection || currentQuestionIndex >= sectionQuestionCount - 1);
  const isLastQuestionOverall = !isSectionIntro && safeSectionIndex === lastRenderableSectionIndex && isLastQuestionInSection;
  const milestoneMessage = milestoneLabel(overallCompletionPercent);
  const momentumMessage = progressMood(overallCompletionPercent);
  const sectionVisual = getSectionVisual(section.id);
  const transitionFromSection = sectionTransition ? workflowSections[sectionTransition.from] : null;
  const transitionToSection = sectionTransition ? workflowSections[sectionTransition.to] : null;
  const transitionToVisual = transitionToSection ? getSectionVisual(transitionToSection.id) : null;
  const transitionFromStats = sectionTransition ? sectionCompletionStats[sectionTransition.from] : null;
  const transitionShortSection = Boolean(transitionFromStats && transitionFromStats.total > 0 && transitionFromStats.total <= 3);

  const hasConsent = answers.reviewConsent === true;
  const patientDisplayName = String(answers.patientName ?? "").trim() || "Patient";
  const requiredQuestions = useMemo(
    () => workflowSections.flatMap((_, index) => getSectionQuestions(index).filter((question) => question.required)),
    [getSectionQuestions, workflowSections],
  );
  const missingRequiredQuestions = requiredQuestions.filter((question) => !isQuestionAnswered(question, answers));
  const requiredComplete = missingRequiredQuestions.length === 0;
  const answeredForSummary = sectionProgress.totalAnsweredQuestions;

  const questionIdSet = useMemo(
    () => new Set(workflowSections.flatMap((sectionItem) => sectionItem.questions.map((question) => question.id))),
    [workflowSections],
  );

  const summaryKey = (...candidates: string[]) => {
    for (const key of candidates) {
      if (questionIdSet.has(key)) {
        return key;
      }
    }

    return candidates[0];
  };

  const visitReasonKey = summaryKey("q1PrimaryReason", "consultReason");
  const concernKey = summaryKey("q2PainRegion", "mainConcern");
  const painScoreKey = summaryKey("q6VasPain", "painScore");
  const painLocationKey = summaryKey("q2PainRegion", "painLocation");
  const durationKey = summaryKey("q4Duration", "symptomDuration");
  const goalKey = summaryKey("spineHealthAnchor", "q15TreatmentHelped", "careGoal");
  const reportsKey = summaryKey("q14TreatmentTried", "reportsWithPatient");

  const submittedSummaryCards = [
    { label: "Visit reason", value: summarizeQuestionAnswer(workflowSections, visitReasonKey, answers[visitReasonKey]) },
    { label: "Main concern", value: summarizeQuestionAnswer(workflowSections, concernKey, answers[concernKey]) },
    { label: "Pain score", value: summarizeQuestionAnswer(workflowSections, painScoreKey, answers[painScoreKey]) },
    { label: "Pain location", value: summarizeQuestionAnswer(workflowSections, painLocationKey, answers[painLocationKey]) },
    { label: "Duration", value: summarizeQuestionAnswer(workflowSections, durationKey, answers[durationKey]) },
    { label: "Treatment goal", value: summarizeQuestionAnswer(workflowSections, goalKey, answers[goalKey]) },
  ];
  const doctorReadyItems = [
    `Reason for visit: ${summarizeQuestionAnswer(workflowSections, visitReasonKey, answers[visitReasonKey])}`,
    `Current concern: ${summarizeQuestionAnswer(workflowSections, concernKey, answers[concernKey])}`,
    `Red flag screen: ${redFlagTriggered ? "Clinic attention needed" : "No urgent red flags reported"}`,
    `Reports available: ${summarizeQuestionAnswer(workflowSections, reportsKey, answers[reportsKey])}`,
    `Patient goal: ${summarizeQuestionAnswer(workflowSections, goalKey, answers[goalKey])}`,
  ];

  const setValue = (key: string, value: AnswerValue) => {
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
  };

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

  const handleBackToDashboard = () => {
    if (!dashboardHref) {
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }

    if (typeof window !== "undefined") {
      window.location.href = dashboardHref;
    }
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
    <article className="section-reveal rounded-xl border border-[rgba(255,138,91,0.22)] bg-[linear-gradient(180deg,rgba(255,138,91,0.12),rgba(255,255,255,0.98))] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,138,91,0.18)] pb-3">
        <button
          type="button"
          aria-label="Previous question"
          onClick={prevQuestion}
            disabled={isFirstQuestion}
          className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(21,32,43,0.12)] bg-white text-base font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          &lt;
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
            Question {currentQuestionNumber} / {totalQuestionCount}
          </div>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="rounded-full bg-[rgba(255,138,91,0.16)] px-2 py-0.5 text-[11px] font-semibold text-[color:#a34722]">
              Urgent safety check
            </span>
          </div>
        </div>

        {isLastQuestionOverall ? (
          <button
            type="button"
            aria-label="Submit for clinical review"
            onClick={submitQuestionnaire}
            disabled={!requiredComplete}
            className={`focus-ring h-10 shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm ${requiredComplete ? "border border-[var(--accent)] bg-[var(--accent)] text-white" : "cursor-not-allowed border border-[rgba(21,32,43,0.12)] bg-[rgba(21,32,43,0.08)] text-[color:var(--muted)]"}`}
          >
            Submit
          </button>
        ) : (
          <button
            type="button"
            aria-label="Next question"
            onClick={nextQuestion}
            className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(21,32,43,0.12)] bg-[var(--accent)] text-base font-semibold text-white shadow-sm"
          >
            &gt;
          </button>
        )}
      </div>

      <div className="text-center">
        <h2 className="headline mt-4 text-xl font-semibold leading-tight sm:text-2xl">Do any of these urgent red flags apply?</h2>
        <p className="mx-auto mt-1 max-w-2xl text-xs leading-6 text-[color:var(--muted)]">
          Answer each item one by one, or choose None of the above if none apply.
        </p>
      </div>

      <div className="mx-auto mt-4 w-full max-w-2xl overflow-hidden rounded-xl border border-[rgba(21,32,43,0.1)] bg-white">
        {redFlagOptions.map((question) => (
          <div key={question.id} className="border-b border-[rgba(21,32,43,0.08)] px-3 py-2.5 text-center last:border-b-0">
            <button
              type="button"
              onClick={() => setValue(question.id, answers[question.id] === true ? false : true)}
              className={`focus-ring mx-auto flex w-full max-w-md items-center justify-center rounded-xl border px-3 py-3 text-center transition ${answers[question.id] === true ? "selected-answer border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[rgba(21,32,43,0.12)] bg-white hover:bg-[rgba(15,118,110,0.05)]"}`}
            >
              <span className="min-w-0 text-sm font-medium leading-6 text-[color:var(--foreground)] [overflow-wrap:anywhere]">{formatDisplayLabel(question.label)}</span>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-[rgba(21,32,43,0.08)] bg-[rgba(21,32,43,0.03)] px-3 py-3 text-xs leading-6 text-[color:var(--foreground)]">
        {redFlagPositiveQuestions.length > 0 ? (
          <>
            Positive red flags: <span className="font-semibold">{redFlagPositiveQuestions.map((question) => formatDisplayLabel(question.label)).join("; ")}</span>
          </>
        ) : answers.redFlagNone === true ? (
          <span className="font-medium text-[var(--accent)]">None of the above selected.</span>
        ) : (
          <span>Answer each item to complete this safety check and unlock the next section.</span>
        )}
      </div>

      {redFlagNoneQuestion ? (
        <div className="mt-3 px-3 text-center">
          <button
            type="button"
            aria-label={formatDisplayLabel(redFlagNoneQuestion.label)}
            onClick={() => setValue(redFlagNoneQuestion.id, answers.redFlagNone === true ? false : true)}
            className={`focus-ring mx-auto flex w-full max-w-md items-center justify-center rounded-xl border px-3 py-3 text-center transition ${answers.redFlagNone === true ? "selected-answer border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[rgba(21,32,43,0.12)] bg-white hover:bg-[rgba(15,118,110,0.05)]"}`}
          >
            <span className="min-w-0 text-sm font-medium leading-6 text-[color:var(--foreground)] [overflow-wrap:anywhere]">{formatDisplayLabel(redFlagNoneQuestion.label)}</span>
          </button>
        </div>
      ) : null}

      {redFlagReasonQuestion && redFlagTriggered ? (
        <div className={`mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(120px,0.42fr)] items-start gap-2 rounded-xl border px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.46fr)] sm:gap-3 ${redFlagTriggered ? "border-[rgba(255,138,91,0.24)] bg-[rgba(255,138,91,0.08)]" : "border-[rgba(21,32,43,0.08)] bg-[rgba(21,32,43,0.03)]"}`}>
          <div className="min-w-0">
            <label className="text-sm font-medium leading-6 text-[color:var(--foreground)]" htmlFor="redFlagReason">
              {formatDisplayLabel(redFlagReasonQuestion.label)}
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
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          <button
            type="button"
            onClick={() => setValue(question.id, true)}
            className={`focus-ring w-full rounded-full border px-4 py-2.5 text-center text-sm font-semibold transition ${answers[question.id] === true ? "selected-answer border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)] hover:bg-[rgba(15,118,110,0.05)]"}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setValue(question.id, false)}
            className={`focus-ring w-full rounded-full border px-4 py-2.5 text-center text-sm font-semibold transition ${answers[question.id] === false ? "selected-answer border-[rgba(21,32,43,0.12)] bg-[rgba(21,32,43,0.06)] text-[color:var(--foreground)]" : "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)] hover:bg-[rgba(15,118,110,0.05)]"}`}
          >
            No
          </button>
        </div>
      );
    }

    if (question.type === "multi-select") {
      const currentAnswer = answers[question.id];
      const selectedValues = Array.isArray(currentAnswer) ? currentAnswer : currentAnswer ? [String(currentAnswer)] : [];

      return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          {question.options?.map((option) => {
            const checked = selectedValues.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleMultiSelectValue(question, option.value)}
                className={`focus-ring w-full rounded-full border px-4 py-2.5 text-center text-sm font-semibold transition ${checked ? "selected-answer border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)] hover:bg-[rgba(15,118,110,0.05)]"}`}
              >
                {formatDisplayLabel(option.label)}
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === "radio" || question.type === "select") {
      return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          {question.options?.map((option) => {
            const active = answers[question.id] === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue(question.id, option.value)}
                className={`focus-ring w-full rounded-full border px-4 py-2.5 text-center text-sm font-semibold transition ${active ? "selected-answer border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)] hover:bg-[rgba(15,118,110,0.05)]"}`}
              >
                {formatDisplayLabel(option.label)}
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === "range") {
      const currentValue = typeof answers[question.id] === "number" ? Number(answers[question.id]) : question.min ?? 0;

      return (
        <div className="mx-auto w-full max-w-md rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-center">
            <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)]">
              Selected: {currentValue}
            </div>
          </div>
          <input
            aria-label={question.label}
            className="w-full accent-[var(--accent)]"
            type="range"
            min={question.min ?? 0}
            max={question.max ?? 10}
            step={question.step ?? 1}
            value={currentValue}
            onChange={(event) => setValue(question.id, Number(event.target.value))}
          />
          <div className="mt-3 flex items-center justify-between text-xs font-medium text-[color:var(--muted)]">
            <span>{question.min ?? 0}</span>
            <span>{question.max ?? 10}</span>
          </div>
        </div>
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


  const renderPainMapPage = () => {
    const painScoreValue = typeof answers.painScore === "number" ? answers.painScore : 0;

    return (
      <div className="section-reveal rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(21,32,43,0.08)] pb-3">
          <button
            type="button"
            aria-label="Previous question"
            onClick={prevQuestion}
            disabled={isFirstQuestion}
            className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(21,32,43,0.12)] bg-white text-base font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            &lt;
          </button>

          <div className="min-w-0 flex-1 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Question {currentQuestionIndex + 1} / {sectionQuestionCount}
            </div>
            <div className="mt-1 flex items-center justify-center gap-2">
              {currentQuestion?.required ? <span className="rounded-full bg-[rgba(255,138,91,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[color:#a34722]">Required</span> : null}
            </div>
          </div>

          {isLastQuestionOverall ? (
            <button
              type="button"
              aria-label="Submit for clinical review"
              onClick={submitQuestionnaire}
              disabled={!requiredComplete}
              className={`focus-ring h-10 shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm ${requiredComplete ? "border border-[var(--accent)] bg-[var(--accent)] text-white" : "cursor-not-allowed border border-[rgba(21,32,43,0.12)] bg-[rgba(21,32,43,0.08)] text-[color:var(--muted)]"}`}
            >
              Submit
            </button>
          ) : (
            <button
              type="button"
              aria-label="Next question"
              onClick={nextQuestion}
              className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(21,32,43,0.12)] bg-[var(--accent)] text-base font-semibold text-white shadow-sm"
            >
              &gt;
            </button>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-[1.35rem] border border-[rgba(21,32,43,0.08)] bg-[rgba(21,32,43,0.02)] p-4">
            <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Where does it hurt most?</h3>
            <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">Choose the main pain location.</p>
            <div className="mx-auto mt-3 flex w-full max-w-md flex-col gap-2">
              {(currentQuestion?.options ?? []).map((option) => {
                const active = answers.painLocation === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue("painLocation", option.value)}
                    className={`focus-ring w-full rounded-full border px-4 py-2.5 text-center text-sm font-semibold transition ${active ? "selected-answer border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)] hover:bg-[rgba(15,118,110,0.05)]"}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Pain score</div>
                <div className="mt-1 text-sm font-medium text-[color:var(--foreground)]">How intense does this feel right now?</div>
              </div>
              <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)]">Selected: {painScoreValue}/10</div>
            </div>

            <input
              className="mt-5 w-full accent-[var(--accent)]"
              type="range"
              min={0}
              max={10}
              step={1}
              value={painScoreValue}
              onChange={(event) => setValue("painScore", Number(event.target.value))}
              aria-label="Pain score"
            />

            <div className="mt-3 flex items-center justify-between text-xs font-medium text-[color:var(--muted)]">
              <span>0 - mild</span>
              <span>10 - worst</span>
            </div>
          </div>

          {answers.painLocation ? (
            <div className="rounded-[1.35rem] border border-[rgba(15,118,110,0.16)] bg-[rgba(15,118,110,0.06)] p-4 text-sm leading-6 text-[color:var(--foreground)]">
              Selected area: <span className="font-semibold">{currentQuestion?.options?.find((option) => option.value === answers.painLocation)?.label ?? answers.painLocation}</span>
            </div>
          ) : null}
        </div>

        {validationMessage ? <p className="mt-4 text-sm font-semibold text-[color:#a34722]">{validationMessage}</p> : null}
      </div>
    );
  };

  const renderQuestionPage = () => {
    if (!currentQuestion) {
      return <div className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-white px-3 py-3 text-xs text-[color:var(--muted)]">No visible questions in this section for current answers.</div>;
    }

    if (section.id === "pain-behaviour" && currentQuestion.id === "painLocation") {
      return renderPainMapPage();
    }

    return (
      <div className="section-reveal rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(21,32,43,0.08)] pb-3">
          <button
            type="button"
            aria-label="Previous question"
            onClick={prevQuestion}
            disabled={isFirstQuestion}
            className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(21,32,43,0.12)] bg-white text-base font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            &lt;
          </button>

          <div className="min-w-0 flex-1 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Question {currentQuestionIndex + 1} / {sectionQuestionCount}
            </div>
            <div className="mt-1 flex items-center justify-center gap-2">
              {currentQuestion.required ? <span className="rounded-full bg-[rgba(255,138,91,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[color:#a34722]">Required</span> : null}
              {currentQuestion.linkedFrom ? <span className="rounded-full bg-[rgba(15,118,110,0.08)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">Linked</span> : null}
            </div>
          </div>

          {isLastQuestionOverall ? (
            <button
              type="button"
              aria-label="Submit for clinical review"
              onClick={submitQuestionnaire}
              disabled={!requiredComplete}
              className={`focus-ring h-10 shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm ${requiredComplete ? "border border-[var(--accent)] bg-[var(--accent)] text-white" : "cursor-not-allowed border border-[rgba(21,32,43,0.12)] bg-[rgba(21,32,43,0.08)] text-[color:var(--muted)]"}`}
            >
              Submit
            </button>
          ) : (
            <button
              type="button"
              aria-label="Next question"
              onClick={nextQuestion}
              className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(21,32,43,0.12)] bg-[var(--accent)] text-base font-semibold text-white shadow-sm"
            >
              &gt;
            </button>
          )}
        </div>

        <div className="mt-4 space-y-4 text-center">
          <div className="space-y-2">
            <label className="block text-2xl font-semibold leading-tight text-[color:var(--foreground)] [overflow-wrap:anywhere]">{formatDisplayLabel(currentQuestion.label)}</label>
            {currentQuestion.helpText ? <p className="mx-auto max-w-2xl text-sm leading-6 text-[color:var(--muted)]">{currentQuestion.helpText}</p> : null}
            <p className="mx-auto max-w-2xl text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
              {momentumMessage}
            </p>
          </div>
          <div>{renderQuestionInput(currentQuestion)}</div>
        </div>

        {validationMessage ? <p className="mt-4 text-sm font-semibold text-[color:#a34722]">{validationMessage}</p> : null}
      </div>
    );
  };

  const renderSectionIntro = () => {
    const intro = getSectionIntro(section.id, section.title);

    return (
      <div className="mx-auto flex min-h-[54vh] w-full max-w-3xl items-center justify-center rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(255,255,255,0.96))] p-5 text-center shadow-sm sm:p-8">
        <div className="w-full">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">{intro.kicker}</div>
          <h2 className="headline mt-2 text-2xl font-semibold leading-tight text-[color:var(--foreground)] sm:text-4xl">{intro.title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[color:var(--muted)] sm:text-base">{intro.body}</p>

          <div className="mx-auto mt-5 w-full max-w-2xl overflow-hidden rounded-2xl border border-[rgba(21,32,43,0.08)] bg-white shadow-sm">
            <div className="grid items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] sm:gap-0">
              <div className="flex flex-col justify-center px-4 py-4 text-left sm:px-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-2xl" aria-hidden="true">
                    {sectionVisual.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--muted)]">Section relevance</div>
                    <div className="mt-0.5 text-sm font-semibold text-[color:var(--foreground)] sm:text-base">{sectionVisual.iconLabel}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)] sm:text-base">{sectionVisual.spotlight}</p>
              </div>
              <div className="relative min-h-[138px] sm:min-h-[170px]">
                <Image
                  src={sectionVisual.imageSrc}
                  alt={sectionVisual.imageAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 flex w-full max-w-md flex-col gap-3">
            <button
              type="button"
              onClick={nextQuestion}
              className="focus-ring rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm"
            >
              {intro.buttonLabel}
            </button>
            <div className="rounded-2xl border border-[rgba(21,32,43,0.08)] bg-white px-4 py-3 text-xs leading-6 text-[color:var(--foreground)]">
              {intro.summary} You have completed {completedSectionsCount} of {totalRenderableSections} sections.
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentPanel = () => {
    if (isRedFlagSection) {
      return renderRedFlagSection();
    }

    if (isSectionIntro) {
      return renderSectionIntro();
    }

    return renderQuestionPage();
  };

  if (submitted) {
    return (
      <div className="space-y-3">
        {dashboardHref ? (
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[rgba(21,32,43,0.04)]"
          >
            <span aria-hidden="true">&lt;</span>
            Back to dashboard
          </button>
        ) : null}

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

            <div className="relative mt-3 h-24 overflow-hidden rounded-2xl border border-white/70 bg-white/85 sm:h-28">
              <Image
                src="/illustrations/completion-bloom.svg"
                alt="Celebration bloom illustration"
                fill
                sizes="(max-width: 1024px) 100vw, 32vw"
                className="object-cover"
              />
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
                <div className="mt-1 font-semibold text-[color:var(--foreground)]">{resolvedBmi ?? "Pending"}</div>
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sectionTransition && transitionFromSection && transitionToSection && transitionToVisual ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(21,32,43,0.42)] p-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/70 bg-white p-5 shadow-[0_26px_80px_rgba(21,32,43,0.22)] sm:p-6">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {celebrationConfetti.slice(0, 7).map((piece) => (
                <span
                  key={`transition-${piece.left}-${piece.delay}`}
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

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(15,118,110,0.1)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                <span aria-hidden="true">🎉</span>
                Section completed
              </div>

              <h3 className="headline mt-3 text-2xl font-semibold leading-tight text-[color:var(--foreground)] sm:text-3xl">
                {transitionFromSection.title} completed
              </h3>

              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                You answered <span className="font-semibold">{transitionFromStats?.answered ?? 0}</span> out of <span className="font-semibold">{transitionFromStats?.total ?? 0}</span> questions in this section.
              </p>

              {transitionShortSection ? (
                <div className="mt-3 rounded-2xl border border-[rgba(15,118,110,0.16)] bg-[rgba(15,118,110,0.06)] px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]">
                  Great job. This shorter section gives the doctor a quick, high-signal snapshot and keeps the questionnaire moving.
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-[rgba(21,32,43,0.08)] bg-[rgba(21,32,43,0.03)] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--muted)]">Next up</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent-soft)] text-lg" aria-hidden="true">
                    {transitionToVisual.emoji}
                  </span>
                  {transitionToSection.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{transitionToVisual.spotlight}</p>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-4 py-2.5 text-sm font-semibold text-[color:var(--foreground)]"
                  onClick={() => setSectionTransition(null)}
                >
                  Stay here
                </button>
                <button
                  type="button"
                  className="focus-ring rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                  onClick={() => {
                    setSectionIndex(sectionTransition.to);
                    setQuestionIndex(-1);
                    setSectionTransition(null);
                  }}
                >
                  Continue to next section
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {dashboardHref ? (
        <button
          type="button"
          onClick={handleBackToDashboard}
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[rgba(21,32,43,0.04)]"
        >
          <span aria-hidden="true">&lt;</span>
          Back to dashboard
        </button>
      ) : null}

      <section ref={questionAreaRef} className="rounded-[1.1rem] border border-white/70 bg-[rgba(255,255,255,0.9)] p-3.5 shadow-[0_20px_60px_rgba(21,32,43,0.12)] sm:rounded-[1.75rem] sm:p-4 lg:p-8">
        <div className="rounded-2xl border border-[rgba(21,32,43,0.08)] bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(255,255,255,0.94))] p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Care journey progress</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">
                {overallCompletionPercent}% complete • {completedSectionsCount}/{totalRenderableSections} sections completed
              </div>
              <p className="mt-1 text-xs text-[color:var(--muted)]">{momentumMessage}</p>
            </div>
            <div className="milestone-pill inline-flex rounded-full border border-[rgba(15,118,110,0.18)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
              {milestoneMessage}
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(21,32,43,0.08)]">
            <div className="progress-shimmer h-full rounded-full bg-[linear-gradient(90deg,var(--accent),#16a394)]" style={{ width: `${overallCompletionPercent}%` }} />
          </div>
        </div>

        {redFlagTriggered && section.id === "red-flags" ? (
          <div className="mt-4 rounded-xl border border-[rgba(255,138,91,0.24)] bg-[rgba(255,138,91,0.12)] p-3 text-xs leading-6 text-[color:var(--foreground)]">
            One or more red flags are positive. The clinic should review this case before continuing routine intake.
          </div>
        ) : null}

        <div className="mt-4">
          {renderCurrentPanel()}
        </div>

      </section>

        <div className="pt-1">
          {!requiredComplete ? (
            <p className="mb-2 text-xs text-[color:var(--muted)]">
              You are close. Complete required answers to finish this journey. Remaining: {missingRequiredQuestions.length}
            </p>
          ) : !hasConsent ? (
            <p className="mb-2 text-xs text-[color:var(--muted)]">
              Final step: accept the consent statement in the last section to submit confidently.
            </p>
          ) : null}
          <p className="text-xs font-medium text-[color:var(--muted)]">
            Draft autosaves while you answer, so you can resume anytime from this same session link.
          </p>
        </div>
    </div>
  );
}