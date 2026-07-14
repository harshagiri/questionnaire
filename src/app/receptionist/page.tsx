import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { ReceptionistWorkflow } from "@/components/receptionist-workflow";

export default async function ReceptionistPage() {
  const cookieStore = await cookies();
  const email = cookieStore.get("se_email")?.value ?? "";

  return (
    <AppShell role="receptionist">
      <ReceptionistWorkflow receptionistEmail={email} />
    </AppShell>
  );
}