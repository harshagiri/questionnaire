"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { patientWorkflowSections } from "@/lib/workflow-data";
import { calculateBmi, summarizeAnswer } from "@/lib/questionnaire";

type AnswerValue = string | number | boolean | string[];
type AnswerMap = Record<string, AnswerValue>;

const initialAnswers: AnswerMap = {
  redFlagBladderBowel: false,
  redFlagRapidWeakness: false,
  redFlagTrauma: false,
  redFlagCancer: false,
  redFlagFever: false,
  redFlagWeightLoss: false,
  redFlagNone: true,
  onBehalf: false,
  reviewConsent: false,
};

function readSavedWorkflow(sessionId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const saved = window.localStorage.getItem(`sei-pq:${sessionId}`);
  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(saved) as { answers?: AnswerMap; sectionIndex?: number; questionIndex?: number; submitted?: boolean };
  } catch {
    window.localStorage.removeItem(`sei-pq:${sessionId}`);
    return null;
  }
}

function getVisibleQuestions(sectionIndex: number, answers: AnswerMap) {
  return patientWorkflowSections[sectionIndex].questions.filter((question) =>
    question.showIf ? question.showIf(answers) : true,
  );
}

function isQuestionAnswered(question: (typeof patientWorkflowSections)[number]["questions"][number], answers: AnswerMap) {
  const value = answers[question.id];

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
  question: (typeof patientWorkflowSections)[number]["questions"][number],
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

function renderFieldType(type: string) {
  switch (type) {
    case "toggle":
      return "Yes / No";
    case "select":
    case "radio":
      return "Choice";
    case "range":
      return "Score";
    case "textarea":
      return "Narrative";
    case "info-link":
      return "Linked info";
    default:
      return "Text";
  }
}

export function PatientWorkflow({ sessionId }: { sessionId: string }) {
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

  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const questionAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = readSavedWorkflow(sessionId);
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
  }, [registeredProfileDefaults, sessionId]);

  useEffect(() => {
    window.localStorage.setItem(
      `sei-pq:${sessionId}`,
      JSON.stringify({ answers, sectionIndex, questionIndex, submitted }),
    );
  }, [answers, questionIndex, sectionIndex, sessionId, submitted]);

  const hasRegisteredProfile = useMemo(
    () =>
      Boolean(
        answers.patientName &&
          answers.phone &&
          answers.age &&
          answers.gender &&
          answers.preferredLanguage &&
          answers.region &&
          answers.doctorName &&
          answers.doctorLicense,
      ),
    [
      answers.age,
      answers.doctorLicense,
      answers.doctorName,
      answers.gender,
      answers.patientName,
      answers.phone,
      answers.preferredLanguage,
      answers.region,
    ],
  );

  const registrationQuestionIds = useMemo(
    () => ["patientName", "age", "gender", "preferredLanguage", "region", "phone", "doctorName", "doctorLicense"],
    [],
  );

  const getSectionQuestions = useMemo(
    () =>
      (index: number) => {
        const sectionQuestions = getVisibleQuestions(index, answers);
        if (!hasRegisteredProfile || patientWorkflowSections[index].id !== "patient-profile") {
          return sectionQuestions;
        }

        return sectionQuestions.filter((question) => !registrationQuestionIds.includes(question.id));
      },
    [answers, hasRegisteredProfile, registrationQuestionIds],
  );

  const section = patientWorkflowSections[sectionIndex];
  const visibleQuestions = getSectionQuestions(sectionIndex);
  const clampedQuestionIndex = Math.min(questionIndex, Math.max(visibleQuestions.length - 1, 0));
  const activeQuestion = visibleQuestions[clampedQuestionIndex];
  const bmi = calculateBmi(Number(answers.weightKg), Number(answers.heightCm));
  const completion = Math.round(((sectionIndex + (submitted ? 1 : 0)) / patientWorkflowSections.length) * 100);
  const redFlagTriggered = Boolean(
    answers.redFlagBladderBowel ||
      answers.redFlagRapidWeakness ||
      answers.redFlagTrauma ||
      answers.redFlagCancer ||
      answers.redFlagFever ||
      answers.redFlagWeightLoss,
  );

  const sectionCards = useMemo(
    () =>
      patientWorkflowSections.map((item, index) => ({
        ...item,
        active: index === sectionIndex,
        visibleCount: getSectionQuestions(index).length,
        answeredCount: getSectionQuestions(index).filter((question) => isQuestionAnswered(question, answers)).length,
      })),
    [answers, getSectionQuestions, sectionIndex],
  );

  const getSectionStatusLabel = (visibleCount: number, answeredCount: number) => {
    if (visibleCount === 0) {
      return "Ready";
    }
    if (answeredCount === 0) {
      return "Not started";
    }
    if (answeredCount >= visibleCount) {
      return "Completed";
    }
    return "In progress";
  };

  const goToSection = (index: number) => {
    setSectionIndex(index);
    setQuestionIndex(0);

    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.setTimeout(() => {
        questionAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  };

  const nextSection = () => {
    setSectionIndex((current) => Math.min(current + 1, patientWorkflowSections.length - 1));
    setQuestionIndex(0);
  };

  const prevSection = () => {
    setSectionIndex((current) => Math.max(current - 1, 0));
    setQuestionIndex(0);
  };

  const nextQuestion = () => {
    if (clampedQuestionIndex < visibleQuestions.length - 1) {
      setQuestionIndex(clampedQuestionIndex + 1);
      return;
    }
    nextSection();
  };

  const prevQuestion = () => {
    if (clampedQuestionIndex > 0) {
      setQuestionIndex(clampedQuestionIndex - 1);
      return;
    }
    prevSection();
  };

  const sectionQuestionCount = visibleQuestions.length;
  const currentQuestionNumber = sectionQuestionCount === 0 ? 0 : clampedQuestionIndex + 1;
  const sectionProgress = useMemo(() => {
    let totalVisibleQuestions = 0;
    let totalAnsweredQuestions = 0;

    for (let index = 0; index < patientWorkflowSections.length; index += 1) {
      const questions = getSectionQuestions(index);
      totalVisibleQuestions += questions.length;
      totalAnsweredQuestions += questions.filter((question) => isQuestionMeaningfullyAnswered(question, answers)).length;
    }

    return {
      totalVisibleQuestions,
      totalAnsweredQuestions,
    };
  }, [answers, getSectionQuestions]);

  const targetTotalMinutes = 5;
  const completionRatio =
    sectionProgress.totalVisibleQuestions === 0
      ? 0
      : sectionProgress.totalAnsweredQuestions / sectionProgress.totalVisibleQuestions;
  const estimatedMinutesSpent = Math.min(targetTotalMinutes, Math.round(completionRatio * targetTotalMinutes));
  const estimatedMinutesRemaining = Math.max(0, Math.round((1 - completionRatio) * targetTotalMinutes));
  const hasConsent = answers.reviewConsent === true;
  const patientDisplayName = String(answers.patientName ?? "").trim() || "Patient";

  const setValue = (key: string, value: AnswerValue) =>
    setAnswers((current) => {
      const nextAnswers = { ...current, [key]: value };

      const redFlagKeys = [
        "redFlagBladderBowel",
        "redFlagRapidWeakness",
        "redFlagFever",
        "redFlagTrauma",
        "redFlagCancer",
        "redFlagWeightLoss",
      ];

      if (key === "redFlagNone" && Boolean(value)) {
        for (const redFlagKey of redFlagKeys) {
          nextAnswers[redFlagKey] = false;
        }
      }

      if (redFlagKeys.includes(key) && Boolean(value)) {
        nextAnswers.redFlagNone = false;
      }

      if (redFlagKeys.includes(key) && !Boolean(value)) {
        const hasPositiveRedFlag = redFlagKeys.some((redFlagKey) => Boolean(nextAnswers[redFlagKey]));
        if (!hasPositiveRedFlag) {
          nextAnswers.redFlagNone = true;
        }
      }

      return nextAnswers;
    });

  const toggleMultiSelect = (key: string, optionValue: string) => {
    const current = answers[key];
    const selected = Array.isArray(current) ? current : [];
    const exists = selected.includes(optionValue);
    const next = exists ? selected.filter((item) => item !== optionValue) : [...selected, optionValue];
    setValue(key, next);
  };

  const renderQuestionInput = (question: (typeof visibleQuestions)[number]) => {
    if (question.type === "toggle") {
      return (
        <>
          <button
            type="button"
            className={`focus-ring rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${answers[question.id] === true ? "border-[var(--accent)] bg-[rgba(15,118,110,0.12)]" : "border-[rgba(21,32,43,0.12)] bg-white"}`}
            onClick={() => setValue(question.id, true)}
          >
            Yes
          </button>
          <button
            type="button"
            className={`focus-ring rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${answers[question.id] === false ? "border-[var(--accent)] bg-[rgba(15,118,110,0.12)]" : "border-[rgba(21,32,43,0.12)] bg-white"}`}
            onClick={() => setValue(question.id, false)}
          >
            No
          </button>
        </>
      );
    }

    if (question.type === "multi-select") {
      return question.options?.map((option) => {
        const current = answers[question.id];
        const selected = Array.isArray(current) ? current.includes(option.value) : false;
        return (
          <button
            key={option.value}
            type="button"
            className={`focus-ring rounded-xl border px-3 py-2.5 text-left text-sm font-medium ${selected ? "border-[var(--accent)] bg-[rgba(15,118,110,0.12)]" : "border-[rgba(21,32,43,0.12)] bg-white"}`}
            onClick={() => toggleMultiSelect(question.id, option.value)}
          >
            {option.label}
          </button>
        );
      });
    }

    if (question.type === "radio" || question.type === "select") {
      return question.options?.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`focus-ring rounded-xl border px-3 py-2.5 text-left text-sm font-medium ${answers[question.id] === option.value ? "border-[var(--accent)] bg-[rgba(15,118,110,0.12)]" : "border-[rgba(21,32,43,0.12)] bg-white"}`}
          onClick={() => setValue(question.id, option.value)}
        >
          {option.label}
        </button>
      ));
    }

    if (question.type === "range") {
      return (
        <div className="sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] bg-[rgba(15,118,110,0.04)] p-3">
          <input className="w-full accent-[var(--accent)]" type="range" min={0} max={10} value={Number(answers[question.id] ?? 0)} onChange={(event) => setValue(question.id, Number(event.target.value))} />
          <div className="mt-1 text-center text-2xl font-semibold">{String(answers[question.id] ?? 0)}</div>
        </div>
      );
    }

    if (question.type === "info-link") {
      return (
        <div className="sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2 text-xs text-[color:var(--muted)]">
          Auto-linked from patient inputs. BMI: {bmi ?? "pending"}
        </div>
      );
    }

    return (
      <textarea
        value={String(answers[question.id] ?? "")}
        onChange={(event) => setValue(question.id, event.target.value)}
        rows={question.type === "textarea" ? 4 : 1}
        placeholder={question.type === "text" ? "Enter answer" : undefined}
        className="sm:col-span-2 focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 text-sm outline-none"
      />
    );
  };

  if (submitted) {
    return (
      <div className="grid gap-6 rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.88)] p-6 shadow-[0_24px_80px_rgba(21,32,43,0.12)] lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
        <div>
          <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">Thank you</span>
          <h1 className="headline mt-4 text-4xl font-semibold sm:text-5xl">Your questionnaire has been submitted.</h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-[color:var(--muted)]">
            The receptionist and doctor can now review the same session. The consultation timeline and saved answers remain linked to the session reference.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="focus-ring mt-4 rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-4 py-2 text-sm font-semibold"
          >
            Edit answers
          </button>
          <div className="mt-5 rounded-3xl bg-[rgba(15,118,110,0.06)] p-5 text-sm leading-7 text-[color:var(--foreground)]">
            Session ID: {sessionId}
          </div>
        </div>
        <div className="rounded-[1.75rem] bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Summary</div>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3"><span>Patient</span><span className="font-semibold">{summarizeAnswer(answers.patientName)}</span></div>
            <div className="flex justify-between rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3"><span>BMI</span><span className="font-semibold">{bmi ?? "Pending"}</span></div>
            <div className="flex justify-between rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3"><span>Red flag</span><span className="font-semibold">{redFlagTriggered ? "Triggered" : "Clear"}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="space-y-3">
        <div className="sticky top-16 z-20 rounded-xl border border-[rgba(21,32,43,0.08)] bg-[rgba(255,255,255,0.96)] px-3 py-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="text-xs font-medium text-[color:var(--muted)]">{patientDisplayName}</div>
            <div className="text-sm font-semibold text-[color:var(--foreground)]">{completion}% complete</div>
          </div>
          <div className="text-xs text-[color:var(--muted)]">Section {sectionIndex + 1} / {patientWorkflowSections.length}</div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(21,32,43,0.08)]">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${completion}%` }} />
        </div>
          <div className="mt-1.5 text-xs text-[color:var(--muted)]">
            Approx: {estimatedMinutesSpent} min spent • {estimatedMinutesRemaining} min left
          </div>
      </div>

        <div className="grid gap-4 lg:grid-cols-[0.34fr_1fr]">
          <aside ref={questionAreaRef} className="space-y-3 rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-3.5 shadow-sm lg:sticky lg:top-24 lg:h-fit">
        <div className="headline text-2xl font-semibold">Patient intake sections</div>
        <div className="rounded-xl bg-[rgba(15,118,110,0.06)] px-3 py-2 text-xs leading-6 text-[color:var(--foreground)]">
          One short question at a time. You can pause anytime and continue later.
        </div>

        <div className="space-y-2 lg:hidden">
          {sectionCards.map((item, index) => (
            <div key={item.id} className={`rounded-xl border ${item.active ? "border-[var(--accent)] bg-[rgba(15,118,110,0.08)]" : "border-[rgba(21,32,43,0.12)] bg-white"}`}>
              <button
                type="button"
                onClick={() => goToSection(index)}
                className="focus-ring w-full px-3 py-2.5 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{index + 1}. {item.title}</div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.answeredCount >= item.visibleCount && item.visibleCount > 0 ? "bg-[var(--accent)]" : item.answeredCount > 0 ? "bg-[color:#f6a44d]" : "bg-[rgba(21,32,43,0.24)]"}`} />
                    <span className="text-xs font-medium text-[color:var(--muted)]">{item.answeredCount}/{item.visibleCount}</span>
                  </div>
                </div>
              </button>
              {item.active ? (
                <div className="border-t border-[rgba(21,32,43,0.08)] px-3 pb-2.5 pt-2">
                  <div className="text-xs leading-5 text-[color:var(--muted)]">{item.subtitle}</div>
                  <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">{getSectionStatusLabel(item.visibleCount, item.answeredCount)}</div>

                    {index === sectionIndex ? (
                      <div className="mt-2 space-y-2.5">
                        {activeQuestion ? (
                          <article className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">{renderFieldType(activeQuestion.type)}</div>
                            <h2 className="headline mt-1 text-base font-semibold leading-snug">{activeQuestion.label}</h2>
                            {activeQuestion.helpText ? <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{activeQuestion.helpText}</p> : null}
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">{renderQuestionInput(activeQuestion)}</div>
                            <div className="mt-2 flex items-center justify-between">
                              <button
                                type="button"
                                aria-label="Previous question"
                                onClick={prevQuestion}
                                className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-3 py-1.5 text-sm font-semibold"
                              >
                                &lt;
                              </button>
                              <div className="text-xs font-medium text-[color:var(--muted)]">
                                {currentQuestionNumber}/{sectionQuestionCount}
                              </div>
                              <button
                                type="button"
                                aria-label="Next question"
                                onClick={nextQuestion}
                                className="focus-ring rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white"
                              >
                                &gt;
                              </button>
                            </div>
                          </article>
                        ) : (
                          <div className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-white px-3 py-2 text-xs text-[color:var(--muted)]">
                            No visible questions in this section for current answers.
                          </div>
                        )}
                      </div>
                    ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="hidden space-y-2 lg:block">
          {sectionCards.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSectionIndex(index);
                setQuestionIndex(0);
              }}
              className={`focus-ring w-full rounded-xl border px-3 py-2.5 text-left transition ${item.active ? "border-[var(--accent)] bg-[rgba(15,118,110,0.08)]" : "border-[rgba(21,32,43,0.12)] bg-white"}`}
            >
              <div className="text-sm font-semibold">{index + 1}. {item.title}</div>
              <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{item.subtitle}</div>
            </button>
          ))}
        </div>
        </aside>

          <section className="hidden rounded-[1.75rem] border border-white/70 bg-[rgba(255,255,255,0.9)] p-4 shadow-[0_20px_60px_rgba(21,32,43,0.12)] lg:block lg:p-8">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]">
              Confidential patient document
            </span>
            <h1 className="headline mt-3 text-3xl font-semibold sm:text-4xl">{section.title}</h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">{section.subtitle}</p>
            <div className="mt-2 text-xs font-medium text-[color:var(--muted)]">
                Question {currentQuestionNumber} of {sectionQuestionCount} in this section • about {estimatedMinutesRemaining} min left
            </div>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[rgba(21,32,43,0.08)]">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${completion}%` }} />
        </div>

        {redFlagTriggered && section.id === "red-flags" ? (
          <div className="mt-4 rounded-xl border border-[rgba(255,138,91,0.24)] bg-[rgba(255,138,91,0.12)] p-3 text-xs leading-6 text-[color:var(--foreground)]">
            One or more red flags are positive. The clinic should review this case before continuing routine intake.
          </div>
        ) : null}

        <div className="mt-4 hidden gap-3 lg:grid">
          {activeQuestion ? (
            <article className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">{renderFieldType(activeQuestion.type)}</div>
                  <h2 className="headline mt-1.5 text-xl font-semibold leading-tight sm:text-2xl">{activeQuestion.label}</h2>
                  {activeQuestion.helpText ? <p className="mt-1 text-xs leading-6 text-[color:var(--muted)]">{activeQuestion.helpText}</p> : null}
                </div>
                {activeQuestion.linkedFrom ? <span className="rounded-full bg-[rgba(15,118,110,0.08)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">Linked from {activeQuestion.linkedFrom}</span> : null}
                {activeQuestion.branchOn ? <span className="rounded-full bg-[rgba(255,138,91,0.12)] px-3 py-1 text-xs font-semibold text-[color:var(--foreground)]">Shown when {activeQuestion.branchOn} = {activeQuestion.branchValue}</span> : null}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">{renderQuestionInput(activeQuestion)}</div>
            </article>
          ) : (
            <div className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-white px-3 py-3 text-xs text-[color:var(--muted)]">
              No visible questions in this section for current answers.
            </div>
          )}
        </div>

        <div className="mt-4 hidden flex-wrap gap-2.5 lg:flex">
            <button
              type="button"
              aria-label="Previous question"
              onClick={prevQuestion}
              className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-4 py-2 text-sm font-semibold"
            >
              &lt;
            </button>
            <button
              type="button"
              aria-label="Next question"
              onClick={nextQuestion}
              className="focus-ring rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              &gt;
            </button>
        </div>
        </section>
      </div>

        <div className="pt-1">
          {!hasConsent ? (
            <p className="mb-2 text-xs text-[color:var(--muted)]">
              Please accept the consent statement in the final section before review.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setSubmitted(true)}
            disabled={!hasConsent}
            className={`focus-ring w-full rounded-full border px-4 py-2.5 text-sm font-semibold lg:w-auto ${hasConsent ? "border-[rgba(21,32,43,0.12)] bg-white" : "cursor-not-allowed border-[rgba(21,32,43,0.12)] bg-[rgba(21,32,43,0.08)] text-[color:var(--muted)]"}`}
          >
            Review answers
          </button>
        </div>
    </div>
  );
}