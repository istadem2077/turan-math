import { requireStudent } from "@/lib/auth";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();
  return <>{children}</>;
}
