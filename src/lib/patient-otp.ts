import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type OtpRequestEntry = {
  requestId: string;
  phone: string;
  otpHash: string;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  consumedAt?: string;
};

type VerifyTokenEntry = {
  tokenHash: string;
  phone: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
};

type RateState = {
  lastRequestAt?: string;
  requestLog: string[];
  lockedUntil?: string;
};

type OtpStore = {
  requests: OtpRequestEntry[];
  verifyTokens: VerifyTokenEntry[];
  phoneState: Record<string, RateState>;
  ipState: Record<string, RateState>;
};

type RequestResult = {
  ok: true;
  requestId: string;
  expiresAt: string;
};

type ErrorResult = {
  ok: false;
  message: string;
  retryAfterSeconds?: number;
};

type VerifyResult =
  | {
      ok: true;
      verifyToken: string;
      tokenExpiresAt: string;
    }
  | ErrorResult;

type ConsumeResult =
  | {
      ok: true;
    }
  | ErrorResult;

type IssueTokenResult = {
  ok: true;
  verifyToken: string;
  tokenExpiresAt: string;
};

const storePath = join(process.cwd(), "data", "patient-otp.json");
const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFY_TOKEN_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_VERIFY_TOKENS = 2000;
const MAX_REQUESTS = 5000;

function nowIso() {
  return new Date().toISOString();
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function hashSecret(value: string) {
  const salt = process.env.PATIENT_OTP_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "otp-default-secret";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function secureStringEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function isValidPatientPhone(phone: string) {
  return normalizePhone(phone).length >= 10;
}

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanupStore(store: OtpStore) {
  const now = Date.now();

  store.requests = store.requests.filter((request) => {
    const expiresAt = parseDate(request.expiresAt);
    return Boolean(expiresAt && expiresAt.getTime() + LOCKOUT_MS > now);
  });

  store.verifyTokens = store.verifyTokens.filter((token) => {
    const expiresAt = parseDate(token.expiresAt);
    return Boolean(expiresAt && expiresAt.getTime() > now && !token.consumedAt);
  });

  for (const state of Object.values(store.phoneState)) {
    state.requestLog = state.requestLog.filter((stamp) => {
      const parsed = parseDate(stamp);
      return Boolean(parsed && now - parsed.getTime() <= REQUEST_WINDOW_MS);
    });
  }

  for (const state of Object.values(store.ipState)) {
    state.requestLog = state.requestLog.filter((stamp) => {
      const parsed = parseDate(stamp);
      return Boolean(parsed && now - parsed.getTime() <= REQUEST_WINDOW_MS);
    });
  }

  if (store.requests.length > MAX_REQUESTS) {
    store.requests = store.requests.slice(store.requests.length - MAX_REQUESTS);
  }

  if (store.verifyTokens.length > MAX_VERIFY_TOKENS) {
    store.verifyTokens = store.verifyTokens.slice(store.verifyTokens.length - MAX_VERIFY_TOKENS);
  }
}

async function readStore(): Promise<OtpStore> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<OtpStore>;
    return {
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      verifyTokens: Array.isArray(parsed.verifyTokens) ? parsed.verifyTokens : [],
      phoneState: parsed.phoneState ?? {},
      ipState: parsed.ipState ?? {},
    };
  } catch {
    return {
      requests: [],
      verifyTokens: [],
      phoneState: {},
      ipState: {},
    };
  }
}

