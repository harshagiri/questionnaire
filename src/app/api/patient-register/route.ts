import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { savePatientRecord, findPatientRecordByPhone } from "@/lib/portal-storage";

const registerSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  age: z.number().int().min(1).max(120).optional(),
  gender: z.string().optional(),
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional(),
  bmi: z.number().positive().optional(),
  region: z.string().optional(),
  preferredLanguage: z.string().optional(),
  dailyActivity: z.string().optional(),
  comorbidities: z.array(z.string()).optional().default([]),
  currentMeds: z.array(z.string()).optional().default([]),
  priorSurgery: z.boolean().optional().default(false),
  surgeryDetails: z.string().optional(),
});

function generatePatientId(count: number): string {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(5, "0");
  return `PT-${year}-${seq}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone is required" }, { status: 400 });
  }

  const normalizedPhone = phone.replace(/\D/g, "");

  // Try DB first
  if (prisma) {
    try {
      const record = await prisma.patientRecord.findUnique({ where: { phone: normalizedPhone } });
      if (record) {
        return NextResponse.json({ ok: true, record, source: "database" });
      }
    } catch {
      // fall through to localStorage fallback
    }
  }

  return NextResponse.json({ ok: true, record: null, source: "none" });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, message: "Invalid request body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const normalizedPhone = data.phone.replace(/\D/g, "");

  // Try database
  if (prisma) {
    try {
      const existing = await prisma.patientRecord.findUnique({ where: { phone: normalizedPhone } });
      if (existing) {
        // Update existing record
        const updated = await prisma.patientRecord.update({
          where: { phone: normalizedPhone },
          data: {
            fullName: data.fullName,
            email: data.email || null,
            age: data.age,
            gender: data.gender,
            heightCm: data.heightCm,
            weightKg: data.weightKg,
            bmi: data.bmi,
            region: data.region,
            preferredLanguage: data.preferredLanguage,
            dailyActivity: data.dailyActivity,
            comorbidities: data.comorbidities,
            currentMeds: data.currentMeds,
            priorSurgery: data.priorSurgery,
            surgeryDetails: data.surgeryDetails,
          },
        });
        return NextResponse.json({ ok: true, record: updated, isNew: false });
      }

      // Create new record
      const count = await prisma.patientRecord.count();
      const patientId = generatePatientId(count);

      const created = await prisma.patientRecord.create({
        data: {
          patientId,
          phone: normalizedPhone,
          email: data.email || null,
          fullName: data.fullName,
          age: data.age,
          gender: data.gender,
          heightCm: data.heightCm,
          weightKg: data.weightKg,
          bmi: data.bmi,
          region: data.region,
          preferredLanguage: data.preferredLanguage,
          dailyActivity: data.dailyActivity,
          comorbidities: data.comorbidities,
          currentMeds: data.currentMeds,
          priorSurgery: data.priorSurgery ?? false,
          surgeryDetails: data.surgeryDetails,
        },
      });

      return NextResponse.json({ ok: true, record: created, isNew: true }, { status: 201 });
    } catch (error) {
      console.error("DB patient register error:", error);
      // fall through to localStorage fallback
    }
  }

  // localStorage fallback (server-side: return data for client to store)
  // Check if phone exists via in-memory (not possible on server for localStorage)
  // Return a generated record for the client to save
  const record = {
    id: `pr-${Date.now()}`,
    patientId: generatePatientId(Math.floor(Math.random() * 1000)),
    phone: normalizedPhone,
    email: data.email || undefined,
    fullName: data.fullName,
    age: data.age,
    gender: data.gender,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    bmi: data.bmi,
    region: data.region,
    preferredLanguage: data.preferredLanguage,
    dailyActivity: data.dailyActivity,
    comorbidities: data.comorbidities,
    currentMeds: data.currentMeds,
    priorSurgery: data.priorSurgery ?? false,
    surgeryDetails: data.surgeryDetails,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json({ ok: true, record, isNew: true, source: "memory" }, { status: 201 });
}
