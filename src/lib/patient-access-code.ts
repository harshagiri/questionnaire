import { randomInt } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type AccessCodeActorRole = "receptionist" | "admin" | "doctor" | "patient" | "system";

type AccessCodeEntry = {
  phone: string;
  code: string;
  issuedAt: string;
  expiresAt: string;
  attempts: number;
  lockedUntil?: string;
  lastVerifiedAt?: string;
};

type AccessCodeAuditEvent = {
  at: string;
  action:
    | "issued"
    | "rotated"
    | "viewed"
    | "verify_success"
    | "verify_failed"
    | "verify_failed_locked"
    | "verify_failed_missing"
    | "verify_failed_expired";
  phone: string;
  actorRole: AccessCodeActorRole;
  actorName?: string;
  note?: string;
};

type AccessCodeStore = {
  entries: Record<string, AccessCodeEntry>;
  audit: AccessCodeAuditEvent[];
};

type StaffAccessCodeResult = {
  code: string;
  expiresAt: string;
  minutesRemaining: number;
};

type VerifyAccessCodeResult = {
  ok: boolean;
  message?: string;
};

const storePath = join(process.cwd(), "data", "patient-access-codes.json");
const CODE_TTL_MINUTES = 30;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const MAX_AUDIT_EVENTS = 5000;

function nowIso() {
  return new Date().toISOString();
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function makeCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isExpired(entry: AccessCodeEntry, at = new Date()) {
  const expiresAt = parseDate(entry.expiresAt);
  if (!expiresAt) {
    return true;
  }

  return expiresAt.getTime() <= at.getTime();
}

function isLocked(entry: AccessCodeEntry, at = new Date()) {
  const lockedUntil = parseDate(entry.lockedUntil);
  if (!lockedUntil) {
    return false;
  }

  return lockedUntil.getTime() > at.getTime();
}

function toMinutesRemaining(expiresAt: string) {
  const expiry = parseDate(expiresAt);
  if (!expiry) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 60_000));
}

async function readStore(): Promise<AccessCodeStore> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AccessCodeStore>;
    return {
      entries: parsed.entries ?? {},
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    };
  } catch {
    return {
      entries: {},
      audit: [],
    };
  }
}

async function writeStore(store: AccessCodeStore) {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

function pushAudit(
  store: AccessCodeStore,
  event: Omit<AccessCodeAuditEvent, "at">,
) {
  store.audit.push({ at: nowIso(), ...event });

  if (store.audit.length > MAX_AUDIT_EVENTS) {
    store.audit = store.audit.slice(store.audit.length - MAX_AUDIT_EVENTS);
  }
}

function getOrCreateEntry(store: AccessCodeStore, phone: string, rotate: boolean) {
  const normalizedPhone = normalizePhone(phone);
  const current = store.entries[normalizedPhone];

  if (!current) {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CODE_TTL_MINUTES * 60_000);
    const created: AccessCodeEntry = {
      phone: normalizedPhone,
      code: makeCode(),
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
    };

    store.entries[normalizedPhone] = created;
    return { entry: created, created: true, rotated: false };
  }

  if (!rotate && !isExpired(current) && !isLocked(current)) {
    return { entry: current, created: false, rotated: false };
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CODE_TTL_MINUTES * 60_000);
  const updated: AccessCodeEntry = {
    ...current,
    code: makeCode(),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    attempts: 0,
    lockedUntil: undefined,
  };

  store.entries[normalizedPhone] = updated;
  return { entry: updated, created: false, rotated: true };
}

export function isValidPatientPhone(phone: string) {
  return normalizePhone(phone).length >= 10;
}

export async function issuePatientAccessCode(input: {
  phone: string;
  rotate?: boolean;
  actorRole: AccessCodeActorRole;
  actorName?: string;
}): Promise<StaffAccessCodeResult> {
  const normalizedPhone = normalizePhone(input.phone);
  if (!isValidPatientPhone(normalizedPhone)) {
    throw new Error("Invalid phone number");
  }

  const store = await readStore();
  const { entry, created, rotated } = getOrCreateEntry(store, normalizedPhone, Boolean(input.rotate));

  pushAudit(store, {
    action: created ? "issued" : rotated ? "rotated" : "viewed",
    phone: normalizedPhone,
    actorRole: input.actorRole,
    actorName: input.actorName,
  });

  await writeStore(store);

  return {
    code: entry.code,
    expiresAt: entry.expiresAt,
    minutesRemaining: toMinutesRemaining(entry.expiresAt),
  };
}

export async function verifyPatientAccessCode(input: {
  phone: string;
  otp: string;
}): Promise<VerifyAccessCodeResult> {
  const normalizedPhone = normalizePhone(input.phone);
  const otp = input.otp.trim();

  if (!isValidPatientPhone(normalizedPhone)) {
    return { ok: false, message: "Invalid phone number" };
  }

  if (!otp) {
    return { ok: false, message: "Enter access code" };
  }

  const store = await readStore();
  const entry = store.entries[normalizedPhone];

  if (!entry) {
    pushAudit(store, {
      action: "verify_failed_missing",
      phone: normalizedPhone,
      actorRole: "patient",
      note: "No code issued",
    });
    await writeStore(store);
    return { ok: false, message: "Access code not issued yet. Ask reception." };
  }

  const lockedUntil = parseDate(entry.lockedUntil);
  if (isLocked(entry) && lockedUntil) {
    pushAudit(store, {
      action: "verify_failed_locked",
      phone: normalizedPhone,
      actorRole: "patient",
      note: `Locked until ${entry.lockedUntil}`,
    });
    await writeStore(store);
    const mins = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
    return { ok: false, message: `Too many attempts. Try again in ${mins} min or ask reception.` };
  }

  if (isExpired(entry)) {
    pushAudit(store, {
      action: "verify_failed_expired",
      phone: normalizedPhone,
      actorRole: "patient",
      note: `Expired at ${entry.expiresAt}`,
    });
    await writeStore(store);
    return { ok: false, message: "Access code expired. Ask reception for a new code." };
  }

  if (otp !== entry.code) {
    const failedAttempts = entry.attempts + 1;
    entry.attempts = failedAttempts;

    if (failedAttempts >= MAX_ATTEMPTS) {
      entry.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
      entry.attempts = 0;
      pushAudit(store, {
        action: "verify_failed_locked",
        phone: normalizedPhone,
        actorRole: "patient",
        note: "Max attempts reached",
      });
      await writeStore(store);
      return { ok: false, message: `Too many attempts. Try again in ${LOCK_MINUTES} min or ask reception.` };
    }

    store.entries[normalizedPhone] = entry;
    pushAudit(store, {
      action: "verify_failed",
      phone: normalizedPhone,
      actorRole: "patient",
      note: `Attempt ${failedAttempts}`,
    });
    await writeStore(store);
    return { ok: false, message: `Invalid access code (${MAX_ATTEMPTS - failedAttempts} attempts left).` };
  }

  entry.attempts = 0;
  entry.lockedUntil = undefined;
  entry.lastVerifiedAt = nowIso();
  store.entries[normalizedPhone] = entry;

  pushAudit(store, {
    action: "verify_success",
    phone: normalizedPhone,
    actorRole: "patient",
  });

  await writeStore(store);
  return { ok: true };
}
