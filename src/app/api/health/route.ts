/**
 * Deploy амьд эсэхийг шалгах цэг.
 *
 * Өгөгдлийн сантай холбогдож чадаж байгаа эсэхийг ҮНЭХЭЭР шалгана — зөвхөн
 * "процесс ажиллаж байна" гэж хэлэх нь Phase 0-д хангалтгүй: Neon-ий холболт
 * буруу байвал энд илрэх ёстой, эхний бүртгэл алдагдах үед биш.
 *
 * DB тохируулаагүй байхад ч 200 буцаана (`db: "not_configured"`) — эхний
 * deploy нь `POSTGRES_URL`-гүйгээр амжилттай гарах боломжтой байх ёстой.
 */
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb, isDatabaseConfigured } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbState = "up" | "down" | "not_configured";

export async function GET() {
  const startedAt = Date.now();
  let db: DbState = "not_configured";
  let error: string | undefined;

  if (isDatabaseConfigured()) {
    try {
      await getDb().execute(sql`select 1`);
      db = "up";
    } catch (cause) {
      db = "down";
      // Холболтын мөр нууц үг агуулдаг тул хэзээ ч буцаахгүй — зөвхөн төрөл.
      error = cause instanceof Error ? cause.name : "UnknownError";
    }
  }

  return NextResponse.json(
    {
      ok: db !== "down",
      db,
      ...(error ? { error } : {}),
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    },
    { status: db === "down" ? 503 : 200 },
  );
}