async function writeStore(store: OtpStore) {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

function makeOtp() {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

function rateLimitState(store: OtpStore, key: string, bucket: "phoneState" | "ipState") {
  if (!store[bucket][key]) {
    store[bucket][key] = { requestLog: [] };
  }
  return store[bucket][key];
}

function getRetryAfterSeconds(targetTime: Date) {
  return Math.max(1, Math.ceil((targetTime.getTime() - Date.now()) / 1000));
}

function createVerifyToken(store: OtpStore, phone: string): IssueTokenResult {
  const verifyToken = randomUUID();
  const tokenExpiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS).toISOString();

  store.verifyTokens.push({
    tokenHash: hashSecret(`${phone}:${verifyToken}`),
    phone,
    createdAt: nowIso(),
    expiresAt: tokenExpiresAt,
  });

  return {
    ok: true,
    verifyToken,
    tokenExpiresAt,
  };
}

async function sendPatientOtpSms(input: { phone: string; otp: string }) {
  const dltApiUrl = process.env.DLT2SMS_API_URL?.trim();
  const dltApiKey = process.env.DLT2SMS_API_KEY?.trim();
  const dltSenderId = process.env.DLT2SMS_SENDER_ID?.trim();
  const dltTemplateId = process.env.DLT2SMS_TEMPLATE_ID?.trim();
  const dltEntityId = process.env.DLT2SMS_ENTITY_ID?.trim();
  const dltTemplate =
    process.env.DLT2SMS_OTP_TEMPLATE?.trim() ||
    "Your SpinExpert login OTP is {{otp}}. It expires in 5 minutes. Do not share this OTP.";
  const message = dltTemplate.replace(/{{\s*otp\s*}}/gi, input.otp);

  // Prefer DLT2SMS when fully configured.
  if (dltApiUrl && dltApiKey && dltSenderId && dltTemplateId) {
    const dltPayload: Record<string, string> = {
      senderid: dltSenderId,
      number: input.phone,
      text: message,
      templateid: dltTemplateId,
    };

    if (dltEntityId) {
      dltPayload.entityid = dltEntityId;
    }

    const dltResponse = await fetch(dltApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: dltApiKey,
      },
      body: JSON.stringify(dltPayload),
    });

    const dltRaw = await dltResponse.text();
    if (!dltResponse.ok) {
      throw new Error(`DLT2SMS error: ${dltRaw || dltResponse.statusText}`);
    }

    return;
  }

  // Fallback to FAST2SMS (existing provider in this app env).
  const fastApiKey = process.env.FAST2SMS_API_KEY?.trim();
  if (fastApiKey) {
    const fastEndpoint = process.env.FAST2SMS_ENDPOINT?.trim() || "https://www.fast2sms.com/dev/bulkV2";
    const fastSenderId = process.env.FAST2SMS_SENDER_ID?.trim();
    const fastRoute = process.env.FAST2SMS_ROUTE?.trim() || "q";
    const normalizedPhone = normalizePhone(input.phone);
    const destination = normalizedPhone.startsWith("91") && normalizedPhone.length === 12
      ? normalizedPhone
      : `91${normalizedPhone}`;

    const fastPayload: {
      route: string;
      sender_id?: string;
      message: string;
      language: string;
      flash: number;
      numbers: string;
    } = {
      route: fastRoute,
      message: `SpinExperts OTP: ${input.otp}. Valid for 5 minutes.`,
      language: "english",
      flash: 0,
      numbers: destination,
    };

    if (fastSenderId) {
      fastPayload.sender_id = fastSenderId;
    }

    const fastResponse = await fetch(fastEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: fastApiKey,
      },
      body: JSON.stringify(fastPayload),
    });

    const fastRaw = await fastResponse.text().catch(() => "FAST2SMS error");
    let parsedFast: { return?: boolean } | null = null;
    try {
      parsedFast = JSON.parse(fastRaw) as { return?: boolean };
    } catch {
      parsedFast = null;
    }

    if (!fastResponse.ok || parsedFast?.return === false) {
      throw new Error(`FAST2SMS request failed (${fastResponse.status}): ${fastRaw}`);
    }

    return;
  }

  throw new Error(
    "No OTP SMS provider configured. Set DLT2SMS_* or FAST2SMS_* environment variables.",
  );
}

export async function requestPatientOtp(input: { phone: string; ip?: string }): Promise<RequestResult | ErrorResult> {
  const normalizedPhone = normalizePhone(input.phone);
  if (!isValidPatientPhone(normalizedPhone)) {
    return { ok: false, message: "Invalid phone number" };
  }

  const store = await readStore();
  cleanupStore(store);

  const now = new Date();
  const phoneState = rateLimitState(store, normalizedPhone, "phoneState");
  const ipKey = (input.ip ?? "").trim();
  const ipState = ipKey ? rateLimitState(store, ipKey, "ipState") : null;

  const lockedUntil = parseDate(phoneState.lockedUntil);
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    return {
      ok: false,
      message: "Too many failed attempts. Try again later.",
      retryAfterSeconds: getRetryAfterSeconds(lockedUntil),
    };
  }

  const lastRequestAt = parseDate(phoneState.lastRequestAt);
  if (lastRequestAt && Date.now() - lastRequestAt.getTime() < RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      message: "Please wait before requesting a new OTP.",
      retryAfterSeconds: getRetryAfterSeconds(new Date(lastRequestAt.getTime() + RESEND_COOLDOWN_MS)),
    };
  }

  if (phoneState.requestLog.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = parseDate(phoneState.requestLog[0]);
    if (oldest) {
      return {
        ok: false,
        message: "Too many OTP requests. Please try again later.",
        retryAfterSeconds: getRetryAfterSeconds(new Date(oldest.getTime() + REQUEST_WINDOW_MS)),
      };
    }
  }

  if (ipState && ipState.requestLog.length >= MAX_REQUESTS_PER_WINDOW * 2) {
    const oldest = parseDate(ipState.requestLog[0]);
    if (oldest) {
      return {
        ok: false,
        message: "Too many OTP requests from this network. Please try again later.",
        retryAfterSeconds: getRetryAfterSeconds(new Date(oldest.getTime() + REQUEST_WINDOW_MS)),
      };
    }
  }

  const otp = makeOtp();
  const requestId = randomUUID();
  const createdAt = nowIso();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();

  // Invalidate older unconsumed OTPs for this phone.
  for (const request of store.requests) {
    if (request.phone === normalizedPhone && !request.consumedAt) {
      request.consumedAt = createdAt;
    }
  }

  store.requests.push({
    requestId,
    phone: normalizedPhone,
    otpHash: hashSecret(`${normalizedPhone}:${otp}`),
    createdAt,
    expiresAt,
    attempts: 0,
  });

  phoneState.lastRequestAt = createdAt;
  phoneState.requestLog.push(createdAt);
  if (ipState) {
    ipState.lastRequestAt = createdAt;
    ipState.requestLog.push(createdAt);
  }

  await sendPatientOtpSms({ phone: normalizedPhone, otp });
  await writeStore(store);

  return {
    ok: true,
    requestId,
    expiresAt,
  };
}

