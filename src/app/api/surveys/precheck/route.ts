/**
 * Урьдчилсан шалгалт — маягт бөглөж байх үед.
 *
 * Илгээх товч дарахаас ӨМНӨ давхардлыг харуулах нь зорилго: алба хаагч
 * зураг хуулж дуусаад "давхардсан байна" гэж сонсох нь цаг, дата хоёуланг
 * дэмий үрнэ. Энэ нь зөвхөн урьдчилсан мэдээлэл — эцсийн шийдвэрийг
 * `POST /api/surveys` гаргана (клиентэд найдахгүй).
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/request";
import { checkQuality } from "@/lib/surveys/quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().max(32).optional().default(""),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  osm_ref: z.string().max(120).nullable().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрээгүй байна." }, { status: 401 });
  }

  const parsed = RequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ blocks: [], warnings: [] });
  }
  const input = parsed.data;

  const quality = await checkQuality({
    name: input.name,
    phone: input.phone,
    lat: input.lat,
    lng: input.lng,
    // Урьдчилсан шалгалтад зөвхөн давхардлыг харна — GPS/EXIF-ийг
    // илгээх агшинд шалгана.
    locationAccuracyM: null,
    osmRef: input.osm_ref ?? null,
    photos: [],
    duplicateAck: false,
  });

  return NextResponse.json({
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
    warnings: quality.warnings,
  });
}
