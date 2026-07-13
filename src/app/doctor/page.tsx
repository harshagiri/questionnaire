import { AppShell } from "@/components/app-shell";
import { DoctorWorkflow } from "@/components/doctor-workflow-clean";

export default function DoctorPage() {
  return (
    <AppShell role="doctor">
      <DoctorWorkflow />
    </AppShell>
  );
}