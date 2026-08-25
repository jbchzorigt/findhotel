/**
 * Алба хаагч ӨӨРИЙН бүртгэлээ засах / устгах.
 *
 * Хязгаарлалтууд ба тэдгээрийн шалтгаан:
 *
 *   - Зөвхөн ЭЗЭН нь. Админ бүх мөрийг удирдана (`/api/admin/surveys`),
 *     алба хаагч зөвхөн өөрийнхөө мөрийг. Шүүлт query дотор — UI-д биш.
 *
 *   - Зөвхөн `SUBMITTED` төлөвт. `EXPORTED` болсон мөр нь Hotel SaaS руу
 *     аль хэдийн очсон; түүнийг энд өөрчилвөл хоёр систем зөрнө. Тийм
 *     тохиолдолд админаар дамжина.
 *
 *   - Зураг өөрчлөгдөхгүй. Зураг бол баримт — солих боломжтой байвал
 *     бүртгэлийн үнэ цэн буурна. Буруу зурагтай бол устгаад шинээр бүртгэнэ.
 *
 * Засварын дараа §11-ийн давхардлын шалгалт ДАХИН ажиллана: нэр, байршил
 * өөрчлөгдсөн бол шинэ утгаараа давхардаж мэднэ.
 */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { hotelSurveys, surveyPhotos } from "@/db/schema";
import { writeAudit } from "@/lib/auth/audit";
import { getClientIp, getSession } from "@/lib/auth/request";
import { normalizeName } from "@/lib/surveys/normalize";
import { checkQuality } from "@/lib/surveys/quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  phone: z.string().regex(/^[0-9]{8}$/, "Утасны дугаар 8 оронтой байх ёстой.").optional(),
  address_text: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  location_source: z.enum(["OSM_POI", "GPS", "MAP_PIN", "MAPS_LINK"]).optional(),
  osm_ref: z.string().max(120).nullable().optional(),
  /** Устгах хүсэлт. Зөөлөн устгалт — мөр үлдэж, төлөв нь солигдоно. */
  status: z.literal("DELETED").optional(),
  duplicate_ack: z.boolean().optional().default(false),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрээгүй байна." }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Мэдээлэл буруу байна.",
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

  // Эзэмшил ба төлөвийг НЭГ query-д шалгана.
  const [existing] = await db
    .select()
    .from(hotelSurveys)
    .where(
      and(
        eq(hotelSurveys.id, id),
        eq(hotelSurveys.surveyorId, session.sub),
        eq(hotelSurveys.status, "SUBMITTED"),
      ),
    )
    .limit(1);

  if (!existing) {
    // "Олдсонгүй" ба "чинийх биш" хоёрыг ялгахгүй — бусдын бүртгэл байгаа
    // эсэхийг мэдэх боломж олгохгүй.
    return NextResponse.json(
      { error: "Бүртгэл олдсонгүй эсвэл засах боломжгүй." },
      { status: 404 },
    );
  }

  // ---------------------------------------------------------------- устгах
  if (input.status === "DELETED") {
    await db
      .update(hotelSurveys)
      .set({ status: "DELETED", updatedAt: new Date() })
      .where(eq(hotelSurveys.id, id));

    await writeAudit({
      actorId: session.sub,
      action: "survey.deleted",
      subjectId: id,
      ip: await getClientIp(),
      detail: { name: existing.name, by: "owner" },
    });
    return NextResponse.json({ id, status: "DELETED" });
  }

  // ---------------------------------------------------------------- засах
  const name = input.name ?? existing.name;
  const lat = input.lat ?? Number(existing.lat);
  const lng = input.lng ?? Number(existing.lng);

  const photos = await db
    .select({ exifLat: surveyPhotos.exifLat, exifLng: surveyPhotos.exifLng })
    .from(surveyPhotos)
    .where(eq(surveyPhotos.surveyId, id));

  const quality = await checkQuality({
    name,
    phone: input.phone ?? existing.phone,
    lat,
    lng,
    // Байршил гараар зөөгдсөн бол GPS-ийн нарийвчлал утгагүй болно.
    locationAccuracyM:
      input.lat !== undefined ? null : existing.locationAccuracyM,
    osmRef: input.osm_ref !== undefined ? input.osm_ref : existing.osmRef,
    photos: photos.map((photo) => ({
      exifLat: photo.exifLat === null ? null : Number(photo.exifLat),
      exifLng: photo.exifLng === null ? null : Number(photo.exifLng),
    })),
    duplicateAck: input.duplicate_ack,
    excludeId: id,
  });

  if (quality.blocks.length > 0) {
    return NextResponse.json(
      {
        error: "Засварыг хадгалах боломжгүй байна.",
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

  await db
    .update(hotelSurveys)
    .set({
      name,
      nameNormalized: normalizeName(name),
      phone: input.phone ?? existing.phone,
      addressText:
        input.address_text !== undefined
          ? input.address_text
          : existing.addressText,
      note: input.note !== undefined ? input.note : existing.note,
      lat: String(lat),
      lng: String(lng),
      locationSource: input.location_source ?? existing.locationSource,
      locationAccuracyM:
        input.lat !== undefined ? null : existing.locationAccuracyM,
      osmRef: input.osm_ref !== undefined ? input.osm_ref : existing.osmRef,
      duplicateAck: input.duplicate_ack || existing.duplicateAck,
      duplicateOf: quality.duplicateOf ?? existing.duplicateOf,
      updatedAt: new Date(),
    })
    .where(eq(hotelSurveys.id, id));

  await writeAudit({
    actorId: session.sub,
    action: "survey.updated",
    subjectId: id,
    ip: await getClientIp(),
    detail: { name },
  });

  return NextResponse.json({ id, warnings: quality.warnings });
}
