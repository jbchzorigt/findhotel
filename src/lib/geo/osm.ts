/**
 * OpenStreetMap-ийн үнэгүй үйлчилгээнүүд.
 *
 *   Nominatim — координатаас гудамжны хаяг (reverse geocode)
 *   Overpass  — координатын ойролцоох буудлын POI
 *
 * Хэрэглээний нөхцөл (§13.3), заавал баримтална:
 *   - Nominatim: секундэд 1 дуудлага  → `rate-gate.ts`
 *   - User-Agent дотор холбоо барих мэдээлэл → `GEO_USER_AGENT`
 *   - Үр дүнг кэшлэх → `geo_cache`
 *   - Эх сурвалжийг зааж харуулах (ODbL) → UI дээр "© OpenStreetMap contributors"
 *
 * API түлхүүр байхгүй — эдгээр үйлчилгээ бүртгэлгүй ажилладаг.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const REQUEST_TIMEOUT_MS = 8_000;

export type OsmPoi = {
  /** "node/123456" — тогтвортой лавлагаа, давхардлын түлхүүр. */
  osmRef: string;
  name: string;
  lat: number;
  lng: number;
  kind: string | null;
};

function userAgent(): string {
  const ua = process.env.GEO_USER_AGENT;
  if (!ua) {
    // Тодорхойгүй User-Agent-тай хандах нь Nominatim-ийн нөхцөл зөрчнө.
    throw new Error(
      "GEO_USER_AGENT тохируулагдаагүй байна. Nominatim нь холбоо барих " +
        "мэдээлэл шаарддаг, ж: 'HotelFieldSurvey/1.0 (имэйл)'.",
    );
  }
  return ua;
}

// ---------------------------------------------------------------------------
// Nominatim — хаяг
// ---------------------------------------------------------------------------
type NominatimAddress = Record<string, string | undefined>;

/**
 * Хаягийн хэсгүүдээс товч, уншихад ойлгомжтой мөр угсарна.
 *
 * `display_name`-ийг шууд авахгүй: тэр нь улс, шуудангийн код зэргийг
 * дуустал нь жагсаадаг тул талбарын маягтад хэт урт.
 */
function formatAddress(address: NominatimAddress, fallback?: string): string | null {
  const parts = [
    address.city_district ?? address.district ?? address.suburb,
    address.quarter ?? address.neighbourhood,
    address.road,
    address.house_number,
  ].filter((part): part is string => Boolean(part && part.trim()));

  if (parts.length > 0) return parts.join(", ");
  if (fallback) {
    // Улс болон шуудангийн кодыг хасна.
    return fallback.split(",").slice(0, 4).join(",").trim() || null;
  }
  return null;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("accept-language", "mn");

  const response = await fetch(url, {
    headers: { "User-Agent": userAgent(), Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Nominatim ${response.status}`);
  }

  const body = (await response.json()) as {
    address?: NominatimAddress;
    display_name?: string;
    error?: string;
  };
  if (body.error) return null;

  return formatAddress(body.address ?? {}, body.display_name);
}

// ---------------------------------------------------------------------------
// Overpass — ойролцоох буудал
// ---------------------------------------------------------------------------
type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Хайлтад орох төрлүүд. `tourism` нь үндсэн шошго, `building` нь заримдаа
 * л бөглөгддөг тул хоёуланг нь хамруулна.
 */
function buildQuery(lat: number, lng: number, radiusM: number): string {
  const around = `around:${radiusM},${lat},${lng}`;
  return `[out:json][timeout:20];
(
  nwr(${around})["tourism"~"^(hotel|motel|hostel|guest_house|apartment|chalet|resort)$"];
  nwr(${around})["building"~"^(hotel|dormitory)$"];
);
out center tags;`;
}

export async function findNearbyHotels(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<OsmPoi[]> {
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "User-Agent": userAgent(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ data: buildQuery(lat, lng, radiusM) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Overpass ${response.status}`);
  }

  const body = (await response.json()) as { elements?: OverpassElement[] };

  return (body.elements ?? [])
    .map((element): OsmPoi | null => {
      const position = element.center ?? { lat: element.lat, lon: element.lon };
      const name = element.tags?.["name:mn"] ?? element.tags?.name;
      // Нэргүй объект талбарын ажилд ямар ч тус болохгүй — хаяна.
      if (!name || position.lat === undefined || position.lon === undefined) {
        return null;
      }
      return {
        osmRef: `${element.type}/${element.id}`,
        name,
        lat: position.lat,
        lng: position.lon,
        kind: element.tags?.tourism ?? element.tags?.building ?? null,
      };
    })
    .filter((poi): poi is OsmPoi => poi !== null);
}
