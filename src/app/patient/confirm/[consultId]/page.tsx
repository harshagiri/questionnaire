import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PatientJourneyConfirm } from "@/components/patient-journey-confirm";

export const metadata = {
  title: "Appointment Confirmation — SpineExpert",
};

export default async function PatientJourneyConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ consultId: string }>;
  searchParams?: Promise<{ phone?: string; journey?: string }>;
}) {
  const cookieStore = await cookies();
  const role = cookieStore.get("se_role")?.value;
  const { consultId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (!role || role !== "patient") {
    const nextPath = `/patient/confirm/${encodeURIComponent(consultId)}`;
    redirect(`/login?role=patient&next=${encodeURIComponent(nextPath)}`);
  }

  const cookiePhone = (cookieStore.get("se_phone")?.value ?? cookieStore.get("se_name")?.value ?? "").replace(/\D/g, "");
  const phone = (resolvedSearchParams?.phone ?? cookiePhone).replace(/\D/g, "");

  return (
    <AppShell role="patient">
      <PatientJourneyConfirm consultId={consultId} phone={phone} />
    </AppShell>
  );
}
