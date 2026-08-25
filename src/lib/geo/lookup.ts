/**
 * [📍] товчны тархи — гурван эх сурвалжийг нэгтгэнэ (§5.1).
 *
 *   1. Манай өөрийн DB   — шуурхай, үнэгүй, хязгааргүй. Цаг хугацаа өнгөрөх
 *                          тусам ХАМГИЙН САЙН эх сурвалж болж өснө.
 *   2. Overpass (OSM)    — ойролцоох буудлын POI
 *   3. Nominatim         — гудамжны хаяг. ҮРГЭЛЖ дуудагдана.
 *
 * OSM дээр Монголын буудлын мэдээлэл сийрэг (§13.2) тул 2-р эх сурвалж
 * ихэвчлэн хоосон ирнэ. Гэхдээ 3-р эх сурвалж найдвартай ажилладаг ба
 * "нэг товч дараад хаяг гарч ирэх" гэсэн үндсэн шаардлагыг тэр хангана.
 */
import { and, gte, lte, ne } from "drizzle-orm";

import { getDb } from "@/db";
import { geoCache, hotelSurveys } from "@/db/schema";
import { eq } from "drizzle-orm";

import { boundingBox, gridKey, haversineMeters } from "./distance";
import { findNearbyHotels, reverseGeocode, type OsmPoi } from "./osm";
import { reserveSlot } from "./rate-gate";

/** Хайх радиус — [📍] дарахад ойролцоо гэж үзэх зай. */
export const LOOKUP_RADIUS_M = 150;

/**
 * Кэшийг шинэчлэхийг оролдох хугацаа. OSM бол ODbL нээлттэй өгөгдөл тул
 * хугацаагүй хадгалж БОЛНО — энэ нь зөвхөн шинэчлэлт авах хэмнэл.
 * Шинэчлэх оролдлого бүтэлгүйтвэл хуучин утгыг ашиглана.
 */
const CACHE_REFRESH_DAYS = 30;

export type NearbyCandidate = {
  source: "SURVEY" | "OSM";
  name: string;
  lat: number;
  lng: number;
  distanceM: number;
  /** OSM-ээс ирсэн бол "node/123" — маягтад хадгалагдана. */
  osmRef: string | null;
  /** Манай DB-д аль хэдийн бүртгэгдсэн эсэх — UI улаанаар анхааруулна. */
  alreadyRegistered: boolean;
  kind: string | null;
};

export type GeoLookupResult = {
  addressText: string | null;
  nearby: NearbyCandidate[];
  /** OSM руу хандаж чадаагүй — хэрэглэгчид "гараар бичнэ үү" гэж хэлнэ. */
  degraded: boolean;
  cached: boolean;
};

// ---------------------------------------------------------------------------
// 1. Манай өөрийн бүртгэл
// ---------------------------------------------------------------------------
async function findRegisteredNearby(
  lat: number,
  lng: number,
): Promise<NearbyCandidate[]> {
  const box = boundingBox({ lat, lng }, LOOKUP_RADIUS_M);

  // Эхлээд индекстэй дөрвөлжингөөр шүүнэ, дараа нь яг зайг бодно.
  const rows = await getDb()
    .select({
      id: hotelSurveys.id,
      name: hotelSurveys.name,
      lat: hotelSurveys.lat,
      lng: hotelSurveys.lng,
      osmRef: hotelSurveys.osmRef,
    })
    .from(hotelSurveys)
    .where(
      and(
        gte(hotelSurveys.lat, String(box.minLat)),
        lte(hotelSurveys.lat, String(box.maxLat)),
        gte(hotelSurveys.lng, String(box.minLng)),
        lte(hotelSurveys.lng, String(box.maxLng)),
        ne(hotelSurveys.status, "DELETED"),
      ),
    )
    .limit(50);

  return rows
    .map((row) => {
      const position = { lat: Number(row.lat), lng: Number(row.lng) };
      return {
        source: "SURVEY" as const,
        name: row.name,
        lat: position.lat,
        lng: position.lng,
        distanceM: Math.round(haversineMeters({ lat, lng }, position)),
        osmRef: row.osmRef,
        alreadyRegistered: true,
        kind: null,
      };
    })
    .filter((candidate) => candidate.distanceM <= LOOKUP_RADIUS_M);
}

