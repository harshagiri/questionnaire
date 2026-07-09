import { AppShell } from "@/components/app-shell";
import { PatientWorkflow } from "@/components/patient-workflow";
import { getPatientQuestionnaireContent, getSavedPatientQuestionnaire } from "@/lib/patient-questionnaire-db";

export default async function PatientSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<{ phone?: string }>;
}) {
  const { sessionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [questionnaireContent, savedWorkflow] = await Promise.all([
    getPatientQuestionnaireContent(),
    getSavedPatientQuestionnaire({ sessionId, phone: resolvedSearchParams?.phone }),
  ]);

  return (
    <AppShell role="patient">
      <PatientWorkflow
        sessionId={sessionId}
        initialQuestionContent={questionnaireContent.questions}
        initialSavedWorkflow={savedWorkflow}
      />
    </AppShell>
  );
}