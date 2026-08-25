/**
 * Нэвтрэлт — badge дугаар + нууц үг.
 *
 * Аюулгүй байдлын зарчмууд:
 *   - "Badge олдсонгүй" ба "нууц үг буруу" хоёрыг ЯЛГАЖ хэлэхгүй. Аль нь ч
 *     ижил мессеж, ижил хугацаа (`DUMMY_HASH`) буцаана.
 *   - Идэвхгүй болгосон алба хаагч ч ижил ерөнхий алдаа авна — данс байгаа
 *     эсэхийг мэдэх боломжгүй.
 *   - Бүтэлгүй оролдлого бүр аудитад бичигдэж, throttle-ийн үндэс болно.
 */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { surveyors } from "@/db/schema";
import { writeAudit } from "@/lib/auth/audit";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { getClientIp, getUserAgent } from "@/lib/auth/request";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { checkLoginThrottle } from "@/lib/auth/throttle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  badge_number: z.string().trim().min(2).max(32),
  password: z.string().min(8).max(64),
});

/** Хэрэглэгчид харагдах ганц мессеж — ямар шалтгаанаар бүтэлгүйтснийг задлахгүй. */
const GENERIC_ERROR = "Badge дугаар эсвэл нууц үг буруу байна.";

export async function POST(request: Request) {
  const ip = await getClientIp();
  const userAgent = await getUserAgent();

  const parsed = LoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const { badge_number: badgeNumber, password } = parsed.data;

  const throttle = await checkLoginThrottle(ip, badgeNumber);
  if (throttle.blocked) {
    return NextResponse.json(
      {
        error:
          "Хэт олон удаа буруу оролдлоо. Түр хүлээгээд дахин оролдоно уу.",
        retryAfterSeconds: throttle.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(throttle.retryAfterSeconds) },
      },
    );
  }

  const [surveyor] = await getDb()
    .select()
    .from(surveyors)
    .where(and(eq(surveyors.badgeNumber, badgeNumber), eq(surveyors.isActive, true)))
    .limit(1);

  // Данс олдоогүй ч bcrypt-ийг ЯГ адил ажиллуулна — цагийн зөрүү үүсгэхгүй.
  const ok = await verifyPassword(
    password,
    surveyor?.passwordHash ?? getDummyHash(),
  );

  if (!surveyor || !ok) {
    await writeAudit({
      action: "auth.login.failed",
      subjectId: surveyor?.id ?? null,
      ip,
      userAgent,
      detail: { badge: badgeNumber },
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const token = await createSessionToken({
    sub: surveyor.id,
    badge: surveyor.badgeNumber,
    role: surveyor.role,
  });

  await writeAudit({
    actorId: surveyor.id,
    action: "auth.login.ok",
    subjectId: surveyor.id,
    ip,
    userAgent,
    detail: { badge: surveyor.badgeNumber },
  });

  const response = NextResponse.json({
    id: surveyor.id,
    badge_number: surveyor.badgeNumber,
    full_name: surveyor.fullName,
    role: surveyor.role,
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
