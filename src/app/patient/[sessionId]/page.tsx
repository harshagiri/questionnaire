import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { OneTimeQuestionnaireMock } from "@/components/onetime-questionnaire-mock";
import { PatientProfileGate } from "@/components/patient-profile-gate";

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

  void sessionId;

  return (
    <AppShell role="patient">
      <PatientProfileGate phone={profilePhone}>
        <OneTimeQuestionnaireMock sessionId={sessionId} patientPhone={profilePhone} />
      </PatientProfileGate>
    </AppShell>
  );
}