import { PatientRegister } from "@/components/patient-register";

export const metadata = {
  title: "Patient Registration — SpineExpert",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ journey?: string; consultId?: string; phone?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <PatientRegister
      journeyMode={resolvedSearchParams?.journey === "1"}
      consultId={resolvedSearchParams?.consultId}
      phoneFromJourney={resolvedSearchParams?.phone}
    />
  );
}
