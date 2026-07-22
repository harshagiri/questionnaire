import { NextResponse } from "next/server";
import { issuePatientOtpVerifyToken, verifyPatientOtp } from "@/lib/patient-otp";

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

function hasExternalVerifyProviderConfig() {
  return Boolean(process.env.PATIENT_OTP_EXTERNAL_VERIFY_URL?.trim());
}

async function verifyOtpWithExternalProvider(input: {
  phone: string;
  otp: string;
  requestId?: string;
  ip: string;
}) {
  const url = process.env.PATIENT_OTP_EXTERNAL_VERIFY_URL?.trim();
  if (!url) {
    return { ok: false as const, message: "External OTP verify URL is not configured" };
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
      otp: input.otp,
      requestId: input.requestId,
      ip: input.ip,
    }),
  });

  const text = await response.text();
  const parsed = (() => {
    try {
      return JSON.parse(text) as { ok?: boolean; message?: string; retryAfterSeconds?: number };
    } catch {
      return null;
    }
  })();

  if (!response.ok || parsed?.ok === false) {
    return {
      ok: false as const,
      message: parsed?.message || "OTP verification failed",
      retryAfterSeconds: parsed?.retryAfterSeconds,
    };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          phone?: string;
          otp?: string;
          requestId?: string;
        }
      | null;

    const phone = normalizePhone(body?.phone);
    const otp = String(body?.otp ?? "").trim();

    if (phone.length < 10) {
      return NextResponse.json({ ok: false, message: "Invalid phone number" }, { status: 400 });
    }

    if (!otp) {
      return NextResponse.json({ ok: false, message: "Enter OTP" }, { status: 400 });
    }

    const providerMode = getOtpProviderMode();
    const ip = getRequestIp(request);

    if (providerMode === "external" && hasExternalVerifyProviderConfig()) {
      const verification = await verifyOtpWithExternalProvider({
        phone,
        otp,
        requestId: body?.requestId,
        ip,
      });

      if (!verification.ok) {
        return NextResponse.json(
          {
            ok: false,
            message: verification.message,
            retryAfterSeconds: verification.retryAfterSeconds,
          },
          { status: 401 },
        );
      }

      const issuedToken = await issuePatientOtpVerifyToken({ phone });
      if (!issuedToken.ok) {
        return NextResponse.json({ ok: false, message: issuedToken.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        verifyToken: issuedToken.verifyToken,
        tokenExpiresAt: issuedToken.tokenExpiresAt,
      });
    }

    const result = await verifyPatientOtp({
      phone,
      otp,
      requestId: body?.requestId,
      ip,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: result.message,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      verifyToken: result.verifyToken,
      tokenExpiresAt: result.tokenExpiresAt,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to verify OTP right now" }, { status: 500 });
  }
}
