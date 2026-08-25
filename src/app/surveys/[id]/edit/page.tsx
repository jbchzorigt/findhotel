import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { EditSurveyForm } from "@/components/EditSurveyForm";
import { getDb } from "@/db";
import { hotelSurveys } from "@/db/schema";
import { getSession } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export default async function EditSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  /*
   * Эзэмшил ба төлөвийг QUERY дотор шалгана. Бусдын бүртгэлийг татаад
   * дараа нь UI дээр нуух нь хамгаалалт биш (§10).
   */
  const [survey] = await getDb()
    .select({
      id: hotelSurveys.id,
      name: hotelSurveys.name,
      phone: hotelSurveys.phone,
      addressText: hotelSurveys.addressText,
      note: hotelSurveys.note,
      lat: hotelSurveys.lat,
      lng: hotelSurveys.lng,
    })
    .from(hotelSurveys)
    .where(
      and(
        eq(hotelSurveys.id, id),
        eq(hotelSurveys.surveyorId, session.sub),
        eq(hotelSurveys.status, "SUBMITTED"),
      ),
    )
    .limit(1);

  if (!survey) notFound();

  return (
    <main className="mx-auto max-w-md p-4">
      <AppHeader active="list" role={session.role} />
      <h1 className="mb-4 text-lg font-semibold">Бүртгэл засах</h1>
      <EditSurveyForm
        survey={{
          id: survey.id,
          name: survey.name,
          phone: survey.phone,
          addressText: survey.addressText,
          note: survey.note,
          lat: Number(survey.lat),
          lng: Number(survey.lng),
        }}
      />
    </main>
  );
}
