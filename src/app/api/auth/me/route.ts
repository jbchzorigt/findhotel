/**
 * Одоогийн нэвтэрсэн алба хаагчийн мэдээлэл.
 *
 * `getSession()` нь DB-ээс баталгаажуулдаг тул идэвхгүй болсон хүн энд
 * хүрэхгүй. Энэ route нь нэмэлт талбаруудыг (нэр, хэлтэс) л уншина.
 */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { surveyors } from "@/db/schema";
import { getSession } from "@/lib/auth/request";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрээгүй байна." }, { status: 401 });
  }

  const [surveyor] = await getDb()
    .select({
      id: surveyors.id,
      badgeNumber: surveyors.badgeNumber,
      fullName: surveyors.fullName,
      unit: surveyors.unit,
      role: surveyors.role,
    })
    .from(surveyors)
    .where(and(eq(surveyors.id, session.sub), eq(surveyors.isActive, true)))
    .limit(1);

  if (!surveyor) {
    // Данс устсан эсвэл идэвхгүй болсон — cookie-г нь цэвэрлэж явуулна.
    const response = NextResponse.json(
      { error: "Данс идэвхгүй байна." },
      { status: 401 },
    );
    response.cookies.set(SESSION_COOKIE, "", {
      ...sessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  }

  return NextResponse.json({
    id: surveyor.id,
    badge_number: surveyor.badgeNumber,
    full_name: surveyor.fullName,
    unit: surveyor.unit,
    role: surveyor.role,
  });
}
