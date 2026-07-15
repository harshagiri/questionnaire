"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateBmi,
  getVisibleQuestions,
  questionnaireDefinition,
  summarizeAnswer,
  type QuestionnaireDefinition,
  type QuestionnaireQuestion,
} from "@/lib/questionnaire";

type AnswerValue = string | number | boolean | string[];
type AnswerMap = Record<string, AnswerValue>;
type FlowStage = "intro" | "form" | "review" | "submitted";

type QuestionSectionGroup = {
  id: string;
  title: string;
  questions: QuestionnaireQuestion[];
};

type RemoteDraftResponse = {
  ok?: boolean;
  record?: {
    answers?: AnswerMap;
    stepIndex?: number;
    submitted?: boolean;
  } | null;
};

function toNumber(value: string) {
  if (value.trim() === "") {
    return "";
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

function fieldValue(question: QuestionnaireQuestion, answer: AnswerValue | undefined) {
  if (question.type === "toggle") {
    return Boolean(answer);
  }

  if (typeof answer === "number") {
    return String(answer);
  }

  return answer ?? "";
}

function isAnswerFilled(value: AnswerValue | undefined) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== undefined;
}

function calculateCompletionPercent(
  layout: "wizard" | "sectioned",
  definition: QuestionnaireDefinition,
  answers: AnswerMap,
  stepIndex: number,
) {
  const visibleQuestions = getVisibleQuestions(answers, definition);
  const totalQuestions = visibleQuestions.length;
  const answeredCount = visibleQuestions.filter((question) => isAnswerFilled(answers[question.id])).length;

  if (layout === "sectioned") {
    return Math.round((answeredCount / Math.max(totalQuestions, 1)) * 100);
  }

  const safeStepIndex = Math.min(stepIndex, Math.max(totalQuestions - 1, 0));
  return Math.round((Math.min(safeStepIndex, totalQuestions) / Math.max(totalQuestions, 1)) * 100);
}

function summarizeQuestionAnswer(question: QuestionnaireQuestion, value: AnswerValue | undefined) {
  if (value === undefined || value === null) {
    return "Not filled";
  }

  const optionLabelByValue = new Map((question.options ?? []).map((option) => [option.value, option.label]));

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "Not filled";
    }

    return value.map((entry) => optionLabelByValue.get(entry) ?? entry).join(", ");
  }

  if (typeof value === "string") {
    if (value.trim() === "") {
      return "Not filled";
    }

    return optionLabelByValue.get(value) ?? value;
  }

  return summarizeAnswer(value);
}

