import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { ReceptionistWorkflow } from "@/components/receptionist-workflow";

export default async function ReceptionistPage() {
  await cookies();

  return (
    <AppShell role="receptionist">
      <ReceptionistWorkflow />
    </AppShell>
  );
}