// ---------------------------------------------------------------------------
// 2–3. OSM (кэштэй)
// ---------------------------------------------------------------------------
type CachedOsm = { addressText: string | null; poi: OsmPoi[] };

async function readCache(key: string): Promise<{
  value: CachedOsm;
  stale: boolean;
} | null> {
  const [row] = await getDb()
    .select()
    .from(geoCache)
    .where(eq(geoCache.gridKey, key))
    .limit(1);
  if (!row) return null;

  const ageDays =
    (Date.now() - row.fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
  return {
    value: {
      addressText: row.addressText,
      poi: Array.isArray(row.poi) ? (row.poi as OsmPoi[]) : [],
    },
    stale: ageDays > CACHE_REFRESH_DAYS,
  };
}

async function writeCache(key: string, value: CachedOsm): Promise<void> {
  await getDb()
    .insert(geoCache)
    .values({
      gridKey: key,
      addressText: value.addressText,
      poi: value.poi,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: geoCache.gridKey,
      set: {
        addressText: value.addressText,
        poi: value.poi,
        fetchedAt: new Date(),
      },
    });
}

async function fetchFromOsm(
  lat: number,
  lng: number,
): Promise<CachedOsm | null> {
  // Хоёр үйлчилгээ тус тусдаа хэмнэлтэй. Аль нэг нь унасан ч нөгөөг нь авна.
  const [addressResult, poiResult] = await Promise.allSettled([
    (async () => {
      const slot = await reserveSlot("nominatim", 1_000);
      if (!slot.granted) throw new Error("Nominatim: слот хэт хол");
      return reverseGeocode(lat, lng);
    })(),
    (async () => {
      const slot = await reserveSlot("overpass", 1_000);
      if (!slot.granted) throw new Error("Overpass: слот хэт хол");
      return findNearbyHotels(lat, lng, LOOKUP_RADIUS_M);
    })(),
  ]);

  if (addressResult.status === "rejected" && poiResult.status === "rejected") {
    console.error("[geo] OSM бүхэлдээ амжилтгүй:", addressResult.reason);
    return null;
  }

  return {
    addressText:
      addressResult.status === "fulfilled" ? addressResult.value : null,
    poi: poiResult.status === "fulfilled" ? poiResult.value : [],
  };
}

// ---------------------------------------------------------------------------
// Нэгтгэл
// ---------------------------------------------------------------------------
export async function lookupLocation(
  lat: number,
  lng: number,
): Promise<GeoLookupResult> {
  const key = gridKey(lat, lng);

  const [registered, cached] = await Promise.all([
    findRegisteredNearby(lat, lng),
    readCache(key),
  ]);

  let osm: CachedOsm | null = cached?.value ?? null;
  let fromCache = Boolean(cached) && !cached!.stale;
  let degraded = false;

  if (!cached || cached.stale) {
    const fresh = await fetchFromOsm(lat, lng);
    if (fresh) {
      osm = fresh;
      fromCache = false;
      await writeCache(key, fresh);
    } else if (cached) {
      // Шинэчилж чадсангүй — хуучин утга нь юу ч байхгүйгээс дээр.
      osm = cached.value;
      fromCache = true;
    } else {
      degraded = true;
    }
  }

  // Аль хэдийн бүртгэгдсэн газрыг OSM жагсаалтаас хасна — хоёр удаа
  // харуулах нь алба хаагчийг эргэлзүүлнэ.
  const registeredRefs = new Set(
    registered.map((item) => item.osmRef).filter(Boolean),
  );

  const osmCandidates: NearbyCandidate[] = (osm?.poi ?? [])
    .filter((poi) => !registeredRefs.has(poi.osmRef))
    .map((poi) => ({
      source: "OSM" as const,
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      distanceM: Math.round(haversineMeters({ lat, lng }, poi)),
      osmRef: poi.osmRef,
      alreadyRegistered: false,
      kind: poi.kind,
    }))
    .filter((candidate) => candidate.distanceM <= LOOKUP_RADIUS_M);

  return {
    addressText: osm?.addressText ?? null,
    // Бүртгэгдсэнийг нь эхэнд — давхардлаас сэргийлэх нь эхний зорилго.
    nearby: [...registered, ...osmCandidates].sort(
      (a, b) => a.distanceM - b.distanceM,
    ),
    degraded,
    cached: fromCache,
  };
}
