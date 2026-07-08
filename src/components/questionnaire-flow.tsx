"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateBmi,
  getVisibleQuestions,
  questionnaireDefinition,
  summarizeAnswer,
  type QuestionnaireQuestion,
} from "@/lib/questionnaire";

type AnswerValue = string | number | boolean;
type AnswerMap = Record<string, AnswerValue>;

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

export function QuestionnaireFlow({ sessionId }: { sessionId: string }) {
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    const saved = window.localStorage.getItem(`screening:${sessionId}`);
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

    const saved = window.localStorage.getItem(`screening:${sessionId}`);
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
  const [stage, setStage] = useState<"intro" | "form" | "review" | "submitted">(() => {
    if (typeof window === "undefined") {
      return "intro";
    }

    const saved = window.localStorage.getItem(`screening:${sessionId}`);
    if (!saved) {
      return "intro";
    }

    try {
      const parsed = JSON.parse(saved) as { stage?: "intro" | "form" | "review" | "submitted" };
      return parsed.stage ?? "intro";
    } catch {
      return "intro";
    }
  });

  const visibleQuestions = useMemo(() => getVisibleQuestions(answers), [answers]);
  const safeStepIndex = Math.min(stepIndex, Math.max(visibleQuestions.length - 1, 0));
  const currentQuestion = visibleQuestions[safeStepIndex];
  const totalQuestions = visibleQuestions.length;
  const completion = Math.round((Math.min(safeStepIndex, totalQuestions) / Math.max(totalQuestions, 1)) * 100);
  const bmi = calculateBmi(Number(answers.weightKg), Number(answers.heightCm));

  useEffect(() => {
    window.localStorage.setItem(
      `screening:${sessionId}`,
      JSON.stringify({ answers, stepIndex, stage }),
    );
  }, [answers, sessionId, stage, stepIndex]);

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

    if (stage === "form" && stepIndex === 0) {
      setStage("intro");
    }
  };

  if (stage === "intro") {
    return (
      <div className="grid gap-6 rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.8)] p-6 shadow-[0_24px_80px_rgba(21,32,43,0.12)] lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
        <div className="space-y-5">
          <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
            Confidential screening
          </span>
          <h1 className="headline text-4xl font-semibold leading-tight sm:text-5xl">
            Welcome to your health screening journey
          </h1>
          <p className="max-w-2xl text-base leading-8 text-[color:var(--muted)] sm:text-lg">
            This flow adapts to age, gender, symptoms, and consult details. Your answers can be autosaved, reviewed before submission, and shared with your doctor after consent.
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
            {[
              "Welcome and consent",
              "Basic details and doctor association",
              "Symptoms, BMI, and pain screening",
              "Review, submit, and thank you",
            ].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
                  {index + 1}
                </div>
                <div className="text-sm font-medium">{item}</div>
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

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {visibleQuestions.map((question) => (
            <div key={question.id} className="rounded-3xl border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-[color:var(--muted)]">{question.label}</div>
              <div className="mt-2 text-base font-medium text-[color:var(--foreground)]">{summarizeAnswer(answers[question.id])}</div>
            </div>
          ))}
          {bmi ? (
            <div className="rounded-3xl border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.06)] p-4 shadow-sm lg:col-span-2">
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
          <button type="button" className="focus-ring rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white" onClick={() => setStage("submitted")}>
            Submit safely
          </button>
        </div>
      </div>
    );
  }

  if (stage === "submitted") {
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
          <div className="rounded-3xl border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-sm">
            <div className="text-sm text-[color:var(--muted)]">Session reference</div>
            <div className="mt-1 text-lg font-semibold">{sessionId}</div>
          </div>
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

  return (
    <div className="rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.86)] p-6 shadow-[0_24px_80px_rgba(21,32,43,0.12)] lg:p-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
            Session {sessionId}
          </span>
          <h2 className="headline mt-4 text-3xl font-semibold sm:text-4xl">{questionnaireDefinition.title}</h2>
          <p className="mt-2 max-w-3xl text-base text-[color:var(--muted)]">{questionnaireDefinition.subtitle}</p>
        </div>
                <div className="hidden rounded-2xl bg-[rgba(15,118,110,0.08)] px-4 py-3 text-sm font-semibold text-[var(--accent)] sm:block">
          {completion}% complete
        </div>
      </div>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-[rgba(21,32,43,0.08)]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${completion}%` }} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.34fr]">
        <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
          {currentQuestion ? (
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Step {safeStepIndex + 1} of {totalQuestions}
              </div>
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

        <aside className="space-y-4 rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,245,240,0.9))] p-5 shadow-sm">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Autosave</div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">Your answers stay in this browser until submission. You can resume later from the same session.</p>
          </div>

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
      </div>
    </div>
  );
}