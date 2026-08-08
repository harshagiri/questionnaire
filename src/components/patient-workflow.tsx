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

const expandedAnswerStageQuestionIds = new Set([
  "q7PainPattern",
  "q8Trend",
  "q9RadiatingPain",
  "q10Numbness",
  "q11Weakness",
  "q12PainWorsens",
  "q13PainImproves",
  "q14TreatmentTried",
]);

const swipeDeckQuestionIds = new Set([
  "q7PainPattern",
  "q8Trend",
  "q9RadiatingPain",
  "q10Numbness",
  "q11Weakness",
  "q12PainWorsens",
  "q13PainImproves",
  "q14TreatmentTried",
]);

const swipeQuestionMeta: Record<string, Record<string, { imageSrc?: string; helper?: string; fullImage?: boolean }>> = {
  q7PainPattern: {
    intermittent: {
      imageSrc: "/illustrations/pain-map/pattern-options/intermittent.png",
      helper: "Comes and goes with pain-free periods.",
    },
    activity: {
      imageSrc: "/illustrations/pain-map/pattern-options/activity.png",
      helper: "Worse with movement, better with rest.",
    },
    constant: {
      imageSrc: "/illustrations/pain-map/pattern-options/constant.png",
      helper: "Present most of the time.",
    },
    night: {
      imageSrc: "/illustrations/pain-map/pattern-options/night.png",
      helper: "Can wake you from sleep.",
    },
  },
  q8Trend: {
    improving: { imageSrc: "/illustrations/pain-map/change-options/improving.png" },
    stable: { imageSrc: "/illustrations/pain-map/change-options/stable.png" },
    "slowly-worse": { imageSrc: "/illustrations/pain-map/change-options/slowly-worse.png" },
    "rapidly-worse": { imageSrc: "/illustrations/pain-map/change-options/rapidly-worse.png" },
  },
  q9RadiatingPain: {
    no: {
      imageSrc: "/illustrations/pain-map/radiating-options/no-radiating.png",
      helper: "Pain stays in one area and does not travel.",
    },
    occasional: {
      imageSrc: "/illustrations/pain-map/radiating-options/occasional.png",
      helper: "Comes and goes into the arm or leg.",
    },
    frequent: {
      imageSrc: "/illustrations/pain-map/radiating-options/frequent.png",
      helper: "Often travels into the arm or leg.",
    },
    constant: {
      imageSrc: "/illustrations/pain-map/radiating-options/constant.png",
      helper: "Constant and traveling into the limb.",
    },
  },
  q10Numbness: {
    none: {
      imageSrc: "/illustrations/pain-map/numbness-options/none.png",
      helper: "No numbness or tingling.",
    },
    occasional: {
      imageSrc: "/illustrations/pain-map/numbness-options/occasional.png",
      helper: "Comes and goes.",
    },
    frequent: {
      imageSrc: "/illustrations/pain-map/numbness-options/frequent.png",
      helper: "Happens often.",
    },
    constant: {
      imageSrc: "/illustrations/pain-map/numbness-options/constant.png",
      helper: "Present most of the time.",
    },
  },
  q11Weakness: {
    none: { helper: "No weakness in arm, hand, leg, or foot." },
    mild: { helper: "Mild weakness at times." },
    moderate: { helper: "Noticeable weakness affecting daily tasks." },
    progressive: { helper: "Weakness is worsening over time." },
  },
  q12PainWorsens: {
    sitting: { imageSrc: "/illustrations/pain-map/pain-worse-options/sitting.png", fullImage: true },
    standing: { imageSrc: "/illustrations/pain-map/pain-worse-options/standing.png", fullImage: true },
    walking: { imageSrc: "/illustrations/pain-map/pain-worse-options/walking.png", fullImage: true },
    "forward-bend": { imageSrc: "/illustrations/pain-map/pain-worse-options/forward-bending.png", fullImage: true },
    "backward-bend": { imageSrc: "/illustrations/pain-map/pain-worse-options/backward-bending.png", fullImage: true },
    lifting: { imageSrc: "/illustrations/pain-map/pain-worse-options/lifting.png", fullImage: true },
    coughing: { imageSrc: "/illustrations/pain-map/pain-worse-options/coughing-sneezing.png", fullImage: true },
  },
  q13PainImproves: {
    rest: { imageSrc: "/illustrations/pain-map/pain-improves-options/rest-lying-down.png", fullImage: true },
    walking: { imageSrc: "/illustrations/pain-map/pain-improves-options/walking.png", fullImage: true },
    "position-change": { imageSrc: "/illustrations/pain-map/pain-improves-options/changing-position.png", fullImage: true },
    medicines: { imageSrc: "/illustrations/pain-map/pain-improves-options/medicines.png", fullImage: true },
    "heat-cold": { imageSrc: "/illustrations/pain-map/pain-improves-options/heat-cold.png", fullImage: true },
    nothing: { imageSrc: "/illustrations/pain-map/pain-improves-options/nothing-gives-relief.png", fullImage: true },
  },
  q14TreatmentTried: {
    medicines: { imageSrc: "/illustrations/pain-map/treatments-options/medicines-painkillers.png", fullImage: true },
    physio: { imageSrc: "/illustrations/pain-map/treatments-options/physiotherapy-rehab.png", fullImage: true },
    injection: { imageSrc: "/illustrations/pain-map/treatments-options/injection-nerve-block.png", fullImage: true },
    surgery: { imageSrc: "/illustrations/pain-map/treatments-options/surgery.png", fullImage: true },
    alternative: { imageSrc: "/illustrations/pain-map/treatments-options/alternative-therapy.png", fullImage: true },
    none: { imageSrc: "/illustrations/pain-map/treatments-options/none-yet.png", fullImage: true },
  },
};

