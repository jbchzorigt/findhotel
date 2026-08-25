/**
 * Бүртгэл үүсгэх / жагсаах.
 *
 * `DRAFT` төлөв байхгүй (§7): алба хаагч шууд илгээдэг тул маягт зөвхөн
 * клиент дээр амьдарна. Энд мөр үүсэх нь аль хэдийн `SUBMITTED` гэсэн үг —
 * хагас дутуу хогийн мөр хуримтлагдахгүй.
 *
 * §11-ийн чанарын хатуу шалгалтууд (давхардал, EXIF зөрүү, GPS нарийвчлал)
 * Phase 4-д энэ route дээр нэмэгдэнэ. Одоогоор схемийн шалгалт болон DB-ийн
 * CHECK constraint-ууд ажиллаж байна.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { hotelSurveys, surveyPhotos } from "@/db/schema";
import { writeAudit } from "@/lib/auth/audit";
import { getClientIp, getSession } from "@/lib/auth/request";
import { MAX_PHOTOS, MIN_PHOTOS } from "@/lib/photos/constants";
import { normalizeName } from "@/lib/surveys/normalize";
import { checkQuality } from "@/lib/surveys/quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PhotoSchema = z.object({
  r2_key: z.string().min(1).max(400),
  public_url: z.string().url().max(600),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  bytes: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  exif_lat: z.number().min(-90).max(90).nullable().optional(),
  exif_lng: z.number().min(-180).max(180).nullable().optional(),
  exif_taken_at: z.string().datetime().nullable().optional(),
});

const CreateSchema = z.object({
  client_uuid: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  // 8 орон, эхний цифрт хязгааргүй (суурин утас ч бүртгэгдэнэ).
  // DB дээр ч ижил CHECK бий.
  phone: z.string().regex(/^[0-9]{8}$/, "Утасны дугаар 8 оронтой байх ёстой."),
  address_text: z.string().trim().max(500).nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  location_source: z.enum(["OSM_POI", "GPS", "MAP_PIN", "MAPS_LINK"]),
  location_accuracy_m: z.number().int().min(0).max(100_000).nullable().optional(),
  osm_ref: z.string().max(120).nullable().optional(),
  osm_raw_name: z.string().max(200).nullable().optional(),
  google_maps_url: z.string().url().max(600).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  captured_at: z.string().datetime(),
  photos: z.array(PhotoSchema).min(MIN_PHOTOS).max(MAX_PHOTOS),
  /**
   * Алба хаагч давхардлын анхааруулгыг хараад "өөр буудал мөн" гэж
   * баталсан эсэх. Зөвхөн давхардлын блокийг давна — GPS/EXIF-ийн блокийг
   * давахгүй (§11).
   */
  duplicate_ack: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрээгүй байна." }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Бүртгэлийн мэдээлэл дутуу эсвэл буруу байна.",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const db = getDb();

  /*
   * Idempotency: утас `client_uuid`-ыг үүсгэдэг. Сүлжээ тасарч клиент дахин
   * илгээвэл шинэ мөр үүсэхгүй, өмнөх мөрөө буцаана. Талбарын ажилд сүлжээ
   * тогтворгүй байдаг тул энэ нь онолын биш, бодит хамгаалалт.
   */
  const [existing] = await db
    .select({ id: hotelSurveys.id })
    .from(hotelSurveys)
    .where(eq(hotelSurveys.clientUuid, input.client_uuid))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { id: existing.id, status: "SUBMITTED", duplicate_submission: true },
      { status: 200 },
    );
  }

  /*
   * §11-ийн шалгалт. Энэ бол хог өгөгдөл Hotel SaaS руу орохоос сэргийлэх
   * ЦОРЫН ГАНЦ давхарга — ахлагчийн хяналт байхгүй тул зөөлөн анхааруулга
   * биш, хатуу блок.
   */
  const quality = await checkQuality({
    name: input.name,
    phone: input.phone,
    lat: input.lat,
    lng: input.lng,
    locationAccuracyM: input.location_accuracy_m ?? null,
    osmRef: input.osm_ref ?? null,
    photos: input.photos.map((photo) => ({
      exifLat: photo.exif_lat,
      exifLng: photo.exif_lng,
    })),
    duplicateAck: input.duplicate_ack,
  });

  if (quality.blocks.length > 0) {
    return NextResponse.json(
      {
        error: "Бүртгэлийг илгээх боломжгүй байна.",
        blocks: quality.blocks.map((block) => ({
          code: block.code,
          message: block.message,
          acknowledgeable: block.acknowledgeable,
          duplicate: block.duplicate
            ? {
                id: block.duplicate.id,
                name: block.duplicate.name,
                photo_url: block.duplicate.photoUrl,
                distance_m: block.duplicate.distanceM,
                similarity: Number(block.duplicate.similarity.toFixed(2)),
                created_at: block.duplicate.createdAt,
              }
            : undefined,
        })),
      },
      { status: 409 },
    );
  }

  const [survey] = await db
    .insert(hotelSurveys)
    .values({
      clientUuid: input.client_uuid,
      name: input.name,
      nameNormalized: normalizeName(input.name),
      phone: input.phone,
      addressText: input.address_text ?? null,
      lat: String(input.lat),
      lng: String(input.lng),
      locationSource: input.location_source,
      locationAccuracyM: input.location_accuracy_m ?? null,
      osmRef: input.osm_ref ?? null,
      osmRawName: input.osm_raw_name ?? null,
      googleMapsUrl: input.google_maps_url ?? null,
      note: input.note ?? null,
      surveyorId: session.sub,
      capturedAt: new Date(input.captured_at),
      // Сэжигтэй мөрийг тэмдэглэнэ — алба хаагч давсан ч мөр үлдэнэ,
      // админ хожим шүүж хардаг.
      duplicateAck: input.duplicate_ack,
      duplicateOf: quality.duplicateOf,
    })
    .returning({ id: hotelSurveys.id });

  const surveyId = survey!.id;

  await db.insert(surveyPhotos).values(
    input.photos.map((photo, index) => ({
      surveyId,
      r2Key: photo.r2_key,
      publicUrl: photo.public_url,
      sha256: photo.sha256 ?? null,
      bytes: photo.bytes ?? null,
      width: photo.width ?? null,
      height: photo.height ?? null,
      exifLat: photo.exif_lat != null ? String(photo.exif_lat) : null,
      exifLng: photo.exif_lng != null ? String(photo.exif_lng) : null,
      exifTakenAt: photo.exif_taken_at ? new Date(photo.exif_taken_at) : null,
      isPrimary: index === 0,
    })),
  );

  await writeAudit({
    actorId: session.sub,
    action: "survey.created",
    subjectId: surveyId,
    ip: await getClientIp(),
    detail: {
      name: input.name,
      photos: input.photos.length,
      duplicateAck: input.duplicate_ack,
      duplicateOf: quality.duplicateOf,
    },
  });

  return NextResponse.json(
    {
      id: surveyId,
      status: "SUBMITTED",
      warnings: quality.warnings,
    },
    { status: 201 },
  );
}

