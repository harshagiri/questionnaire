import { todayPatients } from "@/lib/mock-data";

export function getAdminSummary() {
  const completed = todayPatients.filter((patient) => patient.status === "Submitted");
  const averageBmi = completed.reduce((sum, patient) => sum + (patient.bmi ?? 0), 0) / Math.max(completed.length, 1);

  return {
    totalPatients: todayPatients.length,
    completedPatients: completed.length,
    completionRate: Math.round((completed.length / todayPatients.length) * 100),
    averageBmi: Number(averageBmi.toFixed(1)),
  };
}