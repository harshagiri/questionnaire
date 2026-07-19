const DOCTOR_PREFIX_PATTERN = /^(?:dr\.?|doctor)\s+/i;

export function formatDoctorDisplayName(name: string | null | undefined) {
  const trimmedName = (name ?? "").trim();

  if (!trimmedName) {
    return "";
  }

  // Keep existing prefixes but normalize them to the same output style.
  if (DOCTOR_PREFIX_PATTERN.test(trimmedName)) {
    return trimmedName
      .replace(/^doctor\s+/i, "")
      .replace(/^dr\.?\s*/i, "")
      .trim()
      .replace(/^/, "Dr. ");
  }

  return `Dr. ${trimmedName}`;
}

export function formatDoctorOptionLabel(name: string | null | undefined, registrationNumber?: string | null) {
  const displayName = formatDoctorDisplayName(name);
  const trimmedRegistrationNumber = (registrationNumber ?? "").trim();

  if (!displayName) {
    return "";
  }

  return trimmedRegistrationNumber ? `${displayName} (${trimmedRegistrationNumber})` : displayName;
}