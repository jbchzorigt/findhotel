import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { getDb } from "@/db";
import { hotelSurveys } from "@/db/schema";
import { getSession } from "@/lib/auth/request";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MySurveysPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // SURVEYOR зөвхөн өөрийн мөрийг харна — шүүлт query дотор (§10).
  const rows = await getDb()
    .select({
      id: hotelSurveys.id,
      name: hotelSurveys.name,
      phone: hotelSurveys.phone,
      addressText: hotelSurveys.addressText,
      createdAt: hotelSurveys.createdAt,
    })
    .from(hotelSurveys)
    .where(eq(hotelSurveys.surveyorId, session.sub))
    .orderBy(desc(hotelSurveys.createdAt))
    .limit(100);

  return (
    <main className="mx-auto max-w-md p-4">
      <AppHeader active="list" role={session.role} />

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          Одоогоор бүртгэл алга.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <p className="font-medium">{row.name}</p>
              <p className="text-sm text-slate-600">{row.phone}</p>
              {row.addressText ? (
                <p className="text-sm text-slate-500">{row.addressText}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-400">
                {formatDateTime(row.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
