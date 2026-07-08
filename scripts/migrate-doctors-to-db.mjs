import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const doctorsFilePath = resolve(process.cwd(), "data", "doctors.json");

async function loadDoctorsFromFile() {
  try {
    const raw = await readFile(doctorsFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const doctors = await loadDoctorsFromFile();
  if (doctors.length === 0) {
    console.log("No doctors found in data/doctors.json.");
    await prisma.$disconnect();
    return;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const doctor of doctors) {
    const email = String(doctor?.email ?? "").trim().toLowerCase();
    const name = String(doctor?.name ?? "").trim();
    const phone = String(doctor?.phone ?? "").trim();
    const registrationNumber = String(doctor?.registrationNumber ?? "").trim();
    const licenseNumber = String(doctor?.licenseNumber ?? "").trim();

    if (!email || !name || !phone || !registrationNumber || !licenseNumber) {
      skipped += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email } });

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email,
            passwordHash: `doctor:${registrationNumber}`,
            role: "doctor",
            displayName: name,
          },
        }));

      const existingProfile = await tx.doctorProfile.findUnique({ where: { userId: user.id } });

      if (!existingProfile) {
        await tx.doctorProfile.create({
          data: {
            userId: user.id,
            name,
            phone,
            registrationNumber,
            licenseNumber,
            bio: String(doctor?.bio ?? ""),
            photoUrl: String(doctor?.photoUrl ?? ""),
          },
        });
        created += 1;
      } else {
        await tx.doctorProfile.update({
          where: { userId: user.id },
          data: {
            name,
            phone,
            registrationNumber,
            licenseNumber,
            bio: String(doctor?.bio ?? ""),
            photoUrl: String(doctor?.photoUrl ?? ""),
          },
        });
        updated += 1;
      }
    });
  }

  await prisma.$disconnect();

  console.log(`Migration complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
