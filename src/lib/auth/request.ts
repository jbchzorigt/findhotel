/**
 * Хүсэлтээс нэвтрэлт болон гарал үүслийг унших туслахууд.
 */
import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { getDb } from "@/db";
import { surveyors } from "@/db/schema";

import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionClaims,
} from "./session";

/**
 * Cookie-гоос сешнийг уншиж, өгөгдлийн сангаас БАТАЛГААЖУУЛНА.
 *
 * Токен дангаараа хангалтгүй. Токен 12 цаг амьдардаг тул зөвхөн гарын
 * үсгийг шалгавал идэвхгүй болгосон эсвэл устгасан алба хаагч тэр
 * хугацаанд бүх эрхээ хадгална — админы эрх ч мөн адил. Тэгвэл
 * "идэвхгүй болгох" үйлдэл нь шууд биш, хойшлуулсан үйлдэл болж хувирна.
 *
 * Мөн ЭРХИЙГ ч DB-ээс авна: админ эрхээ хасуулсан хүн токендээ хуучин
 * эрхээ үүрсээр байх ёсгүй.
 *
 * `cache()` нь нэг хүсэлтийн дотор давтан дуудахад ганцхан удаа л DB рүү
 * очихыг баталгаажуулна (layout + page + route хамт дуудах нь элбэг).
 *
 * `proxy.ts` нь Edge дээр ажилладаг тул үүнийг ашиглахгүй — тэнд зөвхөн
 * гарын үсгийн шалгалт явна. Тэр нь хурдан хаалт, энэ нь үнэн.
 */
export const getSession = cache(async (): Promise<SessionClaims | null> => {
  const jar = await cookies();
  const claims = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const [surveyor] = await getDb()
    .select({
      id: surveyors.id,
      badgeNumber: surveyors.badgeNumber,
      role: surveyors.role,
    })
    .from(surveyors)
    .where(and(eq(surveyors.id, claims.sub), eq(surveyors.isActive, true)))
    .limit(1);

  if (!surveyor) return null;

  return {
    sub: surveyor.id,
    badge: surveyor.badgeNumber,
    // Токенд бичигдсэн эрх биш, ОДООГИЙН эрх.
    role: surveyor.role,
  };
});

/** Хүсэлт ирсэн IP — Vercel-ийн proxy `x-forwarded-for` тавьдаг. */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    // Эхний утга нь жинхэнэ клиент; хойшхи нь proxy-нуудынх.
    return forwarded.split(",")[0]!.trim().slice(0, 64) || null;
  }
  return h.get("x-real-ip")?.slice(0, 64) ?? null;
}

export async function getUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent")?.slice(0, 512) ?? null;
}
