/**
 * Нэвтрэлтийн хязгаарлалт — brute force-оос хамгаална.
 *
 * Яагаад санах ойд биш, DB дээр вэ: serverless функц бүр өөрийн процесстой
 * тул санах ойн тоолуур утгагүй (халуун функц бүр 5 оролдлого зөвшөөрнө).
 * Postgres аль хэдийн байгаа тул нэмэлт үйлчилгээ (Redis) шаардахгүйгээр
 * зөв ажиллана — "төлбөргүй" гэсэн хязгаарлалттай ч нийцнэ.
 *
 * Хоёр давхар:
 *   - IP-ээр:    1 минутад 5 бүтэлгүй оролдлого   (§10)
 *   - badge-ээр: 5 минутад 10 бүтэлгүй оролдлого  (олон IP-ээс нэг
 *                данс онилохоос хамгаална — IP-ийн хязгаар үүнийг барихгүй)
 */
import { sql } from "drizzle-orm";

import { getDb } from "@/db";

export const IP_LIMIT = 5;
export const BADGE_LIMIT = 10;

export type ThrottleVerdict =
  | { blocked: false }
  | { blocked: true; reason: "ip" | "badge"; retryAfterSeconds: number };

export async function checkLoginThrottle(
  ip: string | null,
  badgeNumber: string,
): Promise<ThrottleVerdict> {
  const rows = await getDb().execute<{
    ip_recent: number;
    badge_recent: number;
  }>(sql`
    select
      count(*) filter (
        where ip = ${ip} and created_at > now() - interval '1 minute'
      )::int as ip_recent,
      count(*) filter (
        where detail->>'badge' = ${badgeNumber}
      )::int as badge_recent
    from audit_log
    where action = 'auth.login.failed'
      and created_at > now() - interval '5 minutes'
  `);

  const row = rows.rows?.[0] ?? { ip_recent: 0, badge_recent: 0 };

  if (ip && row.ip_recent >= IP_LIMIT) {
    return { blocked: true, reason: "ip", retryAfterSeconds: 60 };
  }
  if (row.badge_recent >= BADGE_LIMIT) {
    return { blocked: true, reason: "badge", retryAfterSeconds: 300 };
  }
  return { blocked: false };
}

/**
 * Ерөнхий хязгаарлалт: нэг хэрэглэгч, нэг төрлийн үйлдлийг цонхонд хэдэн
 * удаа хийснийг тоолно.
 *
 * Нэвтрэлтийн хязгаартай ижил шалтгаанаар DB дээр — serverless дээр санах
 * ойн тоолуур утгагүй. `audit_log` нь энэ үйлдлүүдийг аль хэдийн бичдэг тул
 * нэмэлт хүснэгт шаардахгүй.
 */
export async function checkActorRate(options: {
  actorId: string;
  action: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  const rows = await getDb().execute<{ recent: number }>(sql`
    select count(*)::int as recent
    from audit_log
    where actor_id = ${options.actorId}
      and action = ${options.action}
      and created_at > now() - make_interval(secs => ${options.windowSeconds})
  `);
  const recent = rows.rows?.[0]?.recent ?? 0;
  return recent < options.limit;
}