// ---------------------------------------------------------------------------
// Жагсаалт
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрээгүй байна." }, { status: 401 });
  }

  const limit = Math.min(
    100,
    Number(new URL(request.url).searchParams.get("limit") ?? 50) || 50,
  );
  const db = getDb();

  /*
   * SURVEYOR зөвхөн ӨӨРИЙН мөрийг харна. Энэ шүүлт query дотор байх ёстой —
   * UI дээр нуух нь хамгаалалт биш (§10).
   */
  const ownOnly = session.role !== "ADMIN";

  const rows = await db
    .select({
      id: hotelSurveys.id,
      name: hotelSurveys.name,
      phone: hotelSurveys.phone,
      addressText: hotelSurveys.addressText,
      lat: hotelSurveys.lat,
      lng: hotelSurveys.lng,
      status: hotelSurveys.status,
      createdAt: hotelSurveys.createdAt,
    })
    .from(hotelSurveys)
    .where(
      ownOnly
        ? and(
            eq(hotelSurveys.surveyorId, session.sub),
            eq(hotelSurveys.status, "SUBMITTED"),
          )
        : undefined,
    )
    .orderBy(desc(hotelSurveys.createdAt))
    .limit(limit);

  // Үндсэн зургийг нэг query-гээр авна (мөр тутамд query хийхгүй).
  const photos = rows.length
    ? await db
        .select({
          surveyId: surveyPhotos.surveyId,
          publicUrl: surveyPhotos.publicUrl,
        })
        .from(surveyPhotos)
        .where(
          and(
            inArray(
              surveyPhotos.surveyId,
              rows.map((row) => row.id),
            ),
            eq(surveyPhotos.isPrimary, true),
          ),
        )
    : [];
  const primaryBySurvey = new Map(
    photos.map((photo) => [photo.surveyId, photo.publicUrl]),
  );

  return NextResponse.json({
    surveys: rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      address_text: row.addressText,
      lat: Number(row.lat),
      lng: Number(row.lng),
      status: row.status,
      created_at: row.createdAt.toISOString(),
      photo_url: primaryBySurvey.get(row.id) ?? null,
    })),
  });
}
