import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";

import { AdminSurveys } from "@/components/admin/AdminSurveys";
import { AppHeader } from "@/components/AppHeader";
import { getDb } from "@/db";
import { surveyors } from "@/db/schema";
import { getSession } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  // Шүүлтийн жагсаалт — серверт бэлдэж өгвөл нэг хүсэлт хэмнэнэ.
  const people = await getDb()
    .select({
      id: surveyors.id,
      badge_number: surveyors.badgeNumber,
      full_name: surveyors.fullName,
    })
    .from(surveyors)
    .orderBy(asc(surveyors.badgeNumber));

  return (
    <main className="mx-auto max-w-3xl p-4">
      <AppHeader active="admin" role={session.role} />
      <AdminSurveys surveyors={people} />
    </main>
  );
}
