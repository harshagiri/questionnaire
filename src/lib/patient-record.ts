import { prisma } from "@/lib/prisma";

type EnsurePatientRecordResult = {
  persisted: boolean;
  isNew: boolean;
  patientId?: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function buildPatientId() {
  const year = new Date().getFullYear();
  const randomPart = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  return `PT-${year}-${randomPart}`;
}

function buildDefaultName(phone: string) {
  const suffix = phone.slice(-4) || "0000";
  return `Patient ${suffix}`;
}

export async function ensurePatientRecordForPhone(phone: string): Promise<EnsurePatientRecordResult> {
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length < 10) {
    throw new Error("Invalid phone number");
  }

  if (!prisma) {
    return { persisted: false, isNew: false };
  }

  const existing = await prisma.patientRecord.findUnique({ where: { phone: normalizedPhone } });
  if (existing) {
    return {
      persisted: true,
      isNew: false,
      patientId: existing.patientId,
    };
  }

  const fullName = buildDefaultName(normalizedPhone);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const created = await prisma.patientRecord.create({
        data: {
          patientId: buildPatientId(),
          phone: normalizedPhone,
          fullName,
          comorbidities: [],
          currentMeds: [],
          priorSurgery: false,
        },
      });

      return {
        persisted: true,
        isNew: true,
        patientId: created.patientId,
      };
    } catch (error) {
      const maybeCode = (error as { code?: string })?.code;
      if (maybeCode === "P2002") {
        const raced = await prisma.patientRecord.findUnique({ where: { phone: normalizedPhone } });
        if (raced) {
          return {
            persisted: true,
            isNew: false,
            patientId: raced.patientId,
          };
        }
        continue;
      }

      throw error;
    }
  }

  throw new Error("Could not create patient record");
}
