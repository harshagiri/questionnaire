import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumePatientMagicLink } from "@/lib/patient-magic-link";
import { resolveAppUrl } from "@/lib/app-url";
import { sanitizeMagicLinkToken } from "@/lib/magic-link-token";

async function resolvePatientDisplayName(phone: string) {
  if (!prisma) {
    return phone;
  }

  try {
    const record = await prisma.patientRecord.findUnique({
      where: { phone },
      select: { fullName: true },
    });

    return record?.fullName?.trim() || phone;
  } catch {
    return phone;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = resolveAppUrl(request);
  const token = sanitizeMagicLinkToken(url.searchParams.get("token"));
  const consumed = await consumePatientMagicLink(token);

  if (!consumed.ok) {
    const errorUrl = new URL("/", appUrl);
    errorUrl.searchParams.set("role", "patient");
    errorUrl.searchParams.set("error", consumed.message);
    return NextResponse.redirect(errorUrl);
  }

  const patientDisplayName = await resolvePatientDisplayName(consumed.phone);
  const redirectUrl = new URL("/patient", appUrl);
  const response = NextResponse.redirect(redirectUrl);

  const protoHeader = request.headers.get("x-forwarded-proto")?.toLowerCase();
  const isSecureRequest = protoHeader === "https" || url.protocol === "https:";

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: isSecureRequest,
  };

  response.cookies.set("se_role", "patient", cookieOptions);
  response.cookies.set("se_name", consumed.phone, cookieOptions);
  response.cookies.set("se_phone", consumed.phone, cookieOptions);
  response.cookies.set("se_patient_name", patientDisplayName, cookieOptions);
  response.cookies.set("se_avatar", "", { ...cookieOptions, maxAge: 0 });

  return response;
}