export async function verifyPatientOtp(input: {
  phone: string;
  otp: string;
  requestId?: string;
  ip?: string;
}): Promise<VerifyResult> {
  const normalizedPhone = normalizePhone(input.phone);
  const otp = String(input.otp ?? "").trim();

  if (!isValidPatientPhone(normalizedPhone)) {
    return { ok: false, message: "Invalid phone number" };
  }

  if (!/^\d{6}$/.test(otp)) {
    return { ok: false, message: "Invalid OTP format" };
  }

  const store = await readStore();
  cleanupStore(store);

  const now = new Date();
  const phoneState = rateLimitState(store, normalizedPhone, "phoneState");
  const lockedUntil = parseDate(phoneState.lockedUntil);
  if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
    return {
      ok: false,
      message: "Too many failed attempts. Try again later.",
      retryAfterSeconds: getRetryAfterSeconds(lockedUntil),
    };
  }

  const activeRequests = store.requests
    .filter((request) => request.phone === normalizedPhone && !request.consumedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const request = input.requestId
    ? activeRequests.find((item) => item.requestId === input.requestId)
    : activeRequests[0];

  if (!request) {
    return { ok: false, message: "OTP not found. Request a new OTP." };
  }

  const expiresAt = parseDate(request.expiresAt);
  if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
    request.consumedAt = nowIso();
    await writeStore(store);
    return { ok: false, message: "OTP expired. Request a new OTP." };
  }

  const expected = hashSecret(`${normalizedPhone}:${otp}`);
  const valid = secureStringEqual(expected, request.otpHash);

  if (!valid) {
    request.attempts += 1;
    if (request.attempts >= MAX_VERIFY_ATTEMPTS) {
      phoneState.lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
      request.consumedAt = nowIso();
      await writeStore(store);
      return {
        ok: false,
        message: "Too many incorrect OTP attempts. Try again later.",
        retryAfterSeconds: getRetryAfterSeconds(new Date(phoneState.lockedUntil)),
      };
    }

    await writeStore(store);
    return {
      ok: false,
      message: `Incorrect OTP. ${MAX_VERIFY_ATTEMPTS - request.attempts} attempts left.`,
    };
  }

  request.consumedAt = nowIso();
  phoneState.lockedUntil = undefined;
  const issuedToken = createVerifyToken(store, normalizedPhone);

  await writeStore(store);

  return issuedToken;
}

export async function issuePatientOtpVerifyToken(input: { phone: string }): Promise<IssueTokenResult | ErrorResult> {
  const normalizedPhone = normalizePhone(input.phone);
  if (!isValidPatientPhone(normalizedPhone)) {
    return { ok: false, message: "Invalid phone number" };
  }

  const store = await readStore();
  cleanupStore(store);
  const issuedToken = createVerifyToken(store, normalizedPhone);
  await writeStore(store);
  return issuedToken;
}

export async function consumePatientOtpToken(input: {
  phone: string;
  verifyToken: string;
}): Promise<ConsumeResult> {
  const normalizedPhone = normalizePhone(input.phone);
  const verifyToken = String(input.verifyToken ?? "").trim();

  if (!isValidPatientPhone(normalizedPhone)) {
    return { ok: false, message: "Invalid phone number" };
  }

  if (!verifyToken) {
    return { ok: false, message: "OTP verification token missing" };
  }

  const store = await readStore();
  cleanupStore(store);

  const tokenHash = hashSecret(`${normalizedPhone}:${verifyToken}`);
  const token = store.verifyTokens.find(
    (item) => item.phone === normalizedPhone && !item.consumedAt && secureStringEqual(item.tokenHash, tokenHash),
  );

  if (!token) {
    return { ok: false, message: "OTP verification token is invalid" };
  }

  const expiresAt = parseDate(token.expiresAt);
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    token.consumedAt = nowIso();
    await writeStore(store);
    return { ok: false, message: "OTP verification token expired" };
  }

  token.consumedAt = nowIso();
  await writeStore(store);

  return { ok: true };
}
