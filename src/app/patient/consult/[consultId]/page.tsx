import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { OneTimeQuestionnaireMock } from "@/components/onetime-questionnaire-mock";
import { PatientProfileGate } from "@/components/patient-profile-gate";

export default async function PreConsultPage({
  params,
  searchParams,
}: {
  params: Promise<{ consultId: string }>;
  searchParams?: Promise<{ phone?: string; journey?: string; summary?: string }>;
}) {
  const cookieStore = await cookies();
  const cookiePhone = (cookieStore.get("se_phone")?.value ?? cookieStore.get("se_name")?.value ?? "").replace(/\D/g, "");
  const { consultId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const profilePhone = (resolvedSearchParams?.phone ?? cookiePhone).replace(/\D/g, "");
  const journeyMode = resolvedSearchParams?.journey === "1";
  const summaryMode = resolvedSearchParams?.summary === "1";

  void consultId;

  return (
    <AppShell role="patient">
      <PatientProfileGate phone={profilePhone}>
        <OneTimeQuestionnaireMock
          sessionId={consultId}
          patientPhone={profilePhone}
          journeyMode={journeyMode}
          summaryMode={summaryMode}
        />
      </PatientProfileGate>
    </AppShell>
  );
}
