/**
 * Илгээх агшны чанарын шалгалт (§11).
 *
 * Ахлагчийн хяналтын шат зориуд байхгүй (§4) тул эдгээр шалгалт нь
 * зөөлөн анхааруулга БИШ — Hotel SaaS руу хог өгөгдөл орохоос сэргийлэх
 * цорын ганц давхарга. Тиймээс хатуу блок.
 *
 * Хоёр төрлийн блок бий:
 *
 *   ДАВАХ БОЛОМЖГҮЙ — GPS нарийвчлал, EXIF-ийн зөрүү. Эдгээр нь техникийн
 *   баримт бөгөөд алба хаагчийн бодлоор өөрчлөгдөхгүй. Дахин зураг дарах,
 *   эсвэл GPS сайжрахыг хүлээх л шийдэл.
 *
 *   ДАВАХ БОЛОМЖТОЙ — давхардлын сэжиг. Хоёр буудал зэрэгцэн байх нь
 *   бодит зүйл тул алба хаагч өмнөх бүртгэлийн ЗУРГИЙГ хараад "өөр буудал
 *   мөн" гэж баталж чадна. Тэр тохиолдолд `duplicate_ack` тугтай
 *   хадгалагдаж, админ хожим шүүж хардаг.
 */
import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { boundingBox, haversineMeters } from "@/lib/geo/distance";

import { normalizeName } from "./normalize";

/** GPS нарийвчлал үүнээс муу бол байршил найдваргүй. */
export const MAX_ACCURACY_M = 100;
/** Зургийн EXIF байршил маягтаас үүнээс хол бол өөр газраас дарсан гэж үзнэ. */
export const MAX_EXIF_DRIFT_M = 150;
/** Давхардал хайх радиус. */
export const DUPLICATE_RADIUS_M = 75;
/** Нэр огт өөр байсан ч сэжиглэх зай — нэг барилга гэж үзнэ. */
export const SAME_BUILDING_RADIUS_M = 25;
/** Нэрний ижилслийн босго (pg_trgm). */
export const NAME_SIMILARITY_THRESHOLD = 0.45;

export type BlockCode =
  | "GPS_ACCURACY"
  | "EXIF_MISMATCH"
  | "DUPLICATE_OSM_REF"
  | "DUPLICATE_NEARBY";

export type DuplicateInfo = {
  id: string;
  name: string;
  photoUrl: string | null;
  distanceM: number;
  similarity: number;
  createdAt: string;
};

export type Block = {
  code: BlockCode;
  message: string;
  /** Алба хаагч баталгаажуулж давж гарах боломжтой эсэх. */
  acknowledgeable: boolean;
  duplicate?: DuplicateInfo;
};

export type Warning = {
  code: "PHONE_REUSED" | "NAME_REUSED";
  message: string;
};

export type QualityInput = {
  name: string;
  phone: string;
  lat: number;
  lng: number;
  locationAccuracyM: number | null;
  osmRef: string | null;
  photos: Array<{ exifLat?: number | null; exifLng?: number | null }>;
  duplicateAck: boolean;
  /**
   * Засварлаж буй бүртгэлийн id. Байвал давхардлын хайлтаас өөрийг нь
   * хасна — эс бөгөөс мөр өөрийгөө давхардал гэж заана.
   */
  excludeId?: string;
};

export type QualityResult = {
  blocks: Block[];
  warnings: Warning[];
  /** Давхардал гэж сэжиглэсэн мөрийн id — `duplicate_of`-д хадгалагдана. */
  duplicateOf: string | null;
};

type NearbyRow = {
  id: string;
  name: string;
  lat: string;
  lng: string;
  sim: number;
  photo_url: string | null;
  created_at: string;
  osm_ref: string | null;
};

