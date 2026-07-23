import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { PatientWorkflow } from "@/components/patient-workflow";
import { PatientProfileGate } from "@/components/patient-profile-gate";
import { getSavedPatientQuestionnaire } from "@/lib/patient-questionnaire-db";

export default async function PatientSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<{ phone?: string }>;
}) {
  const cookieStore = await cookies();
  const cookiePhone = (cookieStore.get("se_phone")?.value ?? cookieStore.get("se_name")?.value ?? "").replace(/\D/g, "");
  const { sessionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const profilePhone = (resolvedSearchParams?.phone ?? cookiePhone).replace(/\D/g, "");
  const savedWorkflow = await getSavedPatientQuestionnaire({ sessionId, phone: resolvedSearchParams?.phone });

  return (
    <AppShell role="patient">
      <PatientProfileGate phone={profilePhone}>
        <PatientWorkflow
          sessionId={sessionId}
          initialSavedWorkflow={savedWorkflow}
          mode="pre-consult"
          dashboardHref="/patient"
        />
      </PatientProfileGate>
    </AppShell>
  );
}