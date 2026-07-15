"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { registrationSections } from "@/lib/workflow-data";
import { calculateBmi } from "@/lib/questionnaire";
import type { PatientRecord } from "@/lib/portal-storage";

type AnswerValue = string | number | boolean | string[];
type AnswerMap = Record<string, AnswerValue>;

const TOTAL_SECTIONS = registrationSections.length;

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6">
      <div
        className="bg-teal-600 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PatientIdCard({ record }: { record: PatientRecord }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(record.patientId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 mb-4">
            <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registration complete!</h1>
          <p className="text-gray-500 mt-1">Welcome, {record.fullName}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your permanent patient ID</p>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-mono font-bold text-teal-700 tracking-widest">{record.patientId}</span>
            <button
              onClick={copy}
              className="ml-auto px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-sm font-medium hover:bg-teal-100 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Save this ID — you will need it for all future consultations.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 mb-6 space-y-1">
          {record.age && <p><span className="font-medium">Age:</span> {record.age}</p>}
          {record.gender && <p><span className="font-medium">Gender:</span> {record.gender}</p>}
          {record.region && <p><span className="font-medium">Region:</span> {record.region}</p>}
          {record.bmi && <p><span className="font-medium">BMI:</span> {record.bmi.toFixed(1)}</p>}
        </div>

        <div className="space-y-3">
          <a
            href="/patient"
            className="block w-full text-center bg-teal-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-teal-700 transition-colors"
          >
            Back to dashboard
          </a>
          <p className="text-center text-xs text-gray-400">
            Your patient ID is saved. Continue from your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PatientRegister() {
  const router = useRouter();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [dobDraft, setDobDraft] = useState<{ day: string; month: string; year: string }>({ day: "", month: "", year: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState<PatientRecord | null>(null);

  const section = registrationSections[sectionIndex];

  const bmi = useMemo(() => {
    const h = Number(answers.heightCm);
    const w = Number(answers.weightKg);
    if (h > 0 && w > 0) return calculateBmi(w, h);
    return null;
  }, [answers.heightCm, answers.weightKg]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawProfile = window.localStorage.getItem("sei-patient-profile-latest");
    if (!rawProfile) {
      return;
    }

    try {
      const profile = JSON.parse(rawProfile) as { fullName?: string; patientName?: string; phone?: string };
      const resolvedFullName = String(profile.fullName ?? profile.patientName ?? "").trim();
      const resolvedPhone = String(profile.phone ?? "").replace(/\D/g, "");

      setAnswers((prev) => ({
        ...prev,
        ...(resolvedFullName && !prev.fullName ? { fullName: resolvedFullName } : {}),
        ...(resolvedPhone && !prev.phone ? { phone: resolvedPhone } : {}),
      }));
    } catch {
      window.localStorage.removeItem("sei-patient-profile-latest");
    }
  }, []);

  useEffect(() => {
    const normalizedPhone = String(answers.phone ?? "").replace(/\D/g, "");
    if (normalizedPhone.length < 10) {
      return;
    }

    const timer = window.setTimeout(() => {
      void handlePhoneLookup(normalizedPhone);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [answers.phone]);

  function setValue(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  useEffect(() => {
    const raw = String(answers.dateOfBirth ?? "");
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return;
    }

    const next = {
      year: match[1],
      month: String(Number(match[2])),
      day: String(Number(match[3])),
    };

    setDobDraft((prev) =>
      prev.year === next.year && prev.month === next.month && prev.day === next.day
        ? prev
        : next,
    );
  }, [answers.dateOfBirth]);

  function updateDob(next: { year: string; month: string; day: string }) {
    setDobDraft(next);
    if (next.year && next.month && next.day) {
      setValue("dateOfBirth", `${next.year}-${next.month.padStart(2, "0")}-${next.day.padStart(2, "0")}`);
      return;
    }

    setValue("dateOfBirth", "");
  }

  // When phone is entered, try to pre-fill name from existing appointment or patient record
  async function handlePhoneLookup(phone: string) {
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 10) return;

    try {
      // Check localStorage first (PatientRecord)
      const { findPatientRecordByPhone } = await import("@/lib/portal-storage");
      const existing = findPatientRecordByPhone(normalized);
      if (existing?.fullName) {
        setAnswers((prev) => ({
          ...prev,
          fullName: prev.fullName ? prev.fullName : existing.fullName,
        }));
        return;
      }

      const patientResponse = await fetch(`/api/patient-register?phone=${encodeURIComponent(normalized)}`, { cache: "no-store" });
      const patientPayload = (await patientResponse.json()) as { ok?: boolean; record?: { fullName?: string } | null };
      if (patientResponse.ok && patientPayload.ok && patientPayload.record?.fullName) {
        setAnswers((prev) => ({
          ...prev,
          fullName: prev.fullName ? prev.fullName : (patientPayload.record!.fullName ?? ""),
        }));
        return;
      }

      // Check appointments API
      const res = await fetch(`/api/appointments?phone=${encodeURIComponent(normalized)}`, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; appointments?: Array<{ patientName?: string }> };
      if (res.ok && data.ok && data.appointments?.[0]?.patientName) {
        setAnswers((prev) => ({
          ...prev,
          fullName: prev.fullName ? prev.fullName : (data.appointments![0].patientName ?? ""),
        }));
      }
    } catch {
      // silently ignore
    }
  }

  function canAdvance() {
    const visibleRequired = (section?.questions ?? []).filter((q) => {
      if (!q.required) return false;
      if (q.showIf) return q.showIf(answers);
      return true;
    });
    return visibleRequired.every((q) => {
      const v = answers[q.id];
      if (v === undefined || v === null || v === "") return false;
      // consent toggles must explicitly be true
      if (q.type === "toggle") return v === true;
      return true;
    });
  }

  function handleNext() {
    if (sectionIndex < TOTAL_SECTIONS - 1) {
      setSectionIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleSubmit();
    }
  }

  function handleBack() {
    if (sectionIndex > 0) setSectionIndex((i) => i - 1);
    else router.push("/patient");
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const body = {
        fullName: String(answers.fullName ?? ""),
        phone: String(answers.phone ?? ""),
        email: answers.email ? String(answers.email) : undefined,
        dateOfBirth: answers.dateOfBirth ? String(answers.dateOfBirth) : undefined,
        age: answers.dateOfBirth
          ? Math.floor((Date.now() - new Date(String(answers.dateOfBirth)).getTime()) / (365.25 * 24 * 3600 * 1000))
          : undefined,
        gender: answers.gender ? String(answers.gender) : undefined,
        heightCm: answers.heightCm ? Number(answers.heightCm) : undefined,
        weightKg: answers.weightKg ? Number(answers.weightKg) : undefined,
        bmi: bmi ?? undefined,
        region: answers.city ? String(answers.city) : undefined,
        preferredLanguage: answers.preferredLanguage ? String(answers.preferredLanguage) : undefined,
        dailyActivity: answers.occupation ? String(answers.occupation) : undefined,
        comorbidities: Array.isArray(answers.medicalHistory) ? answers.medicalHistory : [],
        currentMeds: answers.currentMedicines ? [String(answers.currentMedicines)] : [],
        priorSurgery: Boolean(answers.priorSpineSurgery),
        surgeryDetails: answers.spineSurgeryDetails ? String(answers.spineSurgeryDetails) : undefined,
        // v4 extra fields passed through as JSON extras
        extras: {
          country: answers.country,
          activityLevel: answers.activityLevel,
          smoking: answers.smoking,
          alcohol: answers.alcohol,
          drugAllergies: answers.drugAllergies,
          otherSurgeries: answers.otherSurgeries,
          emergencyName: answers.emergencyName,
          emergencyPhone: answers.emergencyPhone,
          emergencyRelation: answers.emergencyRelation,
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

      const payload = (await response.json()) as { ok: boolean; record?: PatientRecord; message?: string };
      if (!response.ok || !payload.ok || !payload.record) {
        setError(payload.message ?? "Registration failed. Please try again.");
        return;
      }

      // Persist locally too so dashboard can read without a DB call
      if (typeof window !== "undefined") {
        const { savePatientRecord } = await import("@/lib/portal-storage");
        savePatientRecord({
          phone: body.phone.replace(/\D/g, ""),
          fullName: body.fullName,
          email: body.email,
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
          priorSurgery: body.priorSurgery,
          surgeryDetails: body.surgeryDetails,
        });
      }

      setRegistered(payload.record);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (registered) {
    return <PatientIdCard record={registered} />;
  }

  if (!section) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleBack} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium">Step {sectionIndex + 1} of {TOTAL_SECTIONS}</p>
          </div>
        </div>

        <ProgressBar current={sectionIndex + 1} total={TOTAL_SECTIONS} />

        {/* Section heading */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">{section.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{section.subtitle}</p>
        </div>

        {/* Questions */}
        <div className="space-y-5">
          {section.questions.map((q) => {
            const showIf = q.showIf ? q.showIf(answers) : true;
            if (!showIf) return null;

            const value = answers[q.id];

            if (q.type === "info-link" && q.id === "bmi") {
              return (
                <div key={q.id} className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                  <p className="text-xs font-medium text-teal-700 mb-1">BMI (auto-calculated)</p>
                  <p className="text-2xl font-bold text-teal-800">
                    {bmi ? bmi.toFixed(1) : "—"}
                  </p>
                  {bmi && (
                    <p className="text-xs text-teal-600 mt-0.5">
                      {bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal weight" : bmi < 30 ? "Overweight" : "Obese"}
                    </p>
                  )}
                </div>
              );
            }

            if (q.type === "toggle") {
              return (
                <div key={q.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                  <span className="text-sm text-gray-700 pr-4">{q.label}</span>
                  <button
                    role="switch"
                    aria-checked={Boolean(value)}
                    onClick={() => setValue(q.id, !value)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${Boolean(value) ? "bg-teal-600" : "bg-gray-200"}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${Boolean(value) ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              );
            }

            if (q.type === "select" || q.type === "radio") {
              return (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {q.label}{q.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <select
                    value={String(value ?? "")}
                    onChange={(e) => setValue(q.id, e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select…</option>
                    {q.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (q.type === "multi-select") {
              const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
              return (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{q.label}</label>
                  <div className="space-y-2">
                    {q.options?.map((opt) => {
                      const checked = selected.includes(opt.value);
                      return (
                        <label key={opt.value} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${checked ? "border-teal-500 bg-teal-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked ? selected.filter((v) => v !== opt.value) : [...selected, opt.value];
                              setValue(q.id, next);
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (q.type === "textarea") {
              return (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{q.label}</label>
                  <textarea
                    value={String(value ?? "")}
                    onChange={(e) => setValue(q.id, e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    placeholder="Type here…"
                  />
                </div>
              );
            }

            // ── Special: Date of Birth — Day / Month / Year dropdowns ──────────
            if (q.type === "date" && q.id === "dateOfBirth") {
              const selYear = dobDraft.year;
              const selMonth = dobDraft.month;
              const selDay = dobDraft.day;

              const currentYear = new Date().getFullYear();
              const years = Array.from({ length: 101 }, (_, i) => currentYear - i);
              const months = [
                "January","February","March","April","May","June",
                "July","August","September","October","November","December",
              ];
              const daysInMonth = selYear && selMonth
                ? new Date(Number(selYear), Number(selMonth), 0).getDate()
                : 31;
              const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

              return (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {q.label}<span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={selDay}
                      onChange={(e) => updateDob({ year: selYear, month: selMonth, day: e.target.value })}
                      className="border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Day</option>
                      {days.map((d) => <option key={d} value={String(d)}>{d}</option>)}
                    </select>
                    <select
                      value={selMonth}
                      onChange={(e) => updateDob({ year: selYear, month: e.target.value, day: selDay })}
                      className="border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Month</option>
                      {months.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
                    </select>
                    <select
                      value={selYear}
                      onChange={(e) => updateDob({ year: e.target.value, month: selMonth, day: selDay })}
                      className="border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Year</option>
                      {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                  </div>
                </div>
              );
            }

            // text / tel / number / date (fallback)
            return (
              <div key={q.id}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {q.label}{q.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type={q.type === "number" ? "number" : q.type === "tel" ? "tel" : "text"}
                  value={String(value ?? "")}
                  onChange={(e) => setValue(q.id, q.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                  onBlur={q.id === "phone" ? (e) => handlePhoneLookup(e.target.value) : undefined}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder={q.type === "tel" ? "10-digit mobile number" : ""}
                />
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={handleNext}
            disabled={!canAdvance() || saving}
            className="w-full bg-teal-600 text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : sectionIndex < TOTAL_SECTIONS - 1 ? "Next" : "Complete registration"}
          </button>
        </div>
      </div>
    </div>
  );
}
