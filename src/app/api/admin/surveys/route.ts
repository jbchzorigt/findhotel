/**
 * Админ — бүх бүртгэлийг шүүж харах.
 *
 * Хяналтын шат байхгүй тул админы гол ажил бол ЭРГЭЖ ХАРАХ: ялангуяа
 * `duplicate_ack` тугтай мөрүүд (алба хаагч давхардлын анхааруулгыг давсан)
 * болон гараар бичсэн нэрүүд. Тиймээс шүүлтүүд тэр ажилд чиглэсэн.
 */
import { and, desc, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { hotelSurveys, surveyPhotos, surveyors } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";
import { normalizeName } from "@/lib/surveys/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const params = new URL(request.url).searchParams;
  const limit = Math.min(200, Number(params.get("limit") ?? 100) || 100);

  const filters: SQL[] = [];

  const status = params.get("status");
  if (status === "DELETED" || status === "EXPORTED" || status === "SUBMITTED") {
    filters.push(eq(hotelSurveys.status, status));
  } else {
    // Анхны байдлаар устгасныг нуух — админ зориуд хүсвэл л харна.
    filters.push(
      or(
        eq(hotelSurveys.status, "SUBMITTED"),
        eq(hotelSurveys.status, "EXPORTED"),
      )!,
    );
  }

  const surveyorId = params.get("surveyor_id");
  if (surveyorId) filters.push(eq(hotelSurveys.surveyorId, surveyorId));

  if (params.get("flagged") === "1") {
    filters.push(eq(hotelSurveys.duplicateAck, true));
  }

  const from = params.get("from");
  if (from) filters.push(gte(hotelSurveys.createdAt, new Date(from)));
  const to = params.get("to");
  if (to) filters.push(lte(hotelSurveys.createdAt, new Date(to)));

  const q = params.get("q")?.trim();
  if (q) {
    // Хайлт нь хэвийн болгосон нэр дээр — бичих хэв маягаас үл хамаарна.
    filters.push(ilike(hotelSurveys.nameNormalized, `%${normalizeName(q)}%`));
  }

  const db = getDb();
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
      duplicateAck: hotelSurveys.duplicateAck,
      duplicateOf: hotelSurveys.duplicateOf,
      osmRef: hotelSurveys.osmRef,
      note: hotelSurveys.note,
      createdAt: hotelSurveys.createdAt,
      surveyorBadge: surveyors.badgeNumber,
      surveyorName: surveyors.fullName,
    })
    .from(hotelSurveys)
    .innerJoin(surveyors, eq(hotelSurveys.surveyorId, surveyors.id))
    .where(and(...filters))
    .orderBy(desc(hotelSurveys.createdAt))
    .limit(limit);

  // Зургуудыг нэг query-гээр (мөр тутамд query хийхгүй).
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
    if (photo.isPrimary) {
      list.unshift(photo.publicUrl);
    } else {
      list.push(photo.publicUrl);
    }
    bySurvey.set(photo.surveyId, list);
  }

  return NextResponse.json({
    surveys: rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      address_text: row.addressText,
      lat: Number(row.lat),
      lng: Number(row.lng),
      status: row.status,
      location_source: row.locationSource,
      accuracy_m: row.accuracyM,
      duplicate_ack: row.duplicateAck,
      duplicate_of: row.duplicateOf,
      osm_ref: row.osmRef,
      note: row.note,
      created_at: row.createdAt.toISOString(),
      surveyor: { badge: row.surveyorBadge, name: row.surveyorName },
      photos: bySurvey.get(row.id) ?? [],
    })),
  });
}
