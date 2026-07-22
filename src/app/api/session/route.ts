import { NextResponse } from "next/server";
import { roleHomePath } from "@/lib/auth";
import { verifyPatientAccessCode } from "@/lib/patient-access-code";
import { consumePatientOtpToken } from "@/lib/patient-otp";
import { verifyStaffCredentials } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";

type SessionBody = {
  role?: string;
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  otp?: string;
  otpToken?: string;
  nextPath?: string;
};

function hasValidPatientPhone(phone: string | undefined) {
  const normalized = (phone ?? "").replace(/\D/g, "");
  return normalized.length >= 10;
}

function normalizePhone(phone: string | undefined) {
  return (phone ?? "").replace(/\D/g, "");
}

async function patientExistsByPhone(phone: string | undefined) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone || !prisma) {
    return false;
  }

  try {
    const patientRecord = await prisma.patientRecord.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    return Boolean(patientRecord);
  } catch {
    return false;
  }
}

function hasValidStaffCredentials(email: string | undefined, password: string | undefined) {
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email ?? "").trim());
  return looksLikeEmail && (password ?? "").trim().length >= 6;
}

export async function POST(request: Request) {
  const body = (await request.json()) as SessionBody;
  const protoHeader = request.headers.get("x-forwarded-proto")?.toLowerCase();
  const isSecureRequest = protoHeader === "https" || new URL(request.url).protocol === "https:";

  if (!body.role || !roleHomePath[body.role]) {
    return NextResponse.json({ ok: false, message: "Unsupported role" }, { status: 400 });
  }

  let resolvedStaffDisplayName: string | undefined;
  let resolvedStaffPhotoUrl: string | undefined;

  if (body.role === "patient") {
    if (!hasValidPatientPhone(body.phone)) {
      return NextResponse.json({ ok: false, message: "Invalid phone number" }, { status: 400 });
    }
    if (!(await patientExistsByPhone(body.phone))) {
      return NextResponse.json({ ok: false, message: "Patient not registered. Please complete registration first." }, { status: 401 });
    }
    if (body.otpToken?.trim()) {
      const tokenVerification = await consumePatientOtpToken({
        phone: body.phone ?? "",
        verifyToken: body.otpToken,
      });

      if (!tokenVerification.ok) {
        return NextResponse.json({ ok: false, message: tokenVerification.message ?? "Invalid OTP verification" }, { status: 401 });
      }
    } else {
      const verification = await verifyPatientAccessCode({
        phone: body.phone ?? "",
        otp: body.otp ?? "",
      });
      if (!verification.ok) {
        return NextResponse.json({ ok: false, message: verification.message ?? "Invalid access code" }, { status: 401 });
      }
    }
  } else {
    if (!hasValidStaffCredentials(body.email, body.password)) {
      return NextResponse.json({ ok: false, message: "Invalid staff credentials" }, { status: 401 });
    }

    const normalizedEmail = (body.email ?? "").trim().toLowerCase();
    const authResult = await verifyStaffCredentials(
      body.role as "doctor" | "receptionist" | "admin",
      normalizedEmail,
      body.password ?? "",
    );

    if (!authResult.ok) {
      return NextResponse.json({ ok: false, message: "Invalid staff credentials" }, { status: 401 });
    }

    resolvedStaffDisplayName = authResult.displayName.trim();
    resolvedStaffPhotoUrl = authResult.photoUrl;
    body.email = normalizedEmail;
  }

  const response = NextResponse.json({ ok: true, role: body.role, nextPath: body.nextPath ?? roleHomePath[body.role] });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: isSecureRequest,
  };

  response.cookies.set("se_role", body.role, cookieOptions);
  const sessionName =
    body.role === "patient"
      ? body.name?.trim() || body.phone || "patient"
      : resolvedStaffDisplayName || body.email?.trim().toLowerCase() || body.name?.trim() || body.role;
  response.cookies.set("se_name", sessionName, cookieOptions);
  if (body.role === "patient") {
    const normalizedPhone = normalizePhone(body.phone);
    if (normalizedPhone) {
      response.cookies.set("se_phone", normalizedPhone, cookieOptions);
    }
  }
  // Store email for staff so doctor/receptionist pages can look up their profile
  if (body.role !== "patient" && body.email) {
    response.cookies.set("se_email", body.email.trim().toLowerCase(), cookieOptions);
  }
  if (body.role === "patient") {
    response.cookies.set("se_avatar", "", { ...cookieOptions, maxAge: 0 });
  } else {
    const avatar = resolvedStaffPhotoUrl?.trim() || "";
    if (avatar) {
      response.cookies.set("se_avatar", avatar, cookieOptions);
    } else {
      response.cookies.set("se_avatar", "", { ...cookieOptions, maxAge: 0 });
    }
  }
  return response;
}