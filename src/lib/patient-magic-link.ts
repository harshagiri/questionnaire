import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { prisma } from "@/lib/prisma";

type MagicLinkEntry = {
  tokenHash: string;
  token?: string;
  phone: string;
  createdAt: string;
  expiresAt: string;
  smsStatus?: "pending" | "sent" | "failed" | "skipped";
  smsError?: string;
  smsSentAt?: string;
  smsFailedAt?: string;
  smsSkippedAt?: string;
  revokedAt?: string;
  usedAt?: string;
};

type MagicLinkAuditEvent = {
  at: string;
  action: "issued" | "sms_sent" | "sms_failed" | "sms_skipped" | "consumed" | "revoked" | "consume_failed";
  phone?: string;
  tokenHash: string;
  note?: string;
};

type MagicLinkStore = {
  entries: MagicLinkEntry[];
  audit: MagicLinkAuditEvent[];
};

type IssueMagicLinkResult = {
  token: string;
  expiresAt: string;
};

type ConsumeMagicLinkResult =
  | { ok: true; phone: string; expiresAt: string }
  | { ok: false; message: string };

export type MagicLinkDeliveryStatus = {
  id: string;
  phone: string;
  createdAt: string;
  expiresAt: string;
  token?: string;
  status: "pending" | "sent" | "failed" | "skipped" | "used" | "revoked" | "expired";
  note?: string;
};

export type MagicLinkResolutionResult = {
  phone: string;
  token: string;
  expiresAt: string;
  reusedExisting: boolean;
  tokenHash: string;
};

const storePath = join(process.cwd(), "data", "patient-magic-links.json");
const MAGIC_LINK_TTL_HOURS = 24;
const MAX_AUDIT_EVENTS = 5000;
const MAX_MAGIC_LINK_URL_LENGTH = 160;

function nowIso() {
  return new Date().toISOString();
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createMagicToken() {
  // Compact base64url token keeps URL short while preserving high entropy.
  const token = randomBytes(16).toString("base64url");
  return /^[A-Za-z0-9]/.test(token) ? token : `a${token.slice(1)}`;
}

export function buildPatientMagicLink(baseUrl: string, token: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const link = `${normalizedBaseUrl}/m/${encodeURIComponent(token)}`;
  if (link.length > MAX_MAGIC_LINK_URL_LENGTH) {
    throw new Error(`Magic link URL exceeds ${MAX_MAGIC_LINK_URL_LENGTH} characters`);
  }
  return link;
}

function isExpired(expiresAt: string, now = Date.now()) {
  const expiry = new Date(expiresAt).getTime();
  return Number.isNaN(expiry) || expiry <= now;
}

function sanitizeStore(store: MagicLinkStore) {
  const now = Date.now();
  store.entries = store.entries.filter((entry) => !isExpired(entry.expiresAt, now));

  if (store.audit.length > MAX_AUDIT_EVENTS) {
    store.audit = store.audit.slice(store.audit.length - MAX_AUDIT_EVENTS);
  }
}

async function readStore(): Promise<MagicLinkStore> {
  if (prisma) {
    try {
      const [entries, audit] = await Promise.all([
        prisma.patientMagicLink.findMany({
          orderBy: { createdAt: "desc" },
        }),
        prisma.patientMagicLinkAudit.findMany({
          orderBy: { at: "desc" },
          take: MAX_AUDIT_EVENTS,
        }),
      ]);

      return {
        entries: entries.map((entry) => ({
          tokenHash: entry.tokenHash,
          token: entry.token ?? undefined,
          phone: entry.phone,
          createdAt: entry.createdAt.toISOString(),
          expiresAt: entry.expiresAt.toISOString(),
          smsStatus: (entry.smsStatus as MagicLinkEntry["smsStatus"]) ?? undefined,
          smsError: entry.smsError ?? undefined,
          smsSentAt: entry.smsSentAt?.toISOString(),
          smsFailedAt: entry.smsFailedAt?.toISOString(),
          smsSkippedAt: entry.smsSkippedAt?.toISOString(),
          revokedAt: entry.revokedAt?.toISOString(),
          usedAt: entry.usedAt?.toISOString(),
        })),
        audit: audit
          .sort((a, b) => a.at.getTime() - b.at.getTime())
          .map((event) => ({
            at: event.at.toISOString(),
            action: event.action as MagicLinkAuditEvent["action"],
            phone: event.phone ?? undefined,
            tokenHash: event.tokenHash,
            note: event.note ?? undefined,
          })),
      };
    } catch {
      return {
        entries: [],
        audit: [],
      };
    }
  }

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<MagicLinkStore>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    };
  } catch {
    return {
      entries: [],
      audit: [],
    };
  }
}

