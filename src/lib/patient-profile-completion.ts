import type { PatientRecord } from "@/lib/portal-storage";

function hasText(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function hasPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isPatientProfileComplete(record: Partial<PatientRecord> | null | undefined) {
  if (!record) {
    return false;
  }

  return (
    hasText(record.patientId) &&
    hasText(record.fullName) &&
    hasPositiveNumber(record.age) &&
    hasText(record.gender) &&
    hasText(record.region) &&
    hasText(record.preferredLanguage) &&
    hasPositiveNumber(record.heightCm) &&
    hasPositiveNumber(record.weightKg)
  );
}