function wrapSwipeIndex(index: number, total: number) {
  return ((index % total) + total) % total;
}

function getSwipeDistance(index: number, activeIndex: number, total: number) {
  const forward = (index - activeIndex + total) % total;
  const backward = forward - total;
  return Math.abs(backward) < forward ? backward : forward;
}

const celebrationConfetti = [
  { left: "8%", delay: "0ms", color: "#165fc0", size: "10px", drift: "-18px", rotate: "28deg" },
  { left: "14%", delay: "220ms", color: "#5ab5ff", size: "7px", drift: "22px", rotate: "-18deg" },
  { left: "22%", delay: "80ms", color: "#8bcfff", size: "9px", drift: "-12px", rotate: "42deg" },
  { left: "34%", delay: "340ms", color: "#0b223d", size: "6px", drift: "18px", rotate: "12deg" },
  { left: "45%", delay: "160ms", color: "#1f6fd8", size: "8px", drift: "-26px", rotate: "-34deg" },
  { left: "56%", delay: "420ms", color: "#7ac6ff", size: "11px", drift: "24px", rotate: "20deg" },
  { left: "66%", delay: "120ms", color: "#b6dfff", size: "7px", drift: "-16px", rotate: "-28deg" },
  { left: "74%", delay: "280ms", color: "#165fc0", size: "9px", drift: "20px", rotate: "38deg" },
  { left: "84%", delay: "40ms", color: "#5ab5ff", size: "6px", drift: "-20px", rotate: "-12deg" },
  { left: "92%", delay: "360ms", color: "#123b67", size: "8px", drift: "14px", rotate: "32deg" },
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

function shouldUseExpandedAnswerStage(questionId: string) {
  return expandedAnswerStageQuestionIds.has(questionId);
}

function shouldUseSwipeDeckQuestion(questionId: string) {
  return swipeDeckQuestionIds.has(questionId);
}

function getSectionVisual(sectionId: string) {
  switch (sectionId) {
    case "red-flags":
      return {
        emoji: "🚨",
        iconLabel: "Safety check",
        spotlight: "Why this matters: urgent red flags are handled first so risky cases are escalated without delay.",
        imageSrc: "/illustrations/section-celebration.svg",
        imageAlt: "Red flag safety check illustration",
      };
    case "patient-profile":
      return {
        emoji: "👤",
        iconLabel: "Profile",
        spotlight: "Why this matters: verified basics reduce admin friction and let the doctor focus on clinical decisions.",
        imageSrc: "/illustrations/care-journey.svg",
        imageAlt: "Patient profile setup illustration",
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
  const [questionIndex, setQuestionIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [finalizingSubmission, setFinalizingSubmission] = useState(false);
  const [finalAiSummary, setFinalAiSummary] = useState("");
  const [finalAiSummaryGeneratedAt, setFinalAiSummaryGeneratedAt] = useState<string | null>(null);
  const [finalAiSummaryError, setFinalAiSummaryError] = useState("");
  const [sectionTransition, setSectionTransition] = useState<{ from: number; to: number } | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [profileBmi, setProfileBmi] = useState<number | null>(null);
  const [swipeFrontIndexByQuestion, setSwipeFrontIndexByQuestion] = useState<Record<string, number>>({});
  const questionAreaRef = useRef<HTMLDivElement | null>(null);
  const swipeDragStartXRef = useRef<number | null>(null);
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
    const maxQuestionIndex = Math.max(sectionQuestions.length - 1, 0);
    const rawQuestionIndex = typeof saved.questionIndex === "number" ? saved.questionIndex : 0;
    const nextQuestionIndex = Math.min(Math.max(rawQuestionIndex, 0), maxQuestionIndex);

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
    setQuestionIndex(0);
  };

  const nextQuestion = () => {
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
  const overallCompletionPercent = Math.round(
    (sectionProgress.totalAnsweredQuestions / Math.max(totalQuestionCount, 1)) * 100,
  );
  const isFirstQuestion =
    !isSectionIntro &&
    safeSectionIndex === firstRenderableSectionIndex &&
    (isRedFlagSection || currentQuestionIndex === 0);
  const isLastQuestionInSection = !isSectionIntro && (isRedFlagSection || currentQuestionIndex >= sectionQuestionCount - 1);
  const isLastQuestionOverall = !isSectionIntro && safeSectionIndex === lastRenderableSectionIndex && isLastQuestionInSection;
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

  const concernSummary = summarizeQuestionAnswer(workflowSections, concernKey, answers[concernKey]);
  const painScoreSummary = summarizeQuestionAnswer(workflowSections, painScoreKey, answers[painScoreKey]);
  const durationSummary = summarizeQuestionAnswer(workflowSections, durationKey, answers[durationKey]);
  const goalSummary = summarizeQuestionAnswer(workflowSections, goalKey, answers[goalKey]);

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

  const buildPatientSummaryFacts = () => {
    const facts: Array<{ label: string; value: string }> = [
      { label: "Main concern", value: concernSummary },
      { label: "Pain score", value: painScoreSummary },
      { label: "Symptom duration", value: durationSummary },
      { label: "Care goal", value: goalSummary },
      { label: "Safety flags", value: redFlagTriggered ? "Present" : "None" },
      { label: "BMI", value: resolvedBmi !== null && resolvedBmi !== undefined ? String(resolvedBmi) : "Pending" },
    ];

    return facts.filter((item) => item.value.trim().length > 0 && item.value !== "Not filled");
  };

  const buildPatientSummaryRequestBody = () => {
    return {
      summaryType: "patient-preconsult" as const,
      patient: {
        consultSessionId: sessionId,
        name: String(answers.patientName ?? answers.fullName ?? "").trim() || patientDisplayName,
        phone: patientPhone,
        age: String(answers.age ?? "").trim() || undefined,
        sex: String(answers.sex ?? "").trim() || undefined,
        region: String(answers.region ?? answers.city ?? "").trim() || undefined,
        language: String(answers.language ?? "").trim() || undefined,
        bmi: resolvedBmi !== null && resolvedBmi !== undefined ? String(resolvedBmi) : undefined,
        painScore: String(painScoreSummary ?? "").trim() || undefined,
        consultationType: String(answers[visitReasonKey] ?? "").trim() || undefined,
        questionnaireAnswers: answers as Record<string, string | number | boolean | string[]>,
        facts: buildPatientSummaryFacts(),
      },
    };
  };

  const callPatientSummaryApi = async () => {
    const requestBody = buildPatientSummaryRequestBody();

    const response = await fetch("/api/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; summary?: string; message?: string }
      | null;

    if (!response.ok || !payload?.ok || !payload.summary) {
      throw new Error(payload?.message ?? "Unable to generate AI summary");
    }

    return payload.summary;
  };

  const savePatientPreConsultSummary = async (summary: string, generatedAt: string) => {
    if (!summary.trim()) {
      return;
    }

    await fetch("/api/doctor-ai-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consultSessionId: sessionId,
        summary,
        generatedAt,
        summaryType: "patient-preconsult",
      }),
    }).catch(() => undefined);
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

  const submitQuestionnaire = async () => {
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

    if (finalizingSubmission) {
      return;
    }

    setFinalizingSubmission(true);
    setFinalAiSummaryError("");
    saveDraft(true);

    try {
      const summary = await callPatientSummaryApi();
      const generatedAt = new Date().toISOString();
      setFinalAiSummary(summary);
      setFinalAiSummaryGeneratedAt(generatedAt);
      await savePatientPreConsultSummary(summary, generatedAt);
    } catch (error) {
      setFinalAiSummaryError(error instanceof Error ? error.message : "Unable to generate AI summary right now");
    } finally {
      setFinalizingSubmission(false);
      setSubmitted(true);
    }
  };

  useEffect(() => {
    if (!submitted || finalAiSummary.trim().length > 0) {
      return;
    }

    let active = true;

    async function hydrateSavedPreConsultSummary() {
      try {
        const response = await fetch(
          `/api/doctor-ai-summary?consultSessionId=${encodeURIComponent(sessionId)}&summaryType=patient-preconsult`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; record?: { summary?: string; generatedAt?: string } | null }
          | null;

        if (!active || !response.ok || !payload?.ok || !payload.record?.summary) {
          return;
        }

        setFinalAiSummary(payload.record.summary);
        setFinalAiSummaryGeneratedAt(payload.record.generatedAt ?? null);
      } catch {
        // Ignore hydration failure; final screen still works without summary block.
      }
    }

    void hydrateSavedPreConsultSummary();

    return () => {
      active = false;
    };
  }, [finalAiSummary, sessionId, submitted]);

  const renderCompactProgress = () => (
    <div className="mt-2 w-full">
      <div className="flex items-center justify-between text-[11px] font-medium text-[color:var(--muted)]">
        <span>{overallCompletionPercent}% complete</span>
        <span>{sectionProgress.totalAnsweredQuestions}/{Math.max(totalQuestionCount, 1)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgba(21,32,43,0.1)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),#5ab5ff)] transition-[width] duration-300"
          style={{ width: `${overallCompletionPercent}%` }}
        />
      </div>
    </div>
  );

  const optionCardClass = (active: boolean, roomy = false) =>
    `focus-ring w-full border text-left font-semibold transition-all duration-150 active:scale-[0.99] ${roomy ? "rounded-[1.2rem] px-4 py-4 text-base" : "rounded-2xl px-3.5 py-3 text-sm"} ${
      active
        ? "selected-answer border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_8px_20px_rgba(22,95,192,0.14)]"
        : "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)] hover:border-[rgba(22,95,192,0.45)] hover:bg-[rgba(22,95,192,0.06)]"
    }`;

  const optionIndicatorClass = (active: boolean) =>
    `grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition ${
      active
        ? "bg-[var(--accent)] text-white"
        : "border border-[rgba(21,32,43,0.22)] bg-white text-transparent"
    }`;

  const renderRedFlagSection = () => (
    <article className="section-reveal rounded-[1.15rem] bg-[linear-gradient(180deg,rgba(90,181,255,0.12),rgba(255,255,255,0.98))] p-4">
      <div className="flex items-center justify-center gap-3 border-b border-[rgba(22,95,192,0.2)] pb-3">
        <div className="min-w-0 w-full text-center">
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="rounded-full bg-[rgba(22,95,192,0.16)] px-2 py-0.5 text-[11px] font-semibold text-[color:#165fc0]">
              Urgent safety check
            </span>
          </div>
          <div className="mx-auto">{renderCompactProgress()}</div>
        </div>
      </div>

      <div className="text-center">
        <h2 className="headline mt-4 text-xl font-semibold leading-tight sm:text-2xl">Do any of these urgent red flags apply?</h2>
        <p className="mx-auto mt-1 max-w-2xl text-xs leading-6 text-[color:var(--muted)]">
          Answer each item one by one, or choose None of the above if none apply.
        </p>
      </div>

      <div className="mx-auto mt-4 w-full max-w-2xl overflow-hidden rounded-xl bg-white/75">
        {redFlagOptions.map((question) => (
          <div key={question.id} className="border-b border-[rgba(21,32,43,0.08)] px-3 py-2.5 text-center last:border-b-0">
            <button
              type="button"
              onClick={() => setValue(question.id, answers[question.id] === true ? false : true)}
              className={`mx-auto max-w-md ${optionCardClass(answers[question.id] === true)}`}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span className="min-w-0 text-sm font-medium leading-6 [overflow-wrap:anywhere]">{formatDisplayLabel(question.label)}</span>
                <span className={optionIndicatorClass(answers[question.id] === true)} aria-hidden="true">✓</span>
              </span>
            </button>
          </div>
        ))}
      </div>

      {redFlagPositiveQuestions.length > 0 ? (
        <div className="mt-3 rounded-lg bg-[rgba(21,32,43,0.04)] px-3 py-3 text-xs leading-6 text-[color:var(--foreground)]">
          Positive red flags: <span className="font-semibold">{redFlagPositiveQuestions.map((question) => formatDisplayLabel(question.label)).join("; ")}</span>
        </div>
      ) : answers.redFlagNone === true ? (
        <div className="mt-3 rounded-lg bg-[rgba(21,32,43,0.04)] px-3 py-3 text-xs leading-6 text-[color:var(--foreground)]">
          <span className="font-medium text-[var(--accent)]">None of the above selected.</span>
        </div>
      ) : null}

      {redFlagNoneQuestion ? (
        <div className="mt-3 px-3 text-center">
          <button
            type="button"
            aria-label={formatDisplayLabel(redFlagNoneQuestion.label)}
            onClick={() => setValue(redFlagNoneQuestion.id, answers.redFlagNone === true ? false : true)}
            className={`mx-auto max-w-md ${optionCardClass(answers.redFlagNone === true)}`}
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span className="min-w-0 text-sm font-medium leading-6 [overflow-wrap:anywhere]">{formatDisplayLabel(redFlagNoneQuestion.label)}</span>
              <span className={optionIndicatorClass(answers.redFlagNone === true)} aria-hidden="true">✓</span>
            </span>
          </button>
        </div>
      ) : null}

      {redFlagReasonQuestion && redFlagTriggered ? (
        <div className={`mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(120px,0.42fr)] items-start gap-2 rounded-lg px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.46fr)] sm:gap-3 ${redFlagTriggered ? "bg-[rgba(22,95,192,0.1)]" : "bg-[rgba(21,32,43,0.03)]"}`}>
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

      {validationMessage ? <p className="mt-3 text-sm font-semibold text-[color:#165fc0]">{validationMessage}</p> : null}
    </article>
  );

  const renderQuestionInput = (question: (typeof visibleQuestions)[number]) => {
    const useExpandedStage = mode === "pre-consult" || shouldUseExpandedAnswerStage(question.id);
    const useSwipeDeck = mode === "pre-consult" && shouldUseSwipeDeckQuestion(question.id);

    if (useSwipeDeck && question.options && question.options.length > 0) {
      const options = question.options;
      const optionsLength = options.length;
      const rawFrontIndex = swipeFrontIndexByQuestion[question.id] ?? 0;
      const frontIndex = wrapSwipeIndex(rawFrontIndex, optionsLength);
      const isMultiSelect = question.type === "multi-select";
      const selectedValues = Array.isArray(answers[question.id])
        ? (answers[question.id] as string[])
        : typeof answers[question.id] === "string"
          ? [String(answers[question.id])]
          : [];

      const setFrontIndex = (nextIndex: number) => {
        setSwipeFrontIndexByQuestion((current) => ({
          ...current,
          [question.id]: wrapSwipeIndex(nextIndex, optionsLength),
        }));
      };

      const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        swipeDragStartXRef.current = event.clientX;
      };

      const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (swipeDragStartXRef.current === null) {
          return;
        }
        const deltaX = event.clientX - swipeDragStartXRef.current;
        swipeDragStartXRef.current = null;

        if (Math.abs(deltaX) < 34) {
          return;
        }

        if (deltaX < 0) {
          setFrontIndex(frontIndex + 1);
          return;
        }

        setFrontIndex(frontIndex - 1);
      };

      const onPointerCancel = () => {
        swipeDragStartXRef.current = null;
      };

      return (
        <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col">
          <div
            className="relative flex min-h-[clamp(286px,50vh,560px)] flex-1 overflow-hidden rounded-[1.2rem] px-2 sm:min-h-[clamp(332px,56vh,680px)] sm:px-3 lg:min-h-[clamp(360px,60vh,760px)] lg:px-4"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            role={isMultiSelect ? "group" : "radiogroup"}
            aria-label={question.label}
          >
            {options.map((option, index) => {
              const distance = getSwipeDistance(index, frontIndex, optionsLength);
              const absDistance = Math.abs(distance);

              if (absDistance > 3) {
                return null;
              }

              const isFront = distance === 0;
              const meta = swipeQuestionMeta[question.id]?.[option.value];
              const isActive = isMultiSelect ? selectedValues.includes(option.value) : answers[question.id] === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role={isMultiSelect ? undefined : "radio"}
                  aria-checked={isMultiSelect ? undefined : isActive}
                  aria-pressed={isMultiSelect ? isActive : undefined}
                  onClick={() => {
                    if (!isFront) {
                      setFrontIndex(index);
                      return;
                    }

                    if (isMultiSelect) {
                      toggleMultiSelectValue(question, option.value);
                      return;
                    }

                    setValue(question.id, option.value);
                  }}
                  className={`absolute left-1/2 top-1/2 flex w-[min(55vw,202px)] max-w-[202px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1rem] border bg-white shadow-[0_12px_24px_rgba(26,84,136,0.14)] transition-[transform,opacity,border-color,box-shadow] duration-300 ease-out sm:w-[min(48vw,225px)] sm:max-w-[225px] lg:w-[min(46vw,241px)] lg:max-w-[241px] ${meta?.fullImage ? "aspect-[166/186]" : "aspect-[166/186] p-2"} ${isFront ? "border-[#8db6e2] shadow-[0_14px_30px_rgba(30,92,162,0.18)]" : "border-[#d4e3f3]"} ${isActive ? "border-[#205fb3] shadow-[0_0_0_2px_rgba(36,104,194,0.62),0_18px_34px_rgba(29,86,158,0.26)]" : ""}`}
                  style={{
                    transform: `translate(calc(-50% + ${distance * 112}px), calc(-50% + ${absDistance * 9}px)) translateZ(${236 - absDistance * 74}px) rotateY(${distance * -11}deg) scale(${isFront ? 1 : 0.84})`,
                    zIndex: 110 - absDistance,
                    opacity: absDistance > 2 ? 0.6 : 1,
                  }}
                >
                  {meta?.fullImage && meta.imageSrc ? (
                    <span className="relative block h-full w-full">
                      <Image src={meta.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                    </span>
                  ) : (
                    <span className="grid h-full w-full content-start justify-items-center gap-1.5 p-1 text-center">
                      <span className={`text-[0.88rem] font-bold leading-tight sm:text-[0.96rem] ${isActive ? "text-[#2f7ce7]" : "text-[#1a3558]"}`}>
                        {formatDisplayLabel(option.label)}
                      </span>
                      {meta?.helper ? (
                        <span className="max-w-[18ch] text-[0.72rem] leading-snug text-[#5b7391] sm:text-[0.82rem]">
                          {meta.helper}
                        </span>
                      ) : null}
                      {meta?.imageSrc ? (
                        <span className={`relative mt-1 block overflow-hidden rounded-[0.82rem] bg-[radial-gradient(circle_at_50%_42%,rgba(233,241,253,0.95)_0%,rgba(248,252,255,0.45)_80%)] ${question.id === "q8Trend" ? "aspect-[3/4] w-[min(100%,160px)] sm:w-[min(100%,188px)]" : "aspect-[4/3] w-[min(100%,170px)] sm:w-[min(100%,210px)]"}`}>
                          <Image src={meta.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 72vw, 240px" />
                        </span>
                      ) : null}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[0.8rem] leading-snug text-[#3f6489] sm:text-[0.9rem]">
            Swipe left or right, then tap the front card to select {isMultiSelect ? "all that apply" : "one option"}.
          </p>
        </div>
      );
    }

    if (question.type === "toggle") {
      return (
        <div className={`mx-auto flex w-full flex-col ${useExpandedStage ? "max-w-3xl gap-3 sm:gap-4" : "max-w-md gap-2"}`}>
          <button
            type="button"
            onClick={() => setValue(question.id, true)}
            className={optionCardClass(answers[question.id] === true, useExpandedStage)}
          >
            <span className="flex items-center justify-between gap-3">
              <span>Yes</span>
              <span className={optionIndicatorClass(answers[question.id] === true)} aria-hidden="true">✓</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setValue(question.id, false)}
            className={optionCardClass(answers[question.id] === false, useExpandedStage)}
          >
            <span className="flex items-center justify-between gap-3">
              <span>No</span>
              <span className={optionIndicatorClass(answers[question.id] === false)} aria-hidden="true">✓</span>
            </span>
          </button>
        </div>
      );
    }

    if (question.type === "multi-select") {
      const currentAnswer = answers[question.id];
      const selectedValues = Array.isArray(currentAnswer) ? currentAnswer : currentAnswer ? [String(currentAnswer)] : [];

      return (
        <div className={`mx-auto flex w-full flex-col ${useExpandedStage ? "max-w-3xl gap-3 sm:gap-4" : "max-w-md gap-2"}`}>
          {question.options?.map((option) => {
            const checked = selectedValues.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleMultiSelectValue(question, option.value)}
                className={optionCardClass(checked, useExpandedStage)}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{formatDisplayLabel(option.label)}</span>
                  <span className={optionIndicatorClass(checked)} aria-hidden="true">✓</span>
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === "radio" || question.type === "select") {
      return (
        <div className={`mx-auto flex w-full flex-col ${useExpandedStage ? "max-w-3xl gap-3 sm:gap-4" : "max-w-md gap-2"}`}>
          {question.options?.map((option) => {
            const active = answers[question.id] === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue(question.id, option.value)}
                className={optionCardClass(active, useExpandedStage)}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{formatDisplayLabel(option.label)}</span>
                  <span className={optionIndicatorClass(active)} aria-hidden="true">✓</span>
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === "range") {
      const currentValue = typeof answers[question.id] === "number" ? Number(answers[question.id]) : question.min ?? 0;

      return (
        <div className={`mx-auto w-full rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-4 shadow-sm ${useExpandedStage ? "max-w-3xl" : "max-w-md"}`}>
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
      <div className="section-reveal rounded-[1.25rem] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-center gap-3 border-b border-[rgba(21,32,43,0.08)] pb-3">
          <div className="min-w-0 w-full text-center">
            <div className="mt-1 flex items-center justify-center gap-2">
              {currentQuestion?.required ? <span className="rounded-full bg-[rgba(22,95,192,0.14)] px-2 py-0.5 text-[11px] font-semibold text-[color:#165fc0]">Required</span> : null}
            </div>
            <div className="mx-auto">{renderCompactProgress()}</div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-[1.2rem] bg-[rgba(21,32,43,0.03)] p-4">
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
                    className={optionCardClass(active)}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 [overflow-wrap:anywhere]">{option.label}</span>
                      <span className={optionIndicatorClass(active)} aria-hidden="true">✓</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.2rem] bg-[rgba(255,255,255,0.78)] p-4">
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
            <div className="rounded-[1.35rem] border border-[rgba(22,95,192,0.18)] bg-[rgba(22,95,192,0.08)] p-4 text-sm leading-6 text-[color:var(--foreground)]">
              Selected area: <span className="font-semibold">{currentQuestion?.options?.find((option) => option.value === answers.painLocation)?.label ?? answers.painLocation}</span>
            </div>
          ) : null}
        </div>

        {validationMessage ? <p className="mt-4 text-sm font-semibold text-[color:#165fc0]">{validationMessage}</p> : null}
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

    const useExpandedAnswerStage = mode === "pre-consult" || shouldUseExpandedAnswerStage(currentQuestion.id);

    return (
      <div className={`section-reveal rounded-[1.25rem] bg-white p-4 sm:p-5 ${useExpandedAnswerStage ? "flex h-full min-h-0 flex-col" : ""}`}>
        <div className="flex items-center justify-center gap-3 border-b border-[rgba(21,32,43,0.08)] pb-3">
          <div className="min-w-0 w-full text-center">
            <div className="mt-1 flex items-center justify-center gap-2">
              {currentQuestion.required ? <span className="rounded-full bg-[rgba(22,95,192,0.14)] px-2 py-0.5 text-[11px] font-semibold text-[color:#165fc0]">Required</span> : null}
              {currentQuestion.linkedFrom ? <span className="rounded-full bg-[rgba(22,95,192,0.1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">Linked</span> : null}
            </div>
            <div className="mx-auto">{renderCompactProgress()}</div>
          </div>
        </div>

        <div className={`mt-4 text-center ${useExpandedAnswerStage ? "flex min-h-0 flex-1 flex-col" : "space-y-4"}`}>
          <div className="space-y-2">
            <label className="block text-2xl font-semibold leading-tight text-[color:var(--foreground)] [overflow-wrap:anywhere]">{formatDisplayLabel(currentQuestion.label)}</label>
            {currentQuestion.helpText ? <p className="mx-auto max-w-2xl text-sm leading-6 text-[color:var(--muted)]">{currentQuestion.helpText}</p> : null}
          </div>

          {useExpandedAnswerStage ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-[1.3rem] border border-[rgba(21,32,43,0.08)] bg-[linear-gradient(180deg,#fbfdff_0%,#f2f7fc_100%)] px-3 py-3 sm:px-4 sm:py-4">
              <div className="flex min-h-0 flex-1 items-center justify-center">{renderQuestionInput(currentQuestion)}</div>
            </div>
          ) : (
            <div>{renderQuestionInput(currentQuestion)}</div>
          )}
        </div>

        {validationMessage ? <p className="mt-4 text-sm font-semibold text-[color:#165fc0]">{validationMessage}</p> : null}
      </div>
    );
  };

  const renderSectionIntro = () => {
    const intro = getSectionIntro(section.id, section.title);

    return (
      <div className="mx-auto flex min-h-[54vh] w-full max-w-3xl items-center justify-center rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-[linear-gradient(135deg,rgba(22,95,192,0.1),rgba(255,255,255,0.96))] p-5 text-center shadow-sm sm:p-8">
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

          <div className="mx-auto mt-6 w-full max-w-md rounded-2xl border border-[rgba(21,32,43,0.08)] bg-white px-4 py-3 text-xs leading-6 text-[color:var(--foreground)]">
            {intro.summary} You have completed {completedSectionsCount} of {totalRenderableSections} sections.
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentPanel = () => {
    if (isRedFlagSection) {
      return renderRedFlagSection();
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

        <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">Thank you, {patientDisplayName}</p>
              <h1 className="headline mt-1 text-2xl font-semibold text-[color:var(--foreground)] sm:text-3xl">
                Questionnaire completed
              </h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Your doctor can review this before the consultation.
              </p>
            </div>
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]">
              Ready for review
            </span>
          </div>

          <div className="mt-3 rounded-xl bg-[rgba(22,95,192,0.1)] px-3 py-2.5 text-sm font-medium text-[#1b4f8e]">
            Sit back and relax. Your doctor will get back to you.
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-[rgba(22,95,192,0.12)] px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">Answers</div>
              <div className="mt-1 text-lg font-semibold text-[var(--accent)]">{answeredForSummary}</div>
            </div>
            <div className="rounded-xl bg-[rgba(21,32,43,0.04)] px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">Safety flags</div>
              <div className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">{redFlagTriggered ? "Yes" : "None"}</div>
            </div>
            <div className="rounded-xl bg-[rgba(21,32,43,0.04)] px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">BMI</div>
              <div className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">{resolvedBmi ?? "Pending"}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">Main concern</span>
              <p className="mt-1 font-medium text-[color:var(--foreground)]">{concernSummary}</p>
            </div>
            <div className="rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">Pain score</span>
              <p className="mt-1 font-medium text-[color:var(--foreground)]">{painScoreSummary}</p>
            </div>
            <div className="rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">Duration</span>
              <p className="mt-1 font-medium text-[color:var(--foreground)]">{durationSummary}</p>
            </div>
            <div className="rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">Goal</span>
              <p className="mt-1 font-medium text-[color:var(--foreground)]">{goalSummary}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[rgba(21,32,43,0.08)] bg-[rgba(21,32,43,0.02)] px-3 py-3">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              Do you want to upload any documents?
            </p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              You can upload scans or reports now, or do it later from your dashboard.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = `/patient/upload/${encodeURIComponent(sessionId)}`;
                  }
                }}
                className="focus-ring rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Yes, upload documents
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = "/patient";
                  }
                }}
                className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)]"
              >
                No, go to dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden bg-white pb-16 text-[14px] sm:pb-20">
      {finalizingSubmission ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(21,32,43,0.48)] p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-5 text-center shadow-[0_24px_70px_rgba(21,32,43,0.28)] sm:p-6">
            <div className="mx-auto relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-4 border-[#c8def7]" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#165fc0] border-r-[#165fc0]" />
              <div className="absolute inset-0 grid place-items-center">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e2efff] text-[#165fc0] shadow-[0_8px_16px_rgba(22,95,192,0.2)]">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 animate-pulse">
                    <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.6 9h-3.2V7.8a1.4 1.4 0 0 0-2.8 0V11H7.4a1.4 1.4 0 0 0 0 2.8h3.2V17a1.4 1.4 0 0 0 2.8 0v-3.2h3.2a1.4 1.4 0 0 0 0-2.8Z" />
                  </svg>
                </span>
              </div>
            </div>
            <h3 className="headline mt-4 text-xl font-semibold text-[color:var(--foreground)]">Preparing your doctor summary</h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              Please wait while we generate and save your AI pre-consult summary.
            </p>
          </div>
        </div>
      ) : null}

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
              <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(22,95,192,0.12)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
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
                <div className="mt-3 rounded-2xl border border-[rgba(22,95,192,0.18)] bg-[rgba(22,95,192,0.08)] px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]">
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

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  className="focus-ring rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                  onClick={() => {
                    setSectionIndex(sectionTransition.to);
                    setQuestionIndex(0);
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

      <section ref={questionAreaRef} className="flex min-h-0 flex-1 flex-col rounded-[1.1rem] bg-white p-3.5 sm:rounded-[1.75rem] sm:p-4 lg:p-8">
        {redFlagTriggered && section.id === "red-flags" ? (
          <div className="rounded-xl border border-[rgba(22,95,192,0.24)] bg-[rgba(22,95,192,0.12)] p-3 text-xs leading-6 text-[color:var(--foreground)]">
            One or more red flags are positive. The clinic should review this case before continuing routine intake.
          </div>
        ) : null}

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
          {renderCurrentPanel()}
        </div>

      </section>

      {!sectionTransition ? (
        <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-[rgba(21,32,43,0.1)] bg-white/96 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Previous question"
              onClick={prevQuestion}
              disabled={isFirstQuestion}
              className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-4 text-sm font-semibold text-[color:var(--foreground)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[rgba(21,32,43,0.04)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 sm:min-h-12"
            >
              <span aria-hidden="true">←</span>
              <span>Previous</span>
            </button>

            <button
              type="button"
              aria-label={isLastQuestionOverall ? "Submit for clinical review" : "Next question"}
              onClick={isLastQuestionOverall ? submitQuestionnaire : nextQuestion}
              disabled={finalizingSubmission || (isLastQuestionOverall && !requiredComplete)}
              className={`focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-sm transition duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:hover:translate-y-0 sm:min-h-12 ${isLastQuestionOverall ? (requiredComplete ? "bg-[var(--accent)] text-white hover:bg-[#0e54ab]" : "border border-[rgba(21,32,43,0.12)] bg-[rgba(21,32,43,0.08)] text-[color:var(--muted)]") : "bg-[var(--accent)] text-white hover:bg-[#0e54ab]"}`}
            >
              <span>{isLastQuestionOverall ? "Submit" : "Next"}</span>
              <span aria-hidden="true">{isLastQuestionOverall ? "✓" : "→"}</span>
            </button>
          </div>
        </footer>
      ) : null}


    </div>
  );
}