export async function checkQuality(
  input: QualityInput,
): Promise<QualityResult> {
  const blocks: Block[] = [];
  const warnings: Warning[] = [];
  let duplicateOf: string | null = null;

  // -------------------------------------------------------------------------
  // 1. GPS нарийвчлал
  // -------------------------------------------------------------------------
  if (
    input.locationAccuracyM !== null &&
    input.locationAccuracyM > MAX_ACCURACY_M
  ) {
    blocks.push({
      code: "GPS_ACCURACY",
      acknowledgeable: false,
      message:
        `GPS нарийвчлал ${input.locationAccuracyM}м байна (${MAX_ACCURACY_M}м-ээс сайн байх ёстой). ` +
        "Тэнгэр харагдах газар очиж, [📍] товчийг дахин дарна уу.",
    });
  }

  // -------------------------------------------------------------------------
  // 2. Зургийн EXIF байршил
  // -------------------------------------------------------------------------
  for (const photo of input.photos) {
    if (photo.exifLat == null || photo.exifLng == null) continue;
    const drift = haversineMeters(
      { lat: input.lat, lng: input.lng },
      { lat: photo.exifLat, lng: photo.exifLng },
    );
    if (drift > MAX_EXIF_DRIFT_M) {
      blocks.push({
        code: "EXIF_MISMATCH",
        acknowledgeable: false,
        message:
          `Зураг энэ байршлаас ${Math.round(drift)}м зайд дарагдсан байна. ` +
          "Буудлын өмнө зогсоод шинээр зураг дарна уу.",
      });
      break; // Нэг зөрүү хангалттай — бүгдийг жагсаах шаардлагагүй.
    }
  }

  // -------------------------------------------------------------------------
  // 3. Давхардал
  // -------------------------------------------------------------------------
  const box = boundingBox({ lat: input.lat, lng: input.lng }, DUPLICATE_RADIUS_M);
  const normalized = normalizeName(input.name);

  /*
   * `undefined`-ийг SQL параметр болгож болохгүй: Drizzle түүнийг огт
   * орлуулахгүй тул `::uuid is null` гэсэн эвдэрсэн синтакс үүсгэдэг
   * (Postgres 42601). Тодорхой `null` болгож өгнө.
   */
  const excludeId = input.excludeId ?? null;

  /*
   * Индекстэй дөрвөлжингөөр шүүж, trigram ижилслийг DB дээр бодуулна
   * (`gin(name_normalized gin_trgm_ops)` индекс §7-д үүсгэгдсэн).
   * `osm_ref`-ийн таарц нь дөрвөлжингөөс ГАДУУР ч байж болно: нэг л буудлын
   * OSM зангилаа тул зайнаас үл хамааран давхардал мөн.
   */
  const rows = await getDb().execute<NearbyRow>(sql`
    select
      hs.id,
      hs.name,
      hs.lat::text as lat,
      hs.lng::text as lng,
      hs.osm_ref,
      similarity(hs.name_normalized, ${normalized}) as sim,
      hs.created_at::text as created_at,
      (
        select sp.public_url from survey_photo sp
        where sp.survey_id = hs.id and sp.is_primary
        limit 1
      ) as photo_url
    from hotel_survey hs
    where hs.status <> 'DELETED'
      and (${excludeId}::uuid is null or hs.id <> ${excludeId}::uuid)
      and (
        (${input.osmRef}::text is not null and hs.osm_ref = ${input.osmRef})
        or (
          hs.lat between ${String(box.minLat)} and ${String(box.maxLat)}
          and hs.lng between ${String(box.minLng)} and ${String(box.maxLng)}
        )
      )
    limit 50
  `);

  const candidates = (rows.rows ?? []).map((row) => ({
    row,
    distanceM: Math.round(
      haversineMeters(
        { lat: input.lat, lng: input.lng },
        { lat: Number(row.lat), lng: Number(row.lng) },
      ),
    ),
  }));

  const toInfo = (candidate: (typeof candidates)[number]): DuplicateInfo => ({
    id: candidate.row.id,
    name: candidate.row.name,
    photoUrl: candidate.row.photo_url,
    distanceM: candidate.distanceM,
    similarity: Number(candidate.row.sim ?? 0),
    createdAt: candidate.row.created_at,
  });

  // 3a. Ижил OSM зангилаа — хамгийн хүчтэй дохио.
  const sameOsm = input.osmRef
    ? candidates.find((c) => c.row.osm_ref === input.osmRef)
    : undefined;

  if (sameOsm) {
    duplicateOf = sameOsm.row.id;
    if (!input.duplicateAck) {
      blocks.push({
        code: "DUPLICATE_OSM_REF",
        acknowledgeable: true,
        message: `"${sameOsm.row.name}" нь яг энэ буудлаар аль хэдийн бүртгэгдсэн байна.`,
        duplicate: toInfo(sameOsm),
      });
    }
  } else {
    // 3b. Байршил + нэрний ижилсэл.
    const suspects = candidates
      .filter((candidate) => candidate.distanceM <= DUPLICATE_RADIUS_M)
      .filter(
        (candidate) =>
          candidate.distanceM <= SAME_BUILDING_RADIUS_M ||
          Number(candidate.row.sim ?? 0) > NAME_SIMILARITY_THRESHOLD,
      )
      .sort((a, b) => a.distanceM - b.distanceM);

    const closest = suspects[0];
    if (closest) {
      duplicateOf = closest.row.id;
      if (!input.duplicateAck) {
        const sameBuilding = closest.distanceM <= SAME_BUILDING_RADIUS_M;
        blocks.push({
          code: "DUPLICATE_NEARBY",
          acknowledgeable: true,
          message: sameBuilding
            ? `${closest.distanceM}м зайд "${closest.row.name}" бүртгэлтэй байна — нэг барилга байж магадгүй.`
            : `${closest.distanceM}м зайд төстэй нэртэй "${closest.row.name}" бүртгэлтэй байна.`,
          duplicate: toInfo(closest),
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. ЯГ ижил нэр хаана ч байсан — блок биш, зөвхөн анхааруулга.
  //
  // Зай хол байвал (§11.3-ын 75м-ээс гадна) давхардлын шалгалт барихгүй.
  // Гэвч яг ижил нэр өөр газар гарах нь хоёр утгатай: сүлжээ буудлын
  // салбар (хэвийн), эсвэл цэгээ буруу тавьсан давхардал (алдаа). Аль нь
  // болохыг зөвхөн алба хаагч мэднэ — тиймээс блоклохгүй, зөвхөн хэлнэ.
  // -------------------------------------------------------------------------
  if (!blocks.some((block) => block.code.startsWith("DUPLICATE"))) {
    const nameRows = await getDb().execute<{ name: string }>(sql`
      select name
      from hotel_survey
      where name_normalized = ${normalized}
        and status <> 'DELETED'
        and (${excludeId}::uuid is null or id <> ${excludeId}::uuid)
      limit 1
    `);
    if (nameRows.rows?.[0]) {
      warnings.push({
        code: "NAME_REUSED",
        message:
          `"${input.name}" нэртэй өөр бүртгэл аль хэдийн байна. ` +
          "Салбар мөн бол зүгээр, эс бөгөөс байршлаа шалгана уу.",
      });
    }
  }

  // -------------------------------------------------------------------------
  // 5. Утас давхардсан эсэх — блок биш, зөвхөн анхааруулга.
  //    Нэг эзэн хэд хэдэн буудалтай байх нь бодит зүйл.
  // -------------------------------------------------------------------------
  const phoneRows = await getDb().execute<{ name: string }>(sql`
    select name from hotel_survey
    where phone = ${input.phone} and status <> 'DELETED'
      and (${excludeId}::uuid is null or id <> ${excludeId}::uuid)
    limit 1
  `);
  const phoneMatch = phoneRows.rows?.[0];
  if (phoneMatch) {
    warnings.push({
      code: "PHONE_REUSED",
      message: `Энэ утас "${phoneMatch.name}"-д бүртгэгдсэн байна.`,
    });
  }

  return { blocks, warnings, duplicateOf };
}
