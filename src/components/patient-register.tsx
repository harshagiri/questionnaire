"use client";

import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { RegistrationActivityIllustration } from "@/components/registration-activity-illustration";
import { registrationSections } from "@/lib/workflow-data";
import type { WorkflowQuestion } from "@/lib/workflow-data";
import { calculateBmi } from "@/lib/questionnaire";
import type { PatientRecord } from "@/lib/portal-storage";

type AnswerValue = string | number | boolean | string[];
type AnswerMap = Record<string, AnswerValue>;
type PinState = {
  status: "idle" | "loading" | "success" | "error";
  district?: string;
  state?: string;
  localities: string[];
  message?: string;
};

const chapterLabels = [
  "About you",
  "Reach you",
  "Your day",
  "Health",
  "Review",
];
const fieldClass =
  "focus-ring h-11 w-full rounded-xl border border-[rgba(59,130,246,0.2)] bg-white px-3 text-[13px] text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted)] sm:h-12 sm:px-3.5 sm:text-sm";
const activityTypes = [
  "sitting",
  "standing",
  "walking",
  "manual",
  "caregiving",
  "varied",
] as const;
const healthGroups = [
  ["Ongoing conditions", "healthConditionsStatus", "medicalHistory"],
  ["Regular medicines", "medicineStatus", "currentMedicines"],
  ["Drug allergies", "allergyStatus", "drugAllergies"],
  ["Previous spine surgery", "spineSurgeryStatus", "spineSurgeryDetails"],
  ["Other previous surgery", "otherSurgeryStatus", "otherSurgeries"],
] as const;

