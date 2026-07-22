import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

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
  return randomBytes(16).toString("base64url");
}

export function buildPatientMagicLink(baseUrl: string, token: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const link = `${normalizedBaseUrl}/m?t=${encodeURIComponent(token)}`;
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
    pushAudit(store, {
      action: "consume_failed",
      phone: match.phone,
      tokenHash,
      note: "Already used",
    });
    await writeStore(store);
    return { ok: false, message: "Magic link already used" };
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
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  if (!authKey) {
    throw new Error("MSG91_AUTH_KEY is not configured");
  }

  const templateId = process.env.MSG91_TEMPLATE_ID?.trim() || "6a5e46663de7e5b4370dc5e5";
  const dltTemplateId = process.env.MSG91_DLT_TEMPLATE_ID?.trim();
  const linkVariableName = process.env.MSG91_LINK_VARIABLE?.trim() || "link";
  const shortUrlFlag = process.env.MSG91_SHORT_URL?.trim() || "1";
  const endpoint = process.env.MSG91_FLOW_ENDPOINT?.trim() || "https://control.msg91.com/api/v5/flow/";

  const recipient: Record<string, string> = {
    mobiles: asIndianMobile(input.phone),
    link: input.magicLink,
    url: input.magicLink,
    VAR1: input.magicLink,
  };
  recipient[linkVariableName] = input.magicLink;

  const payload: {
    template_id: string;
    short_url: string;
    recipients: Record<string, string>[];
    dlt_template_id?: string;
  } = {
    template_id: templateId,
    short_url: shortUrlFlag,
    recipients: [recipient],
  };

  if (dltTemplateId) {
    payload.dlt_template_id = dltTemplateId;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify(payload),
  });

  const details = await response.text().catch(() => "MSG91 error");
  let parsed: { type?: string; message?: string } | null = null;
  try {
    parsed = JSON.parse(details) as { type?: string; message?: string };
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.type === "error") {
    throw new Error(`MSG91 request failed (${response.status}): ${details}`);
  }
}