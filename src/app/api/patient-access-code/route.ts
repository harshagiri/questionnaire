import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { issuePatientAccessCode, isValidPatientPhone } from "@/lib/patient-access-code";

type AccessCodePostBody = {
  phone?: string;
  rotate?: boolean;
};

function normalizePhone(phone: string | undefined) {
  return (phone ?? "").replace(/\D/g, "");
}

async function getRequester() {
  const cookieStore = await cookies();
  const role = (cookieStore.get("se_role")?.value ?? "").toLowerCase();
  const name = cookieStore.get("se_name")?.value ?? undefined;
  return { role, name };
}

function isAuthorizedStaffRole(role: string) {
  return role === "receptionist" || role === "admin";
}

export async function GET(request: Request) {
  const { role, name } = await getRequester();
  if (!isAuthorizedStaffRole(role)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const normalizedPhone = normalizePhone(searchParams.get("phone") ?? undefined);

  if (!isValidPatientPhone(normalizedPhone)) {
    return NextResponse.json({ ok: false, message: "Invalid phone number" }, { status: 400 });
  }

  const code = await issuePatientAccessCode({
    phone: normalizedPhone,
    rotate: false,
    actorRole: role,
    actorName: name,
  });

  return NextResponse.json({
    ok: true,
    phone: normalizedPhone,
    code: code.code,
    expiresAt: code.expiresAt,
    minutesRemaining: code.minutesRemaining,
  });
}

export async function POST(request: Request) {
  const { role, name } = await getRequester();
  if (!isAuthorizedStaffRole(role)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as AccessCodePostBody;
  const normalizedPhone = normalizePhone(body.phone);

  if (!isValidPatientPhone(normalizedPhone)) {
    return NextResponse.json({ ok: false, message: "Invalid phone number" }, { status: 400 });
  }

  const code = await issuePatientAccessCode({
    phone: normalizedPhone,
    rotate: Boolean(body.rotate),
    actorRole: role,
    actorName: name,
  });

  return NextResponse.json({
    ok: true,
    phone: normalizedPhone,
    code: code.code,
    expiresAt: code.expiresAt,
    minutesRemaining: code.minutesRemaining,
  });
}