function hasAnswer(value: AnswerValue | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function formatFeetInches(cm: number) {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet} ft ${inches} in`;
}

function cmToFeetInches(cm: number) {
  const totalInches = Math.round(cm / 2.54);
  return {
    feet: Math.floor(totalInches / 12),
    inches: totalInches % 12,
  };
}

function feetInchesToCm(feet: number, inches: number) {
  return Math.round((feet * 12 + inches) * 2.54);
}

function FloatingInput({
  label,
  value,
  onChange,
  required = false,
  suffix,
  className = "",
  ...props
}: {
  label: string;
  value: string;
  onChange: InputHTMLAttributes<HTMLInputElement>["onChange"];
  required?: boolean;
  suffix?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const active = value.trim().length > 0;

  return (
    <div className="relative">
      <input
        {...props}
        value={value}
        onChange={onChange}
        placeholder=" "
        className={`${fieldClass} pt-5 pb-1.5 ${suffix ? "pr-12" : ""} ${className}`}
      />
      <span
        className={`pointer-events-none absolute left-3 text-[color:var(--muted)] transition-all ${active ? "top-1.5 text-[10px] font-semibold" : "top-1/2 -translate-y-1/2 text-[13px]"}`}
      >
        {label}
        {required ? " *" : ""}
      </span>
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-3.5 text-xs text-[color:var(--muted)]">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function isValid(question: WorkflowQuestion, answers: AnswerMap) {
  const value = answers[question.id];
  if (!hasAnswer(value)) return false;
  if (question.type === "toggle") return value === true;
  if (question.id === "phone")
    return String(value).replace(/\D/g, "").length >= 10;
  if (question.id === "pinCode") return /^\d{6}$/.test(String(value));
  if (question.type === "number" || question.type === "range") {
    const number = Number(value);
    return (
      Number.isFinite(number) &&
      (question.min === undefined || number >= question.min) &&
      (question.max === undefined || number <= question.max)
    );
  }
  return true;
}

function ChoiceGrid({
  question,
  value,
  onChange,
  compact = false,
}: {
  question: WorkflowQuestion;
  value: AnswerValue | undefined;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}
    >
      {question.options?.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`focus-ring min-h-11 rounded-xl border px-3 py-2 text-left text-[13px] font-semibold leading-5 transition sm:min-h-12 sm:py-2.5 sm:text-sm ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[rgba(21,32,43,0.14)] bg-white text-[color:var(--foreground)] hover:border-[rgba(59,130,246,0.5)]"}`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] ${selected ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[rgba(21,32,43,0.28)]"}`}
              >
                {selected ? "✓" : ""}
              </span>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LanguageCloud({
  question,
  value,
  onChange,
}: {
  question: WorkflowQuestion;
  value: AnswerValue | undefined;
  onChange: (value: string) => void;
}) {
  const cloudSizes = ["px-4 py-2", "px-5 py-2.5", "px-4 py-2.5"] as const;

  return (
    <div className="rounded-xl border border-[rgba(59,130,246,0.18)] bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)] p-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {question.options?.map((option, index) => {
          const selected = value === option.value;
          const sizeClass = cloudSizes[index % cloudSizes.length];

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`focus-ring rounded-xl border text-xs font-semibold transition sm:text-sm ${sizeClass} ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_6px_16px_rgba(59,130,246,0.18)]" : "border-[rgba(21,32,43,0.16)] bg-white text-[color:var(--foreground)] hover:border-[rgba(59,130,246,0.5)] hover:bg-[#eff6ff]"}`}
            >
              {selected ? "✓ " : ""}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OneRowTrafficChoice({
  question,
  value,
  onChange,
}: {
  question: WorkflowQuestion;
  value: AnswerValue | undefined;
  onChange: (value: string) => void;
}) {
  const toneByIndex = [
    {
      dot: "bg-[#5a84bf]",
      active: "border-[#93c5fd] bg-[#dbeafe] text-[#1d4ed8]",
      idle: "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)]",
    },
    {
      dot: "bg-[#d18a1f]",
      active: "border-[#efc17a] bg-[#fff6e8] text-[#9b5a00]",
      idle: "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)]",
    },
    {
      dot: "bg-[#d92d20]",
      active: "border-[#f1a6a1] bg-[#fff1f0] text-[#b42318]",
      idle: "border-[rgba(21,32,43,0.12)] bg-white text-[color:var(--foreground)]",
    },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {question.options?.map((option, index) => {
        const selected = value === option.value;
        const tone = toneByIndex[index] ?? toneByIndex[toneByIndex.length - 1];

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`focus-ring min-h-11 rounded-xl border px-1.5 py-1.5 text-center text-[11px] font-semibold leading-4 transition sm:min-h-12 sm:px-2 sm:py-2 sm:text-xs ${selected ? tone.active : tone.idle}`}
          >
            <span className="flex items-center justify-center gap-1.5 sm:gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
              <span>{option.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MultiSelect({
  question,
  value,
  onChange,
}: {
  question: WorkflowQuestion;
  value: AnswerValue | undefined;
  onChange: (value: string[]) => void;
}) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="flex flex-wrap gap-2">
      {question.options?.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={checked}
            onClick={() =>
              onChange(
                checked
                  ? selected.filter((item) => item !== option.value)
                  : [...selected, option.value],
              )
            }
            className={`focus-ring rounded-xl border px-3 py-2 text-xs font-semibold ${checked ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[rgba(21,32,43,0.14)] bg-white text-[color:var(--foreground)]"}`}
          >
            {checked ? "✓ " : ""}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function PatientRegister({
  journeyMode = false,
  consultId,
  phoneFromJourney,
}: {
  journeyMode?: boolean;
  consultId?: string;
  phoneFromJourney?: string;
}) {
  const router = useRouter();
  const normalizedJourneyPhone = String(phoneFromJourney ?? "").replace(/\D/g, "");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem("sei-patient-profile-latest");
    if (!raw) return {};
    try {
      const profile = JSON.parse(raw) as {
        fullName?: string;
        patientName?: string;
        phone?: string;
      };
      const fullName = String(
        profile.fullName ?? profile.patientName ?? "",
      ).trim();
      const phone = String(profile.phone ?? "").replace(/\D/g, "");
      const fallbackPhone = normalizedJourneyPhone || phone;
      return { ...(fullName ? { fullName } : {}), ...(fallbackPhone ? { phone: fallbackPhone } : {}) };
    } catch {
      window.localStorage.removeItem("sei-patient-profile-latest");
      return normalizedJourneyPhone ? { phone: normalizedJourneyPhone } : {};
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingHealth, setEditingHealth] = useState<string | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<"heightCm" | "weightKg" | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [scrollHintDismissedBySection, setScrollHintDismissedBySection] = useState<Record<string, boolean>>({});
  const [pin, setPin] = useState<PinState>({ status: "idle", localities: [] });
  const chapterScrollRef = useRef<HTMLDivElement | null>(null);
  const section = registrationSections[sectionIndex];
  const questions = useMemo(
    () =>
      new Map(
        registrationSections
          .flatMap((item) => item.questions)
          .map((question) => [question.id, question]),
      ),
    [],
  );
  const bmi = useMemo(
    () =>
      Number(answers.heightCm) > 0 && Number(answers.weightKg) > 0
        ? calculateBmi(Number(answers.weightKg), Number(answers.heightCm))
        : null,
    [answers.heightCm, answers.weightKg],
  );

  const movementLabel = useMemo(() => {
    const movementQuestion = registrationSections
      .flatMap((item) => item.questions)
      .find((question) => question.id === "dailyMovement");
    const value = String(answers.dailyMovement ?? "");
    return movementQuestion?.options?.find((option) => option.value === value)?.label ?? "Not selected";
  }, [answers.dailyMovement]);

  const smokingLabel = useMemo(() => {
    const question = registrationSections
      .flatMap((item) => item.questions)
      .find((item) => item.id === "smoking");
    const value = String(answers.smoking ?? "");
    return question?.options?.find((option) => option.value === value)?.label ?? "Not answered";
  }, [answers.smoking]);

  const alcoholLabel = useMemo(() => {
    const question = registrationSections
      .flatMap((item) => item.questions)
      .find((item) => item.id === "alcohol");
    const value = String(answers.alcohol ?? "");
    return question?.options?.find((option) => option.value === value)?.label ?? "Not answered";
  }, [answers.alcohol]);

  useEffect(() => {
    const phone = String(answers.phone ?? "").replace(/\D/g, "");
    if (phone.length < 10) return;
    const timer = window.setTimeout(async () => {
      try {
        const { findPatientRecordByPhone } =
          await import("@/lib/portal-storage");
        const local = findPatientRecordByPhone(phone);
        if (local?.fullName) {
          setAnswers((current) => ({
            ...current,
            fullName: current.fullName || local.fullName,
          }));
          return;
        }
        const response = await fetch(
          `/api/patient-register?phone=${encodeURIComponent(phone)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as {
          ok?: boolean;
          record?: { fullName?: string } | null;
        };
        if (response.ok && payload.ok && payload.record?.fullName)
          setAnswers((current) => ({
            ...current,
            fullName: current.fullName || payload.record?.fullName || "",
          }));
      } catch {
        return;
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [answers.phone]);

  useEffect(() => {
    const pinCode = String(answers.pinCode ?? "").replace(/\D/g, "");
    if (pinCode.length !== 6) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/pin-code/${pinCode}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          ok?: boolean;
          district?: string;
          state?: string;
          localities?: string[];
          message?: string;
        };
        if (cancelled) return;
        if (!response.ok || !data.ok) {
          setPin({
            status: "error",
            localities: [],
            message:
              data.message ?? "PIN code not found. Enter your city manually.",
          });
          return;
        }
        setPin({
          status: "success",
          district: data.district,
          state: data.state,
          localities: data.localities ?? [],
        });
        setAnswers((current) => ({
          ...current,
          city: current.city || data.district || data.localities?.[0] || "",
        }));
      } catch {
        if (!cancelled)
          setPin({
            status: "error",
            localities: [],
            message: "Lookup unavailable. Enter your city manually.",
          });
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [answers.pinCode]);

  useEffect(() => {
    const host = chapterScrollRef.current;
    if (!host) return;
    const sectionId = section.id;

    const syncHint = () => {
      const remaining = host.scrollHeight - (host.scrollTop + host.clientHeight);
      const dismissed = scrollHintDismissedBySection[sectionId] === true;
      if (!dismissed && host.scrollTop > 24) {
        setScrollHintDismissedBySection((current) =>
          current[sectionId] ? current : { ...current, [sectionId]: true },
        );
        setShowScrollHint(false);
        return;
      }
      setShowScrollHint(remaining > 28 && !dismissed);
    };

    syncHint();
    host.addEventListener("scroll", syncHint, { passive: true });
    window.addEventListener("resize", syncHint);

    return () => {
      host.removeEventListener("scroll", syncHint);
      window.removeEventListener("resize", syncHint);
    };
  }, [sectionIndex, section.id, answers, editingHealth, editingMeasurement, scrollHintDismissedBySection]);

  function setValue(id: string, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [id]: value }));
    if (id === "pinCode")
      setPin(
        String(value).length === 6
          ? { status: "loading", localities: [] }
          : { status: "idle", localities: [] },
      );
    setError("");
  }
  function visibleRequired(item = section) {
    return item.questions.filter(
      (question) =>
        question.required && (!question.showIf || question.showIf(answers)),
    );
  }
  function chapterComplete(item = section) {
    return visibleRequired(item).every((question) =>
      isValid(question, answers),
    );
  }
  function handleBack() {
    if (sectionIndex === 0) {
      if (journeyMode) {
        const phone = String(answers.phone ?? normalizedJourneyPhone ?? "").replace(/\D/g, "");
        const backHref = `/patient/book?journey=1${phone ? `&phone=${encodeURIComponent(phone)}` : ""}`;
        router.push(backHref);
      } else {
        router.push("/patient");
      }
    }
    else {
      setSectionIndex((value) => value - 1);
      setEditingHealth(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  function handleNext() {
    const missing = visibleRequired().find(
      (question) => !isValid(question, answers),
    );
    if (missing) {
      setError(`Please complete “${missing.label}” before continuing.`);
      document
        .getElementById(`question-${missing.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError("");
    if (sectionIndex < registrationSections.length - 1) {
      setSectionIndex((value) => value + 1);
      setEditingHealth(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else void submit();
  }

  async function submit() {
    const submitStartedAt = Date.now();
    setSaving(true);
    setError("");
    try {
      const body = {
        fullName: String(answers.fullName ?? ""),
        phone: String(answers.phone ?? ""),
        age: Number(answers.age),
        gender: String(answers.gender ?? ""),
        heightCm: Number(answers.heightCm),
        weightKg: Number(answers.weightKg),
        bmi: bmi ?? undefined,
        region: String(answers.city ?? ""),
        preferredLanguage: String(answers.preferredLanguage ?? ""),
        dailyActivity: String(answers.dailyMovement ?? ""),
        comorbidities: Array.isArray(answers.medicalHistory)
          ? answers.medicalHistory
          : [],
        currentMeds:
          answers.medicineStatus === "yes" && answers.currentMedicines
            ? [String(answers.currentMedicines)]
            : [],
        priorSurgery: answers.spineSurgeryStatus === "yes",
        surgeryDetails: answers.spineSurgeryDetails
          ? String(answers.spineSurgeryDetails)
          : undefined,
        extras: {
          pinCode: answers.pinCode,
          smoking: answers.smoking,
          alcohol: answers.alcohol,
          drugAllergies: answers.drugAllergies,
          otherSurgeries: answers.otherSurgeries,
          consentClinicalCare: answers.consentClinicalCare,
          consentPrivacy: answers.consentPrivacy,
          consentRegistry: answers.consentRegistry,
        },
      };
      const response = await fetch("/api/patient-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        record?: PatientRecord;
        message?: string;
      };
      if (!response.ok || !payload.ok || !payload.record) {
        setError(payload.message ?? "Registration failed. Please try again.");
        return;
      }
      const { savePatientRecord } = await import("@/lib/portal-storage");
      const normalizedPhone = body.phone.replace(/\D/g, "");
      savePatientRecord({
        phone: normalizedPhone,
        fullName: body.fullName,
        age: body.age,
        gender: body.gender,
        heightCm: body.heightCm,
        weightKg: body.weightKg,
        bmi: body.bmi,
        region: body.region,
        preferredLanguage: body.preferredLanguage,
        dailyActivity: body.dailyActivity,
        comorbidities: body.comorbidities,
        currentMeds: body.currentMeds,
        profileExtras: body.extras,
        priorSurgery: body.priorSurgery,
        surgeryDetails: body.surgeryDetails,
        consentClinicalCare: true,
        consentPrivacy: true,
        consentRegistry: body.extras.consentRegistry === true,
        consentRecordedAt: new Date().toISOString(),
        consentVersion: "registration-v1-2026-07-25",
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "sei-patient-profile-latest",
          JSON.stringify({
            fullName: body.fullName,
            patientName: body.fullName,
            phone: normalizedPhone,
          }),
        );
      }

      const elapsed = Date.now() - submitStartedAt;
      const remainingLoaderTime = 3000 - elapsed;
      if (remainingLoaderTime > 0) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, remainingLoaderTime);
        });
      }

      if (journeyMode) {
        const encodedPhone = encodeURIComponent(normalizedPhone);
        if (consultId) {
          router.push(`/patient/otp?consultId=${encodeURIComponent(consultId)}&phone=${encodedPhone}&journey=1`);
        } else {
          router.push(`/patient/book?journey=1&phone=${encodedPhone}`);
        }
      } else {
        const questionnaireSessionId = `self-${payload.record.patientId}`;
        router.push(
          `/patient/consult/${encodeURIComponent(questionnaireSessionId)}?phone=${encodeURIComponent(normalizedPhone)}`,
        );
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function groupComplete(group: (typeof healthGroups)[number]) {
    const status = answers[group[1]];
    return (
      hasAnswer(status) && (status !== "yes" || hasAnswer(answers[group[2]]))
    );
  }
  function renderDetail(question: WorkflowQuestion) {
    if (question.type === "multi-select")
      return (
        <MultiSelect
          question={question}
          value={answers[question.id]}
          onChange={(value) => setValue(question.id, value)}
        />
      );
    return (
      <textarea
        value={String(answers[question.id] ?? "")}
        onChange={(event) => setValue(question.id, event.target.value)}
        rows={3}
        className={`${fieldClass} h-auto min-h-24 resize-y py-3`}
        placeholder="Type here"
      />
    );
  }

  function AboutChapter() {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div id="question-fullName" className="md:col-span-2">
          <FloatingInput
            label="Full name"
            required
            autoComplete="name"
            value={String(answers.fullName ?? "")}
            onChange={(event) => setValue("fullName", event.target.value)}
            aria-label="Full name"
          />
        </div>
        <div id="question-age">
          <FloatingInput
            label="Age in years"
            required
            inputMode="numeric"
            type="number"
            min={1}
            max={120}
            value={String(answers.age ?? "")}
            onChange={(event) =>
              setValue(
                "age",
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
            aria-label="Age in years"
          />
        </div>
        <div id="question-gender" className="md:col-span-2">
          <label className="mb-2 block text-sm font-semibold">Gender *</label>
          <ChoiceGrid
            question={questions.get("gender")!}
            value={answers.gender}
            onChange={(value) => setValue("gender", value)}
          />
        </div>
      </div>
    );
  }

  function ContactChapter() {
    return (
      <div className="grid gap-5">
        <div id="question-phone">
          <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
            <div className={`${fieldClass} flex items-center text-[#58736d]`}>
              +91
            </div>
            <FloatingInput
              label="Mobile number"
              required
              autoComplete="tel"
              inputMode="tel"
              value={String(answers.phone ?? "")}
              onChange={(event) =>
                setValue("phone", event.target.value.replace(/[^\d ]/g, ""))
              }
              aria-label="Mobile number"
            />
          </div>
          <p className="mt-1.5 text-xs text-[color:var(--muted)]">
            Used for your profile and questionnaire progress.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div id="question-pinCode">
            <FloatingInput
              label="Six-digit PIN code"
              autoComplete="postal-code"
              inputMode="numeric"
              maxLength={6}
              value={String(answers.pinCode ?? "")}
              onChange={(event) =>
                setValue(
                  "pinCode",
                  event.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              aria-label="Six-digit PIN code"
            />
            <p className="mt-1.5 text-xs text-[color:var(--muted)]">
              Optional. Enter if you want city suggestions.
            </p>
          </div>
          <div id="question-city">
            {pin.localities.length ? (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1.5 text-[10px] font-semibold text-[#6d817c]">
                  City or locality *
                </span>
                <select
                  value={String(answers.city ?? "")}
                  onChange={(event) => setValue("city", event.target.value)}
                  className={`${fieldClass} pt-5 pb-1.5`}
                  aria-label="City or locality"
                >
                  <option value={pin.district}>{pin.district}</option>
                  {pin.localities.map((locality) => (
                    <option key={locality}>{locality}</option>
                  ))}
                </select>
              </div>
            ) : (
              <FloatingInput
                label="City or locality"
                required
                autoComplete="address-level2"
                value={String(answers.city ?? "")}
                onChange={(event) => setValue("city", event.target.value)}
                aria-label="City or locality"
              />
            )}
          </div>
        </div>
        {pin.status === "loading" ? (
          <p className="text-xs text-[#58736d]">Checking PIN code…</p>
        ) : null}
        {pin.status === "success" ? (
          <p className="rounded-md border border-[#b8d8d0] bg-[#e8f4f0] px-3 py-2 text-xs font-semibold text-[#176b62]">
            ✓ Found {pin.district}, {pin.state}. You can still edit the
            locality.
          </p>
        ) : null}
        {pin.status === "error" ? (
          <p className="rounded-md border border-[rgba(59,130,246,0.24)] bg-[rgba(59,130,246,0.08)] px-3 py-2 text-xs text-[#1d4ed8]">
            {pin.message}
          </p>
        ) : null}
        <div id="question-preferredLanguage">
          <label className="mb-2 block text-sm font-semibold">
            Which language do you prefer? *
          </label>
          <LanguageCloud
            question={questions.get("preferredLanguage")!}
            value={answers.preferredLanguage}
            onChange={(value) => setValue("preferredLanguage", value)}
          />
        </div>
      </div>
    );
  }

  function DayChapter() {
    const movement = questions.get("dailyMovement")!;
    const heightCmValue = Number(answers.heightCm);
    const hasHeightValue = Number.isFinite(heightCmValue) && heightCmValue > 0;
    const resolvedHeightCm = hasHeightValue ? heightCmValue : 168;
    const weightKgValue = Number(answers.weightKg);
    const hasWeightValue = Number.isFinite(weightKgValue) && weightKgValue > 0;
    const resolvedWeightKg = hasWeightValue ? weightKgValue : null;
    const { feet, inches } = cmToFeetInches(resolvedHeightCm);

    const setHeightFromFeetInches = (nextFeet: number, nextInches: number) => {
      const nextCm = feetInchesToCm(nextFeet, nextInches);
      setValue("heightCm", nextCm);
    };

    const decrementFeet = () => {
      setHeightFromFeetInches(Math.max(4, feet - 1), inches);
    };

    const incrementFeet = () => {
      setHeightFromFeetInches(Math.min(7, feet + 1), inches);
    };

    const decrementInches = () => {
      setHeightFromFeetInches(feet, Math.max(0, inches - 1));
    };

    const incrementInches = () => {
      setHeightFromFeetInches(feet, Math.min(11, inches + 1));
    };

    return (
      <div className="grid gap-5">
        <section className="rounded-lg border border-[rgba(59,130,246,0.16)] bg-white p-3 sm:p-4">
          <h2 className="headline text-base font-semibold sm:text-lg">
            Your measurements
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-[rgba(59,130,246,0.14)] bg-white">
            <div id="question-heightCm" className="flex items-center justify-between gap-3 border-b border-[rgba(59,130,246,0.12)] px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-[#244740]">Height</p>
                <p className="text-sm text-[#31534e]">
                  {hasHeightValue ? `${resolvedHeightCm} cm • ${formatFeetInches(resolvedHeightCm)}` : "Enter height"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMeasurement((current) => (current === "heightCm" ? null : "heightCm"))}
                className="focus-ring rounded-xl border border-[rgba(59,130,246,0.2)] bg-[#eff6ff] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
              >
                Edit
              </button>
            </div>
            {editingMeasurement === "heightCm" ? (
              <div className="border-b border-[rgba(59,130,246,0.12)] px-3 py-3">
                <p className="mb-2 text-xs font-semibold text-[#31534e]">
                  Height rotator (feet and inches)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[rgba(59,130,246,0.18)] bg-[#eff6ff] p-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                      Feet
                    </p>
                    <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-2">
                      <button
                        type="button"
                        onClick={decrementFeet}
                        className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-[rgba(21,32,43,0.16)] bg-white text-lg font-semibold text-[#334155]"
                        aria-label="Decrease feet"
                      >
                        -
                      </button>
                      <div className="rounded-xl border border-[rgba(21,32,43,0.14)] bg-white px-2 py-2 text-center text-sm font-semibold text-[#1e3a8a]">
                        {feet} ft
                      </div>
                      <button
                        type="button"
                        onClick={incrementFeet}
                        className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-[rgba(21,32,43,0.16)] bg-white text-lg font-semibold text-[#334155]"
                        aria-label="Increase feet"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[rgba(59,130,246,0.18)] bg-[#eff6ff] p-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                      Inches
                    </p>
                    <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-2">
                      <button
                        type="button"
                        onClick={decrementInches}
                        className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-[rgba(21,32,43,0.16)] bg-white text-lg font-semibold text-[#334155]"
                        aria-label="Decrease inches"
                      >
                        -
                      </button>
                      <div className="rounded-xl border border-[rgba(21,32,43,0.14)] bg-white px-2 py-2 text-center text-sm font-semibold text-[#1e3a8a]">
                        {inches} in
                      </div>
                      <button
                        type="button"
                        onClick={incrementInches}
                        className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-[rgba(21,32,43,0.16)] bg-white text-lg font-semibold text-[#334155]"
                        aria-label="Increase inches"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <FloatingInput
                  label="Height"
                  required
                  inputMode="numeric"
                  type="number"
                  min={100}
                  max={250}
                  value={String(answers.heightCm ?? "")}
                  onChange={(event) =>
                    setValue(
                      "heightCm",
                      event.target.value === "" ? "" : Number(event.target.value),
                    )
                  }
                  suffix="cm"
                  aria-label="Height"
                />
              </div>
            ) : null}

            <div id="question-weightKg" className="flex items-center justify-between gap-3 px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-[#244740]">Weight</p>
                <p className="text-sm text-[#31534e]">
                  {hasWeightValue && resolvedWeightKg ? `${resolvedWeightKg} kg` : "Enter weight"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMeasurement((current) => (current === "weightKg" ? null : "weightKg"))}
                className="focus-ring rounded-xl border border-[rgba(59,130,246,0.2)] bg-[#eff6ff] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
              >
                Edit
              </button>
            </div>
            {editingMeasurement === "weightKg" ? (
              <div className="px-3 pb-3">
                <FloatingInput
                  label="Weight"
                  required
                  inputMode="numeric"
                  type="number"
                  min={30}
                  max={200}
                  value={String(answers.weightKg ?? "")}
                  onChange={(event) =>
                    setValue(
                      "weightKg",
                      event.target.value === "" ? "" : Number(event.target.value),
                    )
                  }
                  suffix="kg"
                  aria-label="Weight"
                />
              </div>
            ) : null}
          </div>
          <div className="mt-3 rounded-md bg-[#e7f3ef] px-3 py-2 text-[13px] text-[#176b62] sm:mt-4 sm:text-sm">
            BMI:{" "}
            <strong>{bmi ? bmi.toFixed(1) : "Add height and weight"}</strong>
          </div>
        </section>
        <section id="question-dailyMovement">
          <h2 className="headline text-lg font-semibold leading-6 sm:text-xl">
            How does most of your day feel physically? *
          </h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Choose the scene that comes closest. This is more useful than a job
            title.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
            {movement.options?.map((option, index) => {
              const selected = answers.dailyMovement === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setValue("dailyMovement", option.value)}
                  className={`focus-ring overflow-hidden rounded-xl border bg-white text-left ${selected ? "border-[var(--accent)] shadow-[0_0_0_2px_rgba(59,130,246,0.14)]" : "border-[rgba(21,32,43,0.14)]"}`}
                >
                  <span className="block h-24">
                    <RegistrationActivityIllustration
                      type={activityTypes[index]}
                      selected={selected}
                    />
                  </span>
                  <span className="flex min-h-11 items-center justify-between px-2.5 py-2 text-xs font-semibold text-[#31534e]">
                    <span>{option.label}</span>
                    {selected ? (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-[10px] text-white">
                        ✓
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="grid gap-4 rounded-lg border border-[rgba(59,130,246,0.16)] bg-white p-4 md:grid-cols-2">
          <div id="question-smoking">
            <h2 className="mb-2 text-sm font-semibold">
              Have you ever smoked? *
            </h2>
            <OneRowTrafficChoice
              question={questions.get("smoking")!}
              value={answers.smoking}
              onChange={(value) => setValue("smoking", value)}
            />
          </div>
          <div id="question-alcohol">
            <h2 className="mb-2 text-sm font-semibold">
              Do you currently drink alcohol? *
            </h2>
            <OneRowTrafficChoice
              question={questions.get("alcohol")!}
              value={answers.alcohol}
              onChange={(value) => setValue("alcohol", value)}
            />
          </div>
        </section>
      </div>
    );
  }

  function HealthChapter() {
    const firstIncomplete = healthGroups.find(
      (group) => !groupComplete(group),
    )?.[1];
    const activeId = editingHealth ?? firstIncomplete;
    return (
      <div className="grid gap-2">
        {healthGroups.map((group, index) => {
          const [title, statusId, detailId] = group;
          const complete = groupComplete(group);
          const active = activeId === statusId;
          const statusQuestion = questions.get(statusId)!;
          const detailQuestion = questions.get(detailId)!;
          const status = answers[statusId];
          if (!active)
            return (
              <button
                key={statusId}
                type="button"
                onClick={() => setEditingHealth(statusId)}
                className="focus-ring flex min-h-16 items-center gap-3 rounded-xl border border-[rgba(59,130,246,0.16)] bg-white px-3 py-2 text-left"
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${complete ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[#eef2f7] text-[#6a7d94]"}`}
                >
                  {complete ? "✓" : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{title}</strong>
                  <span className="block truncate text-xs text-[color:var(--muted)]">
                    {complete
                      ? status === "yes"
                        ? "Details added"
                        : String(
                            statusQuestion.options?.find(
                              (option) => option.value === status,
                            )?.label,
                          )
                      : "Up next"}
                  </span>
                </span>
                {complete ? (
                  <span className="text-xs font-semibold text-[var(--accent)]">
                    Edit
                  </span>
                ) : null}
              </button>
            );
          return (
            <section
              key={statusId}
              id={`question-${statusId}`}
              className="rounded-md border border-[#62a89f] bg-white shadow-[0_0_0_3px_rgba(33,135,124,0.08)]"
            >
              <div className="flex items-center gap-3 border-b border-[rgba(59,130,246,0.12)] px-4 py-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
                  {index + 1}
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{title}</h2>
                  <p className="text-xs text-[color:var(--muted)]">
                    Answer this now
                  </p>
                </div>
              </div>
              <div className="p-4">
                <p className="mb-3 text-sm font-semibold">
                  {statusQuestion.label}
                </p>
                <ChoiceGrid
                  question={statusQuestion}
                  value={status}
                  onChange={(value) => {
                    setValue(statusId, value);
                    if (value !== "yes") setEditingHealth(null);
                  }}
                  compact
                />
                {status === "yes" ? (
                  <div
                    id={`question-${detailId}`}
                    className="mt-4 border-t border-[rgba(59,130,246,0.12)] pt-4"
                  >
                    <p className="mb-3 text-sm font-semibold">
                      {detailQuestion.label}
                    </p>
                    {renderDetail(detailQuestion)}
                  </div>
                ) : null}
                {complete ? (
                  <button
                    type="button"
                    onClick={() => setEditingHealth(null)}
                    className="focus-ring mt-4 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent)]"
                  >
                    Save and open next
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
        <div className="mt-2 rounded-md bg-[linear-gradient(132deg,#1e3a8a_0%,#1d4ed8_48%,#60a5fa_100%)] px-4 py-3 text-white">
          <p className="text-sm font-semibold">
            {healthGroups.filter(groupComplete).length} clinical details
            prepared
          </p>
          <p className="mt-0.5 text-xs text-[#dbeafe]">
            Your doctor can review these before the consultation.
          </p>
        </div>
      </div>
    );
  }

  function ConsentChapter() {
    const openChapter = (index: number) => {
      setSectionIndex(index);
      setEditingHealth(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const summaryCard = (
      title: string,
      lines: string[],
      onEdit: () => void,
    ) => (
      <section className="rounded-lg border border-[rgba(21,32,43,0.12)] bg-white p-4 shadow-[0_8px_20px_rgba(16,53,103,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="headline text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onEdit}
            className="focus-ring rounded-xl border border-[rgba(59,130,246,0.18)] bg-[#eff6ff] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
          >
            Edit
          </button>
        </div>
        <div className="mt-2 grid gap-1 text-sm text-[#35524d]">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>
    );

    const consentCard = (
      id: "consentClinicalCare" | "consentPrivacy",
      title: string,
      summary: string,
      points: string[],
      label: string,
    ) => (
      <section
        id={`question-${id}`}
        className="rounded-lg border border-[rgba(21,32,43,0.14)] border-l-4 border-l-[var(--accent)] bg-white p-4"
      >
        <h2 className="headline text-lg font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm font-medium text-[#31534e]">{summary}</p>
        <ul className="mt-2 grid gap-1 text-xs leading-5 text-[#5e7470]">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#7ea19a]" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <label className="mt-3 flex cursor-pointer gap-3 rounded-xl border border-[rgba(59,130,246,0.16)] bg-[#eff6ff] p-3 text-sm">
          <input
            type="checkbox"
            checked={answers[id] === true}
            onChange={(event) => setValue(id, event.target.checked)}
            className="mt-0.5 h-5 w-5 accent-[var(--accent)]"
          />
          <span>{label} *</span>
        </label>
      </section>
    );
    return (
      <div className="grid gap-4">
        <section className="rounded-lg border border-[rgba(59,130,246,0.16)] bg-white p-4">
          <h2 className="headline text-2xl font-semibold">Review & confirm</h2>
          <p className="mt-1.5 text-sm leading-6 text-[#5e7470]">
            Please review your information before we create your profile. You can edit any section.
          </p>
        </section>

        {summaryCard(
          "About you",
          [
            String(answers.fullName || "Name not provided"),
            `${answers.age ? `${answers.age} years` : "Age not set"} • ${String(answers.gender || "Gender not set")}`,
          ],
          () => openChapter(0),
        )}

        {summaryCard(
          "Reach you",
          [
            `+91 ${String(answers.phone || "")}`.trim(),
            `${String(answers.preferredLanguage || "Language not set")} • ${String(answers.city || "City not set")}`,
          ],
          () => openChapter(1),
        )}

        {summaryCard(
          "Your day",
          [
            `${answers.heightCm ? `${answers.heightCm} cm` : "Height not set"} • ${answers.weightKg ? `${answers.weightKg} kg` : "Weight not set"} • BMI ${bmi ? bmi.toFixed(1) : "-"}`,
            `Mostly: ${movementLabel}`,
          ],
          () => openChapter(2),
        )}

        {summaryCard(
          "Lifestyle snapshot",
          [
            `Smoking: ${smokingLabel}`,
            `Drinking: ${alcoholLabel}`,
            `Day physically feels like: ${movementLabel}`,
          ],
          () => openChapter(3),
        )}

        {consentCard(
          "consentClinicalCare",
          "Care consent",
          "We need your information to safely treat you.",
          [
            "Used by your doctor and care team for consultation and follow-up.",
            "Not shared for marketing or unrelated purposes.",
          ],
          "I agree to use my health information for treatment.",
        )}
        {consentCard(
          "consentPrivacy",
          "Privacy confirmation",
          "Your records are protected and confidential.",
          [
            "Stored securely with access control.",
            "Shared only when required for your care or legal obligations.",
          ],
          "I understand the privacy notice and agree.",
        )}
        <section className="rounded-lg border border-dashed border-[#a98aa2] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="headline text-lg font-semibold">
                Anonymised outcomes research
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-[#5e7470]">
                Optional. Saying no will not affect your care.
              </p>
            </div>
            <span className="rounded-full bg-[#f0e9ef] px-2 py-1 text-[10px] font-semibold text-[#7f5778]">
              Optional
            </span>
          </div>
          <label className="mt-3 flex cursor-pointer gap-3 rounded-xl border border-[rgba(59,130,246,0.16)] bg-[#eff6ff] p-3 text-sm">
            <input
              type="checkbox"
              checked={answers.consentRegistry === true}
              onChange={(event) =>
                setValue("consentRegistry", event.target.checked)
              }
              className="mt-0.5 h-5 w-5 accent-[var(--accent)]"
            />
            <span>
              I allow anonymised data for quality improvement and outcomes
              research.
            </span>
          </label>
        </section>
      </div>
    );
  }

  if (!section) return null;
  const completed = registrationSections.map((item) => chapterComplete(item));
  const chapterContent =
    section.id === "reg-about"
      ? AboutChapter()
      : section.id === "reg-contact"
        ? ContactChapter()
        : section.id === "reg-day"
          ? DayChapter()
          : section.id === "reg-health"
            ? HealthChapter()
            : ConsentChapter();
  const onConsentChapter = sectionIndex === registrationSections.length - 1;
  const requiredConsentsAccepted =
    answers.consentClinicalCare === true && answers.consentPrivacy === true;
  const actionDisabled =
    saving || (onConsentChapter && !requiredConsentsAccepted);
  const sectionTitle = onConsentChapter ? "Review & confirm" : section.title;
  const sectionSubtitle = onConsentChapter
    ? "Please review your information before we create your profile. You can edit any details."
    : section.subtitle;

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_5%_10%,#eaf5ff_0%,#f7fafe_38%,#f8fafc_100%)] text-[14px] text-[#1f2937] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {saving ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(255,255,255,0.92)] backdrop-blur-sm">
          <div className="w-[min(90vw,320px)] rounded-2xl border border-[rgba(59,130,246,0.16)] bg-white px-5 py-6 text-center shadow-[0_24px_70px_rgba(16,53,103,0.16)]">
            <div className="relative mx-auto h-20 w-20">
              <div className="absolute inset-0 rounded-full border-4 border-[#dbeafe]" />
              <div className="absolute inset-2 animate-ping rounded-full bg-[#bfdbfe]/70" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--accent)] border-r-[var(--accent)]" />
              <div className="absolute inset-0 grid place-items-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_8px_16px_rgba(59,130,246,0.2)]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-6 w-6 animate-pulse"
                  >
                    <path
                      fill="currentColor"
                      d="M12 21c-.26 0-.52-.09-.73-.28l-6.8-6.17a4.75 4.75 0 0 1-.23-6.79 4.9 4.9 0 0 1 6.87-.22L12 8.41l.9-.87a4.9 4.9 0 0 1 6.87.22 4.75 4.75 0 0 1-.23 6.79l-6.8 6.17c-.22.2-.48.28-.74.28Z"
                    />
                    <path fill="#ffffff" d="M11 9h2v6h-2z" />
                    <path fill="#ffffff" d="M9 11h6v2H9z" />
                  </svg>
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-[#1e3a8a]">
              Preparing your care questionnaire...
            </p>
            <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]"
                style={{ animationDelay: "120ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]"
                style={{ animationDelay: "240ms" }}
              />
            </div>
            <p className="mt-1 text-xs text-[#64748b]">Almost there</p>
          </div>
        </div>
      ) : null}
      <aside className="hidden h-screen overflow-y-auto bg-[linear-gradient(160deg,#1e3a8a_0%,#1d4ed8_58%,#60a5fa_100%)] px-5 py-8 text-white lg:block">
        <p className="headline text-xl font-semibold">SpineExpert</p>
        <p className="mt-2 text-xs leading-5 text-[#dbeafe]">
          Build your care profile
          <br />
          About 4–6 minutes
        </p>
        <nav className="mt-8 grid gap-2" aria-label="Registration chapters">
          {registrationSections.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => index <= sectionIndex && setSectionIndex(index)}
              className={`focus-ring flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-xs ${index === sectionIndex ? "border-[#93c5fd] bg-white/10 text-white" : "border-white/15 text-[#dbeafe]"}`}
            >
              <span>{completed[index] ? "✓" : index + 1}</span>
              <span>{chapterLabels[index]}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div ref={chapterScrollRef} className="min-w-0 h-screen overflow-y-auto pb-20 sm:pb-24">
        <header className="sticky top-0 z-20 flex h-11 items-center justify-between border-b border-[rgba(59,130,246,0.14)] bg-white px-3 sm:h-14 sm:px-4 lg:px-8">
          <button
            type="button"
            onClick={handleBack}
            className="focus-ring rounded-xl px-1.5 py-1.5 text-[10px] font-semibold text-[#1d4ed8] sm:px-2 sm:py-2 sm:text-xs"
          >
            ← Back
          </button>
          <span className="headline text-sm font-semibold sm:text-base lg:hidden">
            SpineExpert
          </span>
          <span className="text-[10px] text-[#64748b] sm:text-xs">
            Need help?
          </span>
        </header>
        <section className="sticky top-11 z-10 bg-[linear-gradient(160deg,#1e3a8a_0%,#1d4ed8_58%,#60a5fa_100%)] px-3 py-2 text-white sm:top-14 sm:px-4 sm:py-3 lg:hidden">
          <div className="flex items-center justify-between text-[9px] text-[#dbeafe] sm:text-[10px]">
            <span>YOUR CARE PROFILE</span>
            <span>{completed.filter(Boolean).length} chapters ready</span>
          </div>
          <div className="mt-2 rounded-xl border border-white/15 bg-white/5 px-2 py-2.5">
            <div className="relative">
              <div className="absolute left-4 right-4 top-4 h-[2px] bg-white/20" />
              <div className="relative flex items-start justify-between gap-1">
                {chapterLabels.map((label, index) => {
                  const isDone = completed[index];
                  const isCurrent = index === sectionIndex;
                  const isReachable = index <= sectionIndex;

                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={!isReachable}
                      onClick={() => isReachable && setSectionIndex(index)}
                      className="focus-ring flex min-w-0 flex-1 flex-col items-center gap-1 disabled:cursor-not-allowed"
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-full border text-[11px] font-bold transition ${isCurrent ? "border-[#93c5fd] bg-[#93c5fd] text-[#1e3a8a] shadow-[0_0_0_3px_rgba(147,197,253,0.24)]" : isDone ? "border-white/45 bg-white/20 text-white" : "border-white/25 bg-white/10 text-[#dbeafe]"}`}
                      >
                        {isCurrent ? "●" : isDone ? "✓" : index + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
        <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-10">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[var(--accent)] sm:text-[10px]">
            Chapter {sectionIndex + 1} of {registrationSections.length}
          </p>
          <h1 className="headline mt-1.5 text-2xl font-semibold sm:mt-2 sm:text-3xl md:text-4xl">
            {sectionTitle}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-[color:var(--muted)] sm:mt-2 sm:text-sm sm:leading-6">
            {sectionSubtitle}
          </p>
          <div className="mt-4 sm:mt-6">{chapterContent}</div>
          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 sm:text-sm"
            >
              {error}
            </div>
          ) : null}
        </div>
        {showScrollHint ? (
          <button
            type="button"
            onClick={() =>
              chapterScrollRef.current?.scrollBy({ top: 360, behavior: "smooth" })
            }
            aria-label="Scroll down"
            className="focus-ring fixed bottom-24 right-4 z-30 grid h-11 w-11 place-items-center rounded-full border border-[rgba(59,130,246,0.28)] bg-white/95 text-[var(--accent)] shadow-[0_10px_24px_rgba(37,99,235,0.24)] backdrop-blur animate-bounce sm:bottom-28 sm:right-6 lg:right-8"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
        <footer className="fixed bottom-0 left-0 right-0 z-20 flex min-h-16 items-center gap-2 border-t border-[rgba(59,130,246,0.16)] bg-white/95 px-3 py-2 backdrop-blur sm:min-h-18 sm:gap-3 sm:px-4 sm:py-3 lg:left-[240px] lg:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[#31534e] sm:text-xs">
              {completed.filter(Boolean).length} of 5 chapters ready
            </p>
            <p className="text-[9px] text-[#718580] sm:text-[10px]">
              {onConsentChapter && !requiredConsentsAccepted
                ? "Select Care consent and Privacy confirmation to enable register"
                : "Your information remains private"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleNext}
            disabled={actionDisabled}
            className="focus-ring min-h-11 shrink-0 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50 sm:min-h-12 sm:px-5 sm:text-sm"
          >
            {saving
              ? "Registering…"
              : sectionIndex === registrationSections.length - 1
                ? "Create my profile →"
                : "Save & continue →"}
          </button>
        </footer>
      </div>
    </main>
  );
}
