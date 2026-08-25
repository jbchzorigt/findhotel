/**
 * Гадаад газарзүйн үйлчилгээний дуудлагыг цэгцлэх.
 *
 * Nominatim: секундэд 1 дуудлага (хэрэглээний нөхцөл).
 * Overpass:  илүү өгөөмөр ч ачаалахгүй байхыг хүсдэг.
 *
 * `reserveSlot` нь НЭГ атомик UPDATE-ээр дараагийн зөвшөөрөгдөх агшныг
 * захиална:
 *
 *   last_called_at = greatest(now(), last_called_at + interval)
 *
 * Зэрэг ирсэн хүсэлтүүд 1 секундын зайтай дараалсан слот авна — түгжээ ч,
 * интерактив гүйлгээ ч хэрэггүй (neon-ийн HTTP драйвер тэднийг дэмждэггүй).
 */
import { sql } from "drizzle-orm";

import { getDb } from "@/db";

/** Слот хэт хол ирвэл хүлээхгүй — хэрэглэгчийг мөнхөд эргүүлэхээс дээр. */
const MAX_WAIT_MS = 3_000;

export type SlotResult =
  | { granted: true; waitMs: number }
  | { granted: false; waitMs: number };

export async function reserveSlot(
  service: "nominatim" | "overpass",
  minIntervalMs: number,
): Promise<SlotResult> {
  const rows = await getDb().execute<{ allowed_at: string }>(sql`
    insert into geo_rate_gate (service, last_called_at)
    values (${service}, now())
    on conflict (service) do update
      set last_called_at = greatest(
        now(),
        geo_rate_gate.last_called_at
          + make_interval(secs => ${minIntervalMs / 1000})
      )
    returning last_called_at as allowed_at
  `);

  const allowedAt = rows.rows?.[0]?.allowed_at;
  if (!allowedAt) return { granted: true, waitMs: 0 };

  const waitMs = new Date(allowedAt).getTime() - Date.now();
  if (waitMs <= 0) return { granted: true, waitMs: 0 };
  if (waitMs > MAX_WAIT_MS) return { granted: false, waitMs };

  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return { granted: true, waitMs };
}
