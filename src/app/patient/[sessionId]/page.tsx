import { AppShell } from "@/components/app-shell";
import { PatientWorkflow } from "@/components/patient-workflow";

export default async function PatientSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <AppShell showNavigation={false}>
      <PatientWorkflow sessionId={sessionId} />
    </AppShell>
  );
}