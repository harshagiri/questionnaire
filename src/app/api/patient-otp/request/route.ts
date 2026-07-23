import { NextResponse } from "next/server";
import { requestPatientOtp } from "@/lib/patient-otp";
import { ensurePatientRecordForPhone } from "@/lib/patient-record";
import { resolveMagicLinkForPhone } from "@/lib/patient-magic-link";

function normalizePhone(phone: string | undefined) {
  return (phone ?? "").replace(/\D/g, "");
}

function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || "";
}

function getOtpProviderMode() {
  return (process.env.PATIENT_OTP_PROVIDER || "internal").trim().toLowerCase();
}

function hasExternalRequestProviderConfig() {
  return Boolean(process.env.PATIENT_OTP_EXTERNAL_REQUEST_URL?.trim());
}

async function requestOtpFromExternalProvider(input: { phone: string; ip: string }) {
  const url = process.env.PATIENT_OTP_EXTERNAL_REQUEST_URL?.trim();
  if (!url) {
    return { ok: false as const, message: "External OTP request URL is not configured" };
  }

  const apiKey = process.env.PATIENT_OTP_EXTERNAL_API_KEY?.trim();
  const authHeaderName = process.env.PATIENT_OTP_EXTERNAL_AUTH_HEADER?.trim() || "x-api-key";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers[authHeaderName] = apiKey;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      phone: input.phone,
      ip: input.ip,
    }),
  });

  const text = await response.text();
  const parsed = (() => {
    try {
      return JSON.parse(text) as {
        ok?: boolean;
        message?: string;
        requestId?: string;
        expiresAt?: string;
        retryAfterSeconds?: number;
      };
    } catch {
      return null;
    }
  })();

  if (!response.ok || parsed?.ok === false) {
    return {
      ok: false as const,
      message: parsed?.message || "Unable to send OTP",
      retryAfterSeconds: parsed?.retryAfterSeconds,
    };
  }

  return {
    ok: true as const,
    requestId: parsed?.requestId || `${input.phone}-${Date.now()}`,
    expiresAt: parsed?.expiresAt,
    message: parsed?.message,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { phone?: string } | null;
    const phone = normalizePhone(body?.phone);

    if (phone.length < 10) {
      return NextResponse.json({ ok: false, message: "Invalid phone number" }, { status: 400 });
    }

    let onboardingRequired = false;
    try {
      const ensuredRecord = await ensurePatientRecordForPhone(phone);
      onboardingRequired = Boolean(ensuredRecord.isNew);
      if (ensuredRecord.isNew) {
        await resolveMagicLinkForPhone({ phone });
      }
    } catch {
      // Continue OTP flow even if persistence is temporarily unavailable.
    }

    const providerMode = getOtpProviderMode();
    const ip = getRequestIp(request);
    const useExternalProvider = providerMode === "external" && hasExternalRequestProviderConfig();
    const otpResult =
      useExternalProvider
        ? await requestOtpFromExternalProvider({ phone, ip })
        : await requestPatientOtp({
            phone,
            ip,
          });

    if (!otpResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: otpResult.message,
          retryAfterSeconds: otpResult.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    const successMessage = "message" in otpResult ? otpResult.message : undefined;

    return NextResponse.json({
      ok: true,
      message: successMessage || "OTP sent",
      requestId: otpResult.requestId,
      expiresAt: otpResult.expiresAt,
      onboardingRequired,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to process OTP request right now" }, { status: 500 });
  }
}
