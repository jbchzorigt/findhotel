/**
 * Хүсэлтээс нэвтрэлт болон гарал үүслийг унших туслахууд.
 */
import { cookies, headers } from "next/headers";

import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionClaims,
} from "./session";

/**
 * Cookie-гоос сешнийг уншиж шалгана.
 *
 * `proxy.ts` аль хэдийн шалгасан байсан ч route бүр ДАХИН шалгана. Учир нь
 * proxy нь таних тэмдгийг header-ээр дамжуулбал клиент тэр header-ийг өөрөө
 * хуурамчаар илгээж чадна. Cookie-гоос гарын үсэг шалгах нь цорын ганц
 * найдвартай эх сурвалж. Proxy бол зөвхөн хурдан хаалт.
 */
export async function getSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

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
