import { LoginPortal } from "@/components/login-portal";

export default function Home({
  searchParams,
}: {
  searchParams?: { next?: string; role?: string };
}) {
  return <LoginPortal searchParams={searchParams ?? {}} />;
}
