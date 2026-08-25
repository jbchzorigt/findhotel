/**
 * Газарзүйн зай — PostGIS-гүйгээр.
 *
 * Хэдэн мянган мөрөнд bounding box + Haversine хангалттай (§7). PostGIS нь
 * Neon дээр боломжтой ч нэмэлт өргөтгөл, нэмэлт ойлголт шаарддаг — өгөөж нь
 * энэ хэмжээнд байхгүй.
 */

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Индекс ашиглах боломжтой хайлтын хүрээ.
 *
 * Эхлээд энэ дөрвөлжингөөр шүүж (индекстэй), дараа нь Haversine-ээр яг зайг
 * бодно. Шууд Haversine хийвэл индекс ашиглагдахгүй, бүх мөрийг уншина.
 */
export function boundingBox(
  center: { lat: number; lng: number },
  radiusM: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusM / 111_320;
  // Туйл руу ойртох тусам уртрагийн зай багасна.
  const cos = Math.cos((center.lat * Math.PI) / 180);
  const lngDelta = radiusM / (111_320 * Math.max(0.01, Math.abs(cos)));

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/** ~25м торны түлхүүр — кэшийн оноолт (§5.1). */
export function gridKey(lat: number, lng: number): string {
  const LAT_STEP = 0.00025; // ≈28м
  const LNG_STEP = 0.00035; // ≈26м 48° өргөрөгт
  const snap = (value: number, step: number) =>
    (Math.round(value / step) * step).toFixed(5);
  return `${snap(lat, LAT_STEP)},${snap(lng, LNG_STEP)}`;
}
