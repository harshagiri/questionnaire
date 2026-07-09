import { AppShell } from "@/components/app-shell";
import { PatientWorkflow } from "@/components/patient-workflow";
import { getPatientQuestionnaireContent, getSavedPatientQuestionnaire } from "@/lib/patient-questionnaire-db";

export default async function PatientSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const [questionnaireContent, savedWorkflow] = await Promise.all([
    getPatientQuestionnaireContent(),
    getSavedPatientQuestionnaire({ sessionId }),
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