function Field({
  question,
  value,
  onChange,
}: {
  question: QuestionnaireQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const commonClass =
    "focus-ring mt-3 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 text-base shadow-sm outline-none transition placeholder:text-[color:var(--muted)]";

  if (question.type === "textarea") {
    return (
      <textarea
        className={commonClass}
        rows={4}
        value={String(value ?? "")}
        placeholder={question.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (question.type === "select" || question.type === "radio") {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {question.options?.map((option) => {
          const active = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={`focus-ring rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)]"
              }`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "toggle") {
    return (
      <button
        type="button"
        className={`focus-ring mt-3 inline-flex items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold transition ${
          value
            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
            : "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)]"
        }`}
        onClick={() => onChange(!Boolean(value))}
      >
        <span className={`h-3 w-3 rounded-full ${value ? "bg-[var(--accent)]" : "bg-[color:var(--muted)]"}`} />
        {value ? "Yes" : "No"}
      </button>
    );
  }

  if (question.type === "range") {
    const numericValue = typeof value === "number" ? value : question.min ?? 0;

    return (
      <div className="mt-3 rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-4 shadow-sm">
        <input
          className="w-full accent-[var(--accent)]"
          type="range"
          min={question.min}
          max={question.max}
          step={question.step ?? 1}
          value={numericValue}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <div className="mt-3 text-center text-2xl font-semibold text-[var(--foreground)]">{numericValue}</div>
      </div>
    );
  }

  return (
    <input
      className={commonClass}
      type={question.type}
      value={String(fieldValue(question, value))}
      placeholder={question.placeholder}
      min={question.min}
      max={question.max}
      step={question.step}
      onChange={(event) => onChange(question.type === "number" ? toNumber(event.target.value) : event.target.value)}
    />
  );
}

function InlineField({
  question,
  value,
  onChange,
}: {
  question: QuestionnaireQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const inputClass =
    "focus-ring w-full rounded-lg border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2 text-sm outline-none transition placeholder:text-[color:var(--muted)]";

  if (question.type === "textarea") {
    return (
      <textarea
        className={inputClass}
        rows={2}
        value={typeof value === "string" ? value : ""}
        placeholder={question.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (question.type === "toggle") {
    return (
      <select
        className={inputClass}
        value={typeof value === "boolean" ? (value ? "yes" : "no") : ""}
        onChange={(event) => onChange(event.target.value === "yes")}
      >
        <option value="">Select</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }

  if (question.type === "radio" || question.type === "select") {
    if (question.multiSelect) {
      const selectedValues = Array.isArray(value) ? value : [];

      return (
        <select
          multiple
          className={`${inputClass} min-h-[92px]`}
          value={selectedValues}
          onChange={(event) => {
            const nextValues = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
            onChange(nextValues);
          }}
        >
          {(question.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <select
        className={inputClass}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select</option>
        {(question.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (question.type === "range") {
    const min = question.min ?? 0;
    const max = question.max ?? 10;
    const numericValue = typeof value === "number" ? value : min;

    return (
      <div className="flex items-center gap-2">
        <input
          className="w-full accent-[var(--accent)]"
          type="range"
          min={min}
          max={max}
          step={question.step ?? 1}
          value={numericValue}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="w-10 text-right text-sm font-semibold">{numericValue}</span>
      </div>
    );
  }

  return (
    <input
      className={inputClass}
      type={question.type}
      value={typeof value === "number" ? String(value) : typeof value === "string" ? value : ""}
      placeholder={question.placeholder}
      min={question.min}
      max={question.max}
      step={question.step}
      onChange={(event) => onChange(question.type === "number" ? toNumber(event.target.value) : event.target.value)}
    />
  );
}

export function QuestionnaireFlow({
  sessionId,
  definition = questionnaireDefinition,
  layout = "wizard",
  showSessionDetails = true,
  showAutosaveSection = true,
  showSidePanel = true,
  skipIntro = false,
  loadApiPath,
  saveApiPath,
  saveApiContext,
  allowSubmittedEdit = false,
}: {
  sessionId: string;
  definition?: QuestionnaireDefinition;
  layout?: "wizard" | "sectioned";
  showSessionDetails?: boolean;
  showAutosaveSection?: boolean;
  showSidePanel?: boolean;
  skipIntro?: boolean;
  loadApiPath?: string;
  saveApiPath?: string;
  saveApiContext?: Record<string, string | number | boolean | null | undefined>;
  allowSubmittedEdit?: boolean;
}) {
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    const saved = window.localStorage.getItem(`screening:${definition.id}:${sessionId}`);
    if (!saved) {
      return {};
    }

    try {
      const parsed = JSON.parse(saved) as { answers?: AnswerMap };
      return parsed.answers ?? {};
    } catch {
      return {};
    }
  });
  const [stepIndex, setStepIndex] = useState(() => {
    if (typeof window === "undefined") {
      return 0;
    }

    const saved = window.localStorage.getItem(`screening:${definition.id}:${sessionId}`);
    if (!saved) {
      return 0;
    }

    try {
      const parsed = JSON.parse(saved) as { stepIndex?: number };
      return parsed.stepIndex ?? 0;
    } catch {
      return 0;
    }
  });
  const [stage, setStage] = useState<FlowStage>(() => {
    const defaultStage: FlowStage = skipIntro || layout === "sectioned" ? "form" : "intro";

    if (typeof window === "undefined") {
      return defaultStage;
    }

    const saved = window.localStorage.getItem(`screening:${definition.id}:${sessionId}`);
    if (!saved) {
      return defaultStage;
    }

    try {
      const parsed = JSON.parse(saved) as { stage?: FlowStage };
      return parsed.stage ?? defaultStage;
    } catch {
      return defaultStage;
    }
  });

  const visibleQuestions = useMemo(() => getVisibleQuestions(answers, definition), [answers, definition]);
  const groupedVisibleQuestions = useMemo<QuestionSectionGroup[]>(() => {
    return visibleQuestions.reduce<QuestionSectionGroup[]>((groups, question) => {
      const sectionId = question.sectionId ?? "general";
      const sectionTitle = question.sectionTitle ?? "General";
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.id === sectionId) {
        lastGroup.questions.push(question);
        return groups;
      }

      groups.push({
        id: sectionId,
        title: sectionTitle,
        questions: [question],
      });

      return groups;
    }, []);
  }, [visibleQuestions]);
  const safeStepIndex = Math.min(stepIndex, Math.max(visibleQuestions.length - 1, 0));
  const currentQuestion = visibleQuestions[safeStepIndex];
  const currentSection = groupedVisibleQuestions.find((group) =>
    group.questions.some((question) => question.id === currentQuestion?.id),
  );
  const currentSectionStep = currentSection
    ? currentSection.questions.findIndex((question) => question.id === currentQuestion?.id) + 1
    : 0;
  const currentSectionTotal = currentSection?.questions.length ?? 0;
  const totalSections = groupedVisibleQuestions.length;
  const safeSectionIndex = Math.min(stepIndex, Math.max(totalSections - 1, 0));
  const activeSection = groupedVisibleQuestions[safeSectionIndex];
  const totalQuestions = visibleQuestions.length;
  const answeredCount = visibleQuestions.filter((question) => isAnswerFilled(answers[question.id])).length;
  const completion =
    layout === "sectioned"
      ? Math.round((answeredCount / Math.max(totalQuestions, 1)) * 100)
      : Math.round((Math.min(safeStepIndex, totalQuestions) / Math.max(totalQuestions, 1)) * 100);
  const bmi = calculateBmi(Number(answers.weightKg), Number(answers.heightCm));

  const [remoteLoaded, setRemoteLoaded] = useState(() => !loadApiPath);
  const [hasSubmittedRecord, setHasSubmittedRecord] = useState(false);
  const [submittedCompletionSnapshot, setSubmittedCompletionSnapshot] = useState<number | null>(null);

  useEffect(() => {
    if (!loadApiPath) {
      return;
    }

    const endpoint = loadApiPath;

    let active = true;

    async function loadRemoteDraft() {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const payload = (await response.json()) as RemoteDraftResponse;

        if (!active || !response.ok || !payload.ok || !payload.record) {
          return;
        }

        const loadedAnswers = payload.record.answers ?? {};
        const loadedStepIndex = typeof payload.record.stepIndex === "number" ? payload.record.stepIndex : 0;

        if (payload.record.answers && Object.keys(payload.record.answers).length > 0) {
          setAnswers(payload.record.answers);
        }

        if (typeof payload.record.stepIndex === "number") {
          setStepIndex(payload.record.stepIndex);
        }

        if (payload.record.submitted) {
          setHasSubmittedRecord(true);
          setSubmittedCompletionSnapshot(calculateCompletionPercent(layout, definition, loadedAnswers, loadedStepIndex));
          setStage("submitted");
        } else if (skipIntro) {
          setStage("form");
        }
      } catch {
        // Keep local state when remote load fails.
      } finally {
        if (active) {
          setRemoteLoaded(true);
        }
      }
    }

    loadRemoteDraft();

    return () => {
      active = false;
    };
  }, [allowSubmittedEdit, definition, layout, loadApiPath, skipIntro]);

  useEffect(() => {
    window.localStorage.setItem(
      `screening:${definition.id}:${sessionId}`,
      JSON.stringify({ answers, stepIndex, stage }),
    );
  }, [answers, definition.id, sessionId, stage, stepIndex]);

  useEffect(() => {
    if (!saveApiPath || !remoteLoaded) {
      return;
    }

    const payload = {
      answers,
      stepIndex,
      submitted: stage === "submitted",
      updatedAt: new Date().toISOString(),
      ...(saveApiContext ?? {}),
    };

    void fetch(saveApiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  }, [answers, remoteLoaded, saveApiContext, saveApiPath, stage, stepIndex]);

  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const updateAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const goNext = () => {
    if (stage === "intro") {
      setStage("form");
      setStepIndex(0);
      return;
    }

    if (stage === "form" && stepIndex < totalQuestions - 1) {
      setStepIndex((current) => current + 1);
      return;
    }

    if (stage === "form" && stepIndex >= totalQuestions - 1) {
      setStage("review");
    }
  };

  const goBack = () => {
    if (stage === "review") {
      setStage("form");
      return;
    }

    if (stage === "form" && stepIndex > 0) {
      setStepIndex((current) => current - 1);
      return;
    }

    if (stage === "form" && stepIndex === 0 && !skipIntro) {
      setStage("intro");
    }
  };

  if (stage === "intro" && !skipIntro) {
    const previewItems = definition.questions.slice(0, 4);

    return (
      <div className="grid gap-6 rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.8)] p-6 shadow-[0_24px_80px_rgba(21,32,43,0.12)] lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
        <div className="space-y-5">
          <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
            {definition.title}
          </span>
          <h1 className="headline text-4xl font-semibold leading-tight sm:text-5xl">
            {definition.subtitle}
          </h1>
          <p className="max-w-2xl text-base leading-8 text-[color:var(--muted)] sm:text-lg">
            This flow adapts to the selected role and keeps the same questionnaire UI across patient and doctor paths.
          </p>
          <div className="rounded-3xl border border-[rgba(15,118,110,0.16)] bg-[rgba(15,118,110,0.06)] p-4 text-sm leading-7 text-[color:var(--foreground)]">
            Confidentiality statement: your information is only used for care coordination, screening review, and operational tracking by authorized roles.
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="focus-ring rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white" onClick={goNext}>
              Start screening
            </button>
            <button type="button" className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--foreground)]" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Need navigation help?
            </button>
          </div>
        </div>

        <div className="glass-panel rounded-[1.75rem] p-5">
          <div className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
              Flow preview
            </div>
            {previewItems.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
                  {index + 1}
                </div>
                <div className="text-sm font-medium">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === "review") {
    return (
      <div className="rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.85)] p-6 shadow-[0_24px_80px_rgba(21,32,43,0.12)] lg:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">Review answers</span>
            <h2 className="headline mt-4 text-3xl font-semibold sm:text-4xl">Please confirm your submission</h2>
          </div>
          <div className="rounded-2xl bg-[rgba(15,118,110,0.08)] px-4 py-3 text-sm font-semibold text-[var(--accent)]">
            Completion {completion}%
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {groupedVisibleQuestions.map((group) => (
            <section key={group.id} className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {group.title}
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.questions.map((question) => (
                  <div key={question.id} className="rounded-3xl border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-sm">
                    <div className="text-sm font-semibold text-[color:var(--muted)]">{question.label}</div>
                    <div className="mt-2 text-base font-medium text-[color:var(--foreground)]">{summarizeAnswer(answers[question.id])}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {bmi ? (
            <div className="rounded-3xl border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.06)] p-4 shadow-sm">
              <div className="text-sm font-semibold text-[var(--accent)]">Auto calculation</div>
              <div className="mt-2 text-2xl font-semibold">BMI {bmi}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">Shown to both patient and doctor for quick clinical context.</div>
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold" onClick={goBack}>
            Back to edit
          </button>
          <button
            type="button"
            className="focus-ring rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white"
            onClick={() => {
              setHasSubmittedRecord(true);
              setSubmittedCompletionSnapshot(completion);
              setStage("submitted");
            }}
          >
            Submit safely
          </button>
        </div>
      </div>
    );
  }

  if (stage === "submitted") {
    if (layout === "sectioned") {
      return (
        <div className="rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.85)] p-4 shadow-[0_24px_80px_rgba(21,32,43,0.12)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="headline text-2xl font-semibold sm:text-3xl">Doctor submitted details</h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">Read-only summary of answers submitted by doctor.</p>
              {submittedCompletionSnapshot !== null ? (
                <p className="mt-1 text-xs font-semibold text-[color:var(--muted)]">Completion at submission: {submittedCompletionSnapshot}%</p>
              ) : null}
            </div>
            {allowSubmittedEdit && hasSubmittedRecord ? (
              <button
                type="button"
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--accent)]"
                onClick={() => setStage("form")}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="m13.6 3.2 3.2 3.2M4 16l3.1-.6L16 6.5 12.8 3.3 3.9 12.2 3.3 15.3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Edit
              </button>
            ) : null}
          </div>

          <div className="space-y-4">
            {groupedVisibleQuestions.map((group) => (
              <section key={group.id} className="overflow-hidden rounded-xl border border-[rgba(21,32,43,0.08)] bg-white">
                <header className="border-b border-[rgba(21,32,43,0.08)] bg-[rgba(248,245,240,0.65)] px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{group.title}</h3>
                </header>

                {group.questions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-[color:var(--muted)]">No answers in this section.</div>
                ) : (
                  group.questions.map((question) => (
                    <div
                      key={question.id}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-[rgba(21,32,43,0.08)] px-4 py-2.5 text-sm last:border-b-0"
                    >
                      <div className="font-medium text-[color:var(--foreground)]">{question.label}</div>
                      <div className="text-[color:var(--muted)]">{summarizeQuestionAnswer(question, answers[question.id])}</div>
                    </div>
                  ))
                )}
              </section>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-6 rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.85)] p-6 shadow-[0_24px_80px_rgba(21,32,43,0.12)] lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
        <div className="space-y-4">
          <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
            Thank you
          </span>
          <h2 className="headline text-4xl font-semibold leading-tight sm:text-5xl">Your screening has been submitted.</h2>
          <p className="max-w-2xl text-base leading-8 text-[color:var(--muted)] sm:text-lg">
            The doctor can now review the response summary and the detailed answers. Your data stays associated with the appointment and the doctor profile you selected.
          </p>
          {showSessionDetails ? (
            <div className="rounded-3xl border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-sm">
              <div className="text-sm text-[color:var(--muted)]">Session reference</div>
              <div className="mt-1 text-lg font-semibold">{sessionId}</div>
            </div>
          ) : null}
        </div>
        <div className="rounded-[1.75rem] bg-[linear-gradient(180deg,rgba(15,118,110,0.12),rgba(255,255,255,0.8))] p-5">
          <div className="space-y-3">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Post-submit actions</div>
            {[
              "Doctor gets ready-to-review summary",
              "Admin metrics update automatically",
              "Autosaved draft is cleared on success",
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (layout === "sectioned") {
    return (
      <div className="rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.86)] p-4 shadow-[0_24px_80px_rgba(21,32,43,0.12)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="headline text-2xl font-semibold sm:text-3xl">{definition.title}</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{definition.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {allowSubmittedEdit && hasSubmittedRecord ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-2.5 py-1 text-xs font-semibold text-[color:var(--muted)]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="m13.6 3.2 3.2 3.2M4 16l3.1-.6L16 6.5 12.8 3.3 3.9 12.2 3.3 15.3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Editing submitted form{submittedCompletionSnapshot !== null ? ` (${submittedCompletionSnapshot}% at submit)` : ""}
              </span>
            ) : null}
            <div className="rounded-lg bg-[rgba(15,118,110,0.08)] px-3 py-2 text-sm font-semibold text-[var(--accent)]">
              {completion}% complete
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {activeSection ? (
            <section key={activeSection.id} className="overflow-hidden rounded-xl border border-[rgba(21,32,43,0.08)] bg-white">
              <header className="border-b border-[rgba(21,32,43,0.08)] bg-[rgba(248,245,240,0.65)] px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{activeSection.title}</h3>
                  <span className="text-xs font-medium text-[color:var(--muted)]">
                    {safeSectionIndex + 1} / {Math.max(totalSections, 1)}
                  </span>
                </div>
              </header>

              <div className="divide-y divide-[rgba(21,32,43,0.08)]">
                {activeSection.questions.map((question) => (
                  <div key={question.id} className="grid items-start gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:gap-4">
                    <div>
                      <div className="text-sm font-medium text-[color:var(--foreground)]">{question.label}</div>
                      {question.helpText ? <div className="mt-1 text-xs text-[color:var(--muted)]">{question.helpText}</div> : null}
                    </div>
                    <InlineField question={question} value={answers[question.id]} onChange={(value) => updateAnswer(question.id, value)} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
            disabled={safeSectionIndex === 0}
          >
            {"<"}
          </button>

          {safeSectionIndex >= totalSections - 1 ? (
            <button
              type="button"
              className="focus-ring rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
              onClick={() => {
                setHasSubmittedRecord(true);
                setSubmittedCompletionSnapshot(completion);
                setStage("submitted");
              }}
            >
              Submit
            </button>
          ) : (
            <button
              type="button"
              className="focus-ring rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
              onClick={() => setStepIndex((current) => Math.min(current + 1, Math.max(totalSections - 1, 0)))}
            >
              {">"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.86)] p-6 shadow-[0_24px_80px_rgba(21,32,43,0.12)] lg:p-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          {showSessionDetails ? (
            <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
              Session {sessionId}
            </span>
          ) : null}
            <h2 className="headline mt-4 text-3xl font-semibold sm:text-4xl">{definition.title}</h2>
          <p className="mt-2 max-w-3xl text-base text-[color:var(--muted)]">{definition.subtitle}</p>
        </div>
                <div className="hidden rounded-2xl bg-[rgba(15,118,110,0.08)] px-4 py-3 text-sm font-semibold text-[var(--accent)] sm:block">
          {completion}% complete
        </div>
      </div>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-[rgba(21,32,43,0.08)]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${completion}%` }} />
      </div>

      <div className={`mt-6 grid gap-4 ${showSidePanel ? "lg:grid-cols-[1fr_0.34fr]" : "grid-cols-1"}`}>
        <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
          {currentQuestion ? (
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Step {safeStepIndex + 1} of {totalQuestions}
              </div>
              {currentSection ? (
                <div className="mt-2 text-sm font-semibold text-[var(--accent)]">
                  {currentSection.title} • {currentSectionStep} of {currentSectionTotal}
                </div>
              ) : null}
              <h3 className="headline mt-3 text-2xl font-semibold">{currentQuestion.label}</h3>
              {currentQuestion.helpText ? <p className="mt-2 text-sm text-[color:var(--muted)]">{currentQuestion.helpText}</p> : null}
              <Field question={currentQuestion} value={currentAnswer} onChange={(value) => updateAnswer(currentQuestion.id, value)} />
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold" onClick={goBack}>
              Back
            </button>
            <button type="button" className="focus-ring rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white" onClick={goNext}>
              {safeStepIndex >= totalQuestions - 1 ? "Review answers" : "Continue"}
            </button>
          </div>
        </div>

        {showSidePanel ? (
          <aside className="space-y-4 rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,245,240,0.9))] p-5 shadow-sm">
            {showAutosaveSection ? (
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Autosave</div>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">Your answers stay in this browser until submission. You can resume later from the same session.</p>
              </div>
            ) : null}

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-[color:var(--muted)]">Live summary</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span>Patient</span><span className="font-semibold">{summarizeAnswer(answers.fullName)}</span></div>
                <div className="flex justify-between"><span>BMI</span><span className="font-semibold">{bmi ?? "Pending"}</span></div>
                <div className="flex justify-between"><span>Pain score</span><span className="font-semibold">{summarizeAnswer(answers.painScore)}</span></div>
                <div className="flex justify-between"><span>Consent</span><span className="font-semibold">{answers.reviewConsent ? "Accepted" : "Pending"}</span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(15,118,110,0.16)] bg-[rgba(15,118,110,0.06)] p-4 text-sm leading-7 text-[color:var(--foreground)]">
              Navigation hint: if you need to pause, come back to the same session link and continue where you left off.
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}