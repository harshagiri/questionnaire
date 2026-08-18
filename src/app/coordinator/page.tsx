import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { CoordinatorWorkflow } from "@/components/coordinator-workflow";

export const dynamic = "force-dynamic";

export default async function CoordinatorPage() {
  await cookies();

  return (
    <AppShell role="coordinator">
      <CoordinatorWorkflow />
    </AppShell>
  );
}
