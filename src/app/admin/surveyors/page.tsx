import { redirect } from "next/navigation";

import { AdminSurveyors } from "@/components/admin/AdminSurveyors";
import { AppHeader } from "@/components/AppHeader";
import { listSurveyors } from "@/lib/admin/surveyors";
import { getSession } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export default async function AdminSurveyorsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  return (
    <main className="mx-auto max-w-3xl p-4">
      <AppHeader active="surveyors" role={session.role} />
      <AdminSurveyors
        initial={await listSurveyors()}
        currentUserId={session.sub}
      />
    </main>
  );
}
