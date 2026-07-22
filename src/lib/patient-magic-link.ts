import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type MagicLinkEntry = {
  tokenHash: string;
  phone: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

type MagicLinkAuditEvent = {
  at: string;
  action: "issued" | "consumed" | "revoked" | "consume_failed";
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

const storePath = join(process.cwd(), "data", "patient-magic-links.json");
const MAGIC_LINK_TTL_HOURS = 24;
const MAX_AUDIT_EVENTS = 5000;

function nowIso() {
  return new Date().toISOString();
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isExpired(expiresAt: string, now = Date.now()) {
  const expiry = new Date(expiresAt).getTime();
  return Number.isNaN(expiry) || expiry <= now;
}

function sanitizeStore(store: MagicLinkStore) {
  const now = Date.now();
  store.entries = store.entries.filter((entry) => {
    if (entry.usedAt) {
      return false;
    }

    return !isExpired(entry.expiresAt, now);
  });

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

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + MAGIC_LINK_TTL_HOURS * 60 * 60 * 1000).toISOString();

  store.entries.push({
    tokenHash,
    phone: normalizedPhone,
    createdAt: createdAt.toISOString(),
    expiresAt,
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

  match.usedAt = nowIso();
  pushAudit(store, {
    action: "revoked",
    phone: match.phone,
    tokenHash,
    note,
  });

  await writeStore(store);
}

export async function consumePatientMagicLink(token: string): Promise<ConsumeMagicLinkResult> {
  if (!token || token.length < 20) {
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
  const endpoint = process.env.MSG91_FLOW_ENDPOINT?.trim() || "https://control.msg91.com/api/v5/flow/";

  const payload = {
    template_id: templateId,
    short_url: "0",
    recipients: [
      {
        mobiles: asIndianMobile(input.phone),
        link: input.magicLink,
      },
    ],
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "MSG91 error");
    throw new Error(`MSG91 request failed (${response.status}): ${details}`);
  }
}