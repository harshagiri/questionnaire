import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { DoctorWorkflow } from "@/components/doctor-workflow-clean";

export default async function DoctorPage() {
  const cookieStore = await cookies();
  const email = cookieStore.get("se_email")?.value ?? "";

  return (
    <AppShell role="doctor">
      <DoctorWorkflow doctorEmail={email} />
    </AppShell>
  );
}