async function writeStore(store: MagicLinkStore) {
  if (prisma) {
    const entriesData = store.entries.map((entry) => ({
      tokenHash: entry.tokenHash,
      token: entry.token ?? null,
      phone: entry.phone,
      createdAt: new Date(entry.createdAt),
      expiresAt: new Date(entry.expiresAt),
      smsStatus: entry.smsStatus ?? null,
      smsError: entry.smsError ?? null,
      smsSentAt: entry.smsSentAt ? new Date(entry.smsSentAt) : null,
      smsFailedAt: entry.smsFailedAt ? new Date(entry.smsFailedAt) : null,
      smsSkippedAt: entry.smsSkippedAt ? new Date(entry.smsSkippedAt) : null,
      revokedAt: entry.revokedAt ? new Date(entry.revokedAt) : null,
      usedAt: entry.usedAt ? new Date(entry.usedAt) : null,
    }));

    const auditData = store.audit.map((event) => ({
      at: new Date(event.at),
      action: event.action,
      phone: event.phone ?? null,
      tokenHash: event.tokenHash,
      note: event.note ?? null,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.patientMagicLink.deleteMany({});
      if (entriesData.length > 0) {
        await tx.patientMagicLink.createMany({ data: entriesData });
      }

      await tx.patientMagicLinkAudit.deleteMany({});
      if (auditData.length > 0) {
        await tx.patientMagicLinkAudit.createMany({ data: auditData });
      }
    });

    return;
  }

  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

function pushAudit(store: MagicLinkStore, event: Omit<MagicLinkAuditEvent, "at">) {
  store.audit.push({ at: nowIso(), ...event });
  if (store.audit.length > MAX_AUDIT_EVENTS) {
    store.audit = store.audit.slice(store.audit.length - MAX_AUDIT_EVENTS);
  }
}

export async function issuePatientMagicLink(input: { phone: string }): Promise<IssueMagicLinkResult> {
  const normalizedPhone = normalizePhone(input.phone);
  if (normalizedPhone.length < 10) {
    throw new Error("Invalid phone number");
  }

  const store = await readStore();
  sanitizeStore(store);

  const token = createMagicToken();
  const tokenHash = hashToken(token);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + MAGIC_LINK_TTL_HOURS * 60 * 60 * 1000).toISOString();

  store.entries.push({
    tokenHash,
    token,
    phone: normalizedPhone,
    createdAt: createdAt.toISOString(),
    expiresAt,
    smsStatus: "pending",
  });

  pushAudit(store, {
    action: "issued",
    phone: normalizedPhone,
    tokenHash,
  });

  await writeStore(store);

  return {
    token,
    expiresAt,
  };
}

export async function revokePatientMagicLink(token: string, note = "SMS dispatch failed") {
  const store = await readStore();
  sanitizeStore(store);

  const tokenHash = hashToken(token);
  const match = store.entries.find((entry) => entry.tokenHash === tokenHash);
  if (!match) {
    return;
  }

  match.revokedAt = nowIso();
  match.smsStatus = "failed";
  match.smsError = note;
  match.smsFailedAt = nowIso();
  pushAudit(store, {
    action: "revoked",
    phone: match.phone,
    tokenHash,
    note,
  });

  await writeStore(store);
}

export async function consumePatientMagicLink(token: string): Promise<ConsumeMagicLinkResult> {
  if (!token || token.length < 12) {
    return { ok: false, message: "Invalid magic link" };
  }

  const tokenHash = hashToken(token);
  const store = await readStore();
  sanitizeStore(store);

  const match = store.entries.find((entry) => entry.tokenHash === tokenHash);
  if (!match) {
    pushAudit(store, {
      action: "consume_failed",
      tokenHash,
      note: "Not found",
    });
    await writeStore(store);
    return { ok: false, message: "Magic link is invalid or expired" };
  }

  if (match.revokedAt) {
    pushAudit(store, {
      action: "consume_failed",
      phone: match.phone,
      tokenHash,
      note: "Revoked",
    });
    await writeStore(store);
    return { ok: false, message: "Magic link is invalid or expired" };
  }

  if (match.usedAt) {
    // Allow repeated opens while the link is still within the validity window.
    pushAudit(store, {
      action: "consumed",
      phone: match.phone,
      tokenHash,
      note: "Reused active link",
    });
    await writeStore(store);
    return {
      ok: true,
      phone: match.phone,
      expiresAt: match.expiresAt,
    };
  }

  if (isExpired(match.expiresAt)) {
    pushAudit(store, {
      action: "consume_failed",
      phone: match.phone,
      tokenHash,
      note: "Expired",
    });
    await writeStore(store);
    return { ok: false, message: "Magic link expired" };
  }

  match.usedAt = nowIso();
  pushAudit(store, {
    action: "consumed",
    phone: match.phone,
    tokenHash,
  });
  await writeStore(store);

  return {
    ok: true,
    phone: match.phone,
    expiresAt: match.expiresAt,
  };
}

async function markMagicLinkSmsStatus(input: {
  token: string;
  status: "sent" | "failed" | "skipped";
  note?: string;
}) {
  const store = await readStore();
  sanitizeStore(store);
  const tokenHash = hashToken(input.token);
  const match = store.entries.find((entry) => entry.tokenHash === tokenHash);
  if (!match) {
    return;
  }

  if (input.status === "sent") {
    match.smsStatus = "sent";
    match.smsSentAt = nowIso();
    match.smsError = undefined;
    pushAudit(store, {
      action: "sms_sent",
      phone: match.phone,
      tokenHash,
    });
  } else if (input.status === "failed") {
    match.smsStatus = "failed";
    match.smsFailedAt = nowIso();
    match.smsError = input.note;
    pushAudit(store, {
      action: "sms_failed",
      phone: match.phone,
      tokenHash,
      note: input.note,
    });
  } else {
    match.smsStatus = "skipped";
    match.smsSkippedAt = nowIso();
    pushAudit(store, {
      action: "sms_skipped",
      phone: match.phone,
      tokenHash,
      note: input.note,
    });
  }

  await writeStore(store);
}

export async function markMagicLinkSmsSent(token: string) {
  await markMagicLinkSmsStatus({ token, status: "sent" });
}

export async function markMagicLinkSmsFailed(token: string, note: string) {
  await markMagicLinkSmsStatus({ token, status: "failed", note });
}

export async function markMagicLinkSmsSkipped(token: string, note = "SMS skipped for testing") {
  await markMagicLinkSmsStatus({ token, status: "skipped", note });
}

function entryStatus(entry: MagicLinkEntry): MagicLinkDeliveryStatus["status"] {
  if (isExpired(entry.expiresAt)) {
    return "expired";
  }
  if (entry.usedAt) {
    return "used";
  }
  if (entry.revokedAt) {
    return "revoked";
  }
  if (entry.smsStatus === "sent") {
    return "sent";
  }
  if (entry.smsStatus === "failed") {
    return "failed";
  }
  if (entry.smsStatus === "skipped") {
    return "skipped";
  }
  return "pending";
}

export async function listRecentMagicLinkStatuses(limit = 20): Promise<MagicLinkDeliveryStatus[]> {
  const store = await readStore();
  sanitizeStore(store);
  const sorted = [...store.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sliced = sorted.slice(0, Math.max(1, limit));

  return sliced.map((entry) => ({
    id: entry.tokenHash,
    phone: entry.phone,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    token: entry.token,
    status: entryStatus(entry),
    note: entry.smsError,
  }));
}

function isReusable(entry: MagicLinkEntry, now = Date.now()) {
  return !entry.revokedAt && !entry.usedAt && !isExpired(entry.expiresAt, now);
}

export async function resolveMagicLinkForPhone(input: {
  phone: string;
  preferredEntryId?: string;
}): Promise<MagicLinkResolutionResult> {
  const normalizedPhone = normalizePhone(input.phone);
  if (normalizedPhone.length < 10) {
    throw new Error("Invalid phone number");
  }

  const store = await readStore();
  sanitizeStore(store);
  const now = Date.now();

  const forPhone = store.entries
    .filter((entry) => entry.phone === normalizedPhone)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const preferred = input.preferredEntryId
    ? forPhone.find((entry) => entry.tokenHash === input.preferredEntryId)
    : undefined;

  const chosen =
    (preferred && isReusable(preferred, now) && preferred.token ? preferred : undefined) ??
    forPhone.find((entry) => isReusable(entry, now) && Boolean(entry.token));

  if (chosen?.token) {
    return {
      phone: normalizedPhone,
      token: chosen.token,
      expiresAt: chosen.expiresAt,
      reusedExisting: true,
      tokenHash: chosen.tokenHash,
    };
  }

  const token = createMagicToken();
  const tokenHash = hashToken(token);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + MAGIC_LINK_TTL_HOURS * 60 * 60 * 1000).toISOString();

  store.entries.push({
    tokenHash,
    token,
    phone: normalizedPhone,
    createdAt: createdAt.toISOString(),
    expiresAt,
    smsStatus: "pending",
  });

  pushAudit(store, {
    action: "issued",
    phone: normalizedPhone,
    tokenHash,
    note: "Issued during resend",
  });

  await writeStore(store);

  return {
    phone: normalizedPhone,
    token,
    expiresAt,
    reusedExisting: false,
    tokenHash,
  };
}

function asIndianMobile(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  return normalizedPhone.startsWith("91") && normalizedPhone.length === 12
    ? normalizedPhone
    : `91${normalizedPhone}`;
}

export async function sendMagicLinkViaMsg91(input: {
  phone: string;
  magicLink: string;
}) {
  const apiKey = process.env.FAST2SMS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("FAST2SMS_API_KEY is not configured");
  }

  const endpoint = process.env.FAST2SMS_ENDPOINT?.trim() || "https://www.fast2sms.com/dev/bulkV2";
  const senderId = process.env.FAST2SMS_SENDER_ID?.trim();
  const route = process.env.FAST2SMS_ROUTE?.trim() || "q";

  const payload: {
    route: string;
    sender_id?: string;
    message: string;
    language: string;
    flash: number;
    numbers: string;
  } = {
    route,
    message: `SpinExperts pre-consult form:\n${input.magicLink}`,
    language: "english",
    flash: 0,
    numbers: asIndianMobile(input.phone),
  };

  if (senderId) {
    payload.sender_id = senderId;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: apiKey,
    },
    body: JSON.stringify(payload),
  });

  const details = await response.text().catch(() => "FAST2SMS error");
  let parsed: { return?: boolean; message?: unknown; request_id?: string } | null = null;
  try {
    parsed = JSON.parse(details) as { return?: boolean; message?: unknown; request_id?: string };
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.return === false) {
    throw new Error(`FAST2SMS request failed (${response.status}): ${details}`);
  }
}