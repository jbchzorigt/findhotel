/**
 * [📍] товч — координатаас хаяг болон ойролцоох буудлыг олно.
 *
 * Бүх гадаад дуудлага ЭНД төвлөрнө. Клиент нь Nominatim/Overpass руу шууд
 * хандахгүй: тэгвэл хэрэглэгч бүрийн IP-ээс дуудлага явж, "секундэд 1"
 * дүрмийг барих боломжгүй болно (§13.3). Сервер дундуур явуулснаар нэг
 * цэгээс цэгцлэх, кэшлэх, хязгаарлах боломжтой.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAudit } from "@/lib/auth/audit";
import { getSession } from "@/lib/auth/request";
import { checkActorRate } from "@/lib/auth/throttle";
import { lookupLocation } from "@/lib/geo/lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** §10: хэрэглэгчид цагт 60 — гадаад үйлчилгээг хамгаална. */
const RATE_LIMIT = 60;
const RATE_WINDOW_SECONDS = 3_600;

const RequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
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
    return NextResponse.json({ error: "Байршил буруу байна." }, { status: 400 });
  }

  const allowed = await checkActorRate({
    actorId: session.sub,
    action: "geo.lookup",
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Байршлын хайлт хэт олон удаа хийгдлээ. Түр хүлээнэ үү." },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }

  const { lat, lng } = parsed.data;

  try {
    const result = await lookupLocation(lat, lng);

    // Кэшнээс уншсан бол гадаад дуудлага яваагүй — хязгаарын тоололд
    // оруулахгүй нь шударга.
    if (!result.cached) {
      await writeAudit({
        actorId: session.sub,
        action: "geo.lookup",
        detail: { lat, lng, found: result.nearby.length },
      });
    }

    return NextResponse.json({
      address_text: result.addressText,
      nearby: result.nearby.map((item) => ({
        source: item.source,
        name: item.name,
        lat: item.lat,
        lng: item.lng,
        distance_m: item.distanceM,
        osm_ref: item.osmRef,
        already_registered: item.alreadyRegistered,
        kind: item.kind,
      })),
      degraded: result.degraded,
      attribution: "© OpenStreetMap contributors",
    });
  } catch (cause) {
    console.error("[geo/lookup]", cause);
    // Хайлт бүтэлгүйтсэн нь бүртгэл хийхэд саад болох ёсгүй — алба хаагч
    // гараар бичээд үргэлжлүүлж чадна.
    return NextResponse.json({
      address_text: null,
      nearby: [],
      degraded: true,
      attribution: "© OpenStreetMap contributors",
    });
  }
}
