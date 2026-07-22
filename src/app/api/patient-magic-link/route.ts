import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  issuePatientMagicLink,
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

async function ensurePatientExistsByPhone(phone: string) {
  if (!prisma) {
    return true;
  }

  const record = await prisma.patientRecord.findUnique({
    where: { phone },
    select: { id: true },
  });

  return Boolean(record);
}

export async function POST(request: Request) {
  const isReceptionist = await assertReceptionist();
  if (!isReceptionist) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as MagicLinkRequestBody | null;
  const phone = normalizePhone(body?.phone);
  const skipSms = Boolean(body?.skipSms);

  if (phone.length < 10) {
    return NextResponse.json({ ok: false, message: "Invalid phone number" }, { status: 400 });
  }

  const patientExists = await ensurePatientExistsByPhone(phone);
  if (!patientExists) {
    return NextResponse.json({ ok: false, message: "Patient not registered" }, { status: 404 });
  }

  try {
    const issued = await issuePatientMagicLink({ phone });
    const baseUrl = resolveAppUrl(request);
    const magicLink = `${baseUrl}/api/patient-magic-link/consume?token=${encodeURIComponent(issued.token)}`;

    if (skipSms && canExposeMagicLinkForTesting()) {
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
    } catch (smsError) {
      if (canExposeMagicLinkForTesting()) {
        const smsMessage = smsError instanceof Error ? smsError.message : "SMS dispatch failed";
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
      const smsMessage = smsError instanceof Error ? smsError.message : "SMS dispatch failed";
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