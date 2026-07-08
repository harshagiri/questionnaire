import { redirect } from "next/navigation";

export default async function AccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; role?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const params = new URLSearchParams();
  if (resolvedSearchParams?.next) {
    params.set("next", resolvedSearchParams.next);
  }
  if (resolvedSearchParams?.role) {
    params.set("role", resolvedSearchParams.role);
  }
  const query = params.toString();
  redirect(query ? `/?${query}` : "/");
}