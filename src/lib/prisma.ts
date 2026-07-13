import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync } from "node:fs";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient | null };

function normalizeConnectionString(raw: string) {
  try {
    const url = new URL(raw);
    const runningInDocker = existsSync("/.dockerenv");

    if (url.hostname === "postgres") {
      url.hostname = process.env.DATABASE_HOST_OVERRIDE || (runningInDocker ? "postgres" : "localhost");
    }

    return url.toString();
  } catch {
    return raw;
  }
}

function createPrismaClient() {
  const configuredConnectionString = process.env.DATABASE_URL;
  const connectionString = configuredConnectionString
    ? normalizeConnectionString(configuredConnectionString)
    : undefined;

  if (!connectionString) {
    return null;
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}
