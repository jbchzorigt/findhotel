import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";

import { AdminSurveyors } from "@/components/admin/AdminSurveyors";
import { AppHeader } from "@/components/AppHeader";
import { getDb } from "@/db";
import { surveyors } from "@/db/schema";
import { getSession } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export default async function AdminSurveyorsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const people = await getDb()
    .select({
      id: surveyors.id,
      badge_number: surveyors.badgeNumber,
      full_name: surveyors.fullName,
      unit: surveyors.unit,
      role: surveyors.role,
      is_active: surveyors.isActive,
    })
    .from(surveyors)
    .orderBy(asc(surveyors.badgeNumber));

  return (
    <main className="mx-auto max-w-3xl p-4">
      <AppHeader active="surveyors" role={session.role} />
      <AdminSurveyors initial={people} currentUserId={session.sub} />
    </main>
  );
}
