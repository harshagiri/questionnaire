import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  markMagicLinkSmsFailed,
  markMagicLinkSmsSent,
  markMagicLinkSmsSkipped,
  resolveMagicLinkForPhone,
  sendMagicLinkViaMsg91,
} from "@/lib/patient-magic-link";
import { ensurePatientRecordForPhone } from "@/lib/patient-record";
import { resolveAppUrl } from "@/lib/app-url";

type ResendBody = {
  phone?: string;
  entryId?: string;
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

function canExposeMagicLinkForTesting() {
  return process.env.NODE_ENV !== "production" || process.env.MSG91_ALLOW_FALLBACK_LINK === "true";
}

async function assertReceptionist() {
  const cookieStore = await cookies();
  const role = (cookieStore.get("se_role")?.value ?? "").toLowerCase();
  return role === "receptionist";
}

export async function POST(request: Request) {
  const isReceptionist = await assertReceptionist();
  if (!isReceptionist) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as ResendBody | null;
  const phone = normalizeIndianMobile(body?.phone);
  const skipSms = Boolean(body?.skipSms);

  if (!phone) {
    return NextResponse.json({ ok: false, message: "Enter a valid Indian mobile number" }, { status: 400 });
  }

  try {
    const patientRecord = await ensurePatientRecordForPhone(phone);
    const resolved = await resolveMagicLinkForPhone({
      phone,
      preferredEntryId: body?.entryId,
    });

    const magicLink = `${resolveAppUrl(request)}/api/patient-magic-link/consume?token=${encodeURIComponent(resolved.token)}`;

    if (skipSms && canExposeMagicLinkForTesting()) {
      await markMagicLinkSmsSkipped(resolved.token, "SMS skipped during resend for local testing.");
      return NextResponse.json({
        ok: true,
        phone,
        expiresAt: resolved.expiresAt,
        patientId: patientRecord.patientId,
        sent: false,
        reusedExisting: resolved.reusedExisting,
        magicLink,
        message: "SMS skipped for local testing.",
      });
    }

    try {
      await sendMagicLinkViaMsg91({
        phone,
        magicLink,
      });
      await markMagicLinkSmsSent(resolved.token);
    } catch (smsError) {
      const smsMessage = smsError instanceof Error ? smsError.message : "SMS dispatch failed";
      await markMagicLinkSmsFailed(resolved.token, smsMessage);

      if (canExposeMagicLinkForTesting()) {
        return NextResponse.json({
          ok: true,
          phone,
          expiresAt: resolved.expiresAt,
          patientId: patientRecord.patientId,
          sent: false,
          reusedExisting: resolved.reusedExisting,
          magicLink,
          message: `SMS failed: ${smsMessage}`,
        });
      }

      return NextResponse.json({ ok: false, message: smsMessage }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      phone,
      expiresAt: resolved.expiresAt,
      patientId: patientRecord.patientId,
      sent: true,
      reusedExisting: resolved.reusedExisting,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resend magic link";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
