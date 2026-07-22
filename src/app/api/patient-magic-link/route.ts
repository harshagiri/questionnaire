import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  issuePatientMagicLink,
  listRecentMagicLinkStatuses,
  markMagicLinkSmsFailed,
  markMagicLinkSmsSent,
  markMagicLinkSmsSkipped,
  revokePatientMagicLink,
  sendMagicLinkViaMsg91,
} from "@/lib/patient-magic-link";

type MagicLinkRequestBody = {
  phone?: string;
  skipSms?: boolean;
};

function normalizePhone(phone: string | undefined) {
  return (phone ?? "").replace(/\D/g, "");
}

function normalizeIndianMobile(phone: string | undefined) {
  const digits = normalizePhone(phone);

  if (/^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return digits.slice(2);
  }

  return null;
}

function resolveAppUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const incoming = new URL(request.url);
  return `${incoming.protocol}//${incoming.host}`;
}

function canExposeMagicLinkForTesting() {
  return process.env.NODE_ENV !== "production" || process.env.MSG91_ALLOW_FALLBACK_LINK === "true";
}

async function assertReceptionist() {
  const cookieStore = await cookies();
  const role = (cookieStore.get("se_role")?.value ?? "").toLowerCase();
  return role === "receptionist";
}

export async function GET(request: Request) {
  const isReceptionist = await assertReceptionist();
  if (!isReceptionist) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  const limitParam = new URL(request.url).searchParams.get("limit");
  const parsedLimit = Number(limitParam);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(200, parsedLimit) : 100;
  const recent = await listRecentMagicLinkStatuses(limit);
  const baseUrl = resolveAppUrl(request);
  const entries = recent.map((entry) => ({
    ...entry,
    magicLink: entry.token
      ? `${baseUrl}/api/patient-magic-link/consume?token=${encodeURIComponent(entry.token)}`
      : undefined,
    token: undefined,
  }));
  return NextResponse.json({ ok: true, entries });
}

export async function POST(request: Request) {
  const isReceptionist = await assertReceptionist();
  if (!isReceptionist) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as MagicLinkRequestBody | null;
  const phone = normalizeIndianMobile(body?.phone);
  const skipSms = Boolean(body?.skipSms);

  if (!phone) {
    return NextResponse.json({ ok: false, message: "Enter a valid Indian mobile number" }, { status: 400 });
  }

  try {
    const issued = await issuePatientMagicLink({ phone });
    const baseUrl = resolveAppUrl(request);
    const magicLink = `${baseUrl}/api/patient-magic-link/consume?token=${encodeURIComponent(issued.token)}`;

    if (skipSms && canExposeMagicLinkForTesting()) {
      await markMagicLinkSmsSkipped(issued.token);
      return NextResponse.json({
        ok: true,
        phone,
        expiresAt: issued.expiresAt,
        sent: false,
        magicLink,
        message: "SMS skipped for local testing.",
      });
    }

    try {
      await sendMagicLinkViaMsg91({
        phone,
        magicLink,
      });
      await markMagicLinkSmsSent(issued.token);
    } catch (smsError) {
      const smsMessage = smsError instanceof Error ? smsError.message : "SMS dispatch failed";
      await markMagicLinkSmsFailed(issued.token, smsMessage);

      if (canExposeMagicLinkForTesting()) {
        return NextResponse.json({
          ok: true,
          phone,
          expiresAt: issued.expiresAt,
          sent: false,
          magicLink,
          message: `SMS failed: ${smsMessage}`,
        });
      }

      await revokePatientMagicLink(issued.token, "SMS dispatch failed");
      return NextResponse.json({ ok: false, message: smsMessage }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      phone,
      expiresAt: issued.expiresAt,
      sent: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate magic link";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}