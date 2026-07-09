import { z } from "zod";

export const doctorProfileSchema = z.object({
  name: z.string().min(2),
  photo: z.string().url().optional(),
  phone: z.string().min(8),
  registrationNumber: z.string().min(3),
  licenseNumber: z.string().min(3),
  bio: z.string().max(500).optional(),
  links: z.array(z.string()).default([]),
});

export const patientIntakeSchema = z.object({
  fullName: z.string().min(2),
  age: z.coerce.number().min(0).max(120),
  gender: z.string().min(1),
  region: z.string().min(2),
  phone: z.string().min(8),
  aadhar: z.string().min(12),
  weightKg: z.coerce.number().positive(),
  heightCm: z.coerce.number().positive(),
  symptomFocus: z.string().min(2),
  hasPain: z.coerce.boolean(),
  painScore: z.coerce.number().min(0).max(10).optional(),
  symptomDays: z.coerce.number().optional(),
  reviewConsent: z.coerce.boolean(),
});

export const appointmentSchema = z.object({
  patientName: z.string().min(2),
  patientPhone: z.string().min(8),
  doctorId: z.string().min(1),
  appointmentDate: z.string().min(5),
  appointmentTime: z.string().min(2),
  appointmentType: z.string().min(2),
  consultSessionId: z.string().min(8),
  status: z.enum(["draft", "booked", "waiting", "submitted", "cancelled", "follow_up"]).default("booked"),
  notes: z.string().optional().default(""),
});

export const questionnaireBuilderSchema = z.object({
  title: z.string().min(3),
  subtitle: z.string().min(3),
  audience: z.array(z.enum(["patient", "doctor", "admin"])).min(1),
});