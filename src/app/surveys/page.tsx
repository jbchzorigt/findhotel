import { and, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { SurveyCard } from "@/components/SurveyCard";
import { getDb } from "@/db";
import { hotelSurveys, surveyPhotos } from "@/db/schema";
import { getSession } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export default async function MySurveysPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = getDb();

  // SURVEYOR зөвхөн өөрийн мөрийг харна — шүүлт query дотор (§10).
  const rows = await db
    .select({
      id: hotelSurveys.id,
      name: hotelSurveys.name,
      phone: hotelSurveys.phone,
      addressText: hotelSurveys.addressText,
      lat: hotelSurveys.lat,
      lng: hotelSurveys.lng,
      status: hotelSurveys.status,
      locationSource: hotelSurveys.locationSource,
      accuracyM: hotelSurveys.locationAccuracyM,
      osmRef: hotelSurveys.osmRef,
      duplicateAck: hotelSurveys.duplicateAck,
      note: hotelSurveys.note,
      createdAt: hotelSurveys.createdAt,
    })
    .from(hotelSurveys)
    .where(
      and(
        eq(hotelSurveys.surveyorId, session.sub),
        // Устгасан бүртгэлийг алба хаагчид харуулахгүй — засах эрхгүй тул
        // харуулах нь зөвхөн эргэлзээ төрүүлнэ.
        eq(hotelSurveys.status, "SUBMITTED"),
      ),
    )
    .orderBy(desc(hotelSurveys.createdAt))
    .limit(100);

  // Зургуудыг НЭГ query-гээр (мөр тутамд query хийхгүй).
  const photos = rows.length
    ? await db
        .select({
          surveyId: surveyPhotos.surveyId,
          publicUrl: surveyPhotos.publicUrl,
          isPrimary: surveyPhotos.isPrimary,
        })
        .from(surveyPhotos)
        .where(
          inArray(
            surveyPhotos.surveyId,
            rows.map((row) => row.id),
          ),
        )
    : [];

  const bySurvey = new Map<string, string[]>();
  for (const photo of photos) {
    const list = bySurvey.get(photo.surveyId) ?? [];
    // Үндсэн зургийг эхэнд.
    if (photo.isPrimary) list.unshift(photo.publicUrl);
    else list.push(photo.publicUrl);
    bySurvey.set(photo.surveyId, list);
  }

  return (
    <main className="mx-auto max-w-3xl p-4">
      <AppHeader active="list" role={session.role} />

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          Одоогоор бүртгэл алга.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <SurveyCard
              key={row.id}
              survey={{
                id: row.id,
                name: row.name,
                phone: row.phone,
                addressText: row.addressText,
                lat: Number(row.lat),
                lng: Number(row.lng),
                status: row.status,
                locationSource: row.locationSource,
                accuracyM: row.accuracyM,
                osmRef: row.osmRef,
                duplicateAck: row.duplicateAck,
                note: row.note,
                createdAt: row.createdAt.toISOString(),
                photos: bySurvey.get(row.id) ?? [],
                // Өөрийн бүртгэл дээр өөрийн badge харуулах нь илүүц.
              }}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
