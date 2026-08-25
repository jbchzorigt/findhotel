/**
 * Neon Postgres холболт (HTTP драйвер).
 *
 * Яагаад залхуу (lazy) вэ: `next build` нь орчны хувьсагчгүйгээр ажилладаг —
 * модуль ачаалагдах агшинд `POSTGRES_URL` шаардвал CI/build дээр унана.
 * Тиймээс холболтыг анх хэрэглэх мөчид нь үүсгэнэ.
 *
 * Яагаад HTTP драйвер вэ: serverless функц бүр богино насалдаг тул TCP
 * холболтын сан барих утгагүй. Neon-ий HTTP драйвер нь query бүрийг тусдаа
 * хүсэлтээр явуулдаг — pooling-ийн толгойны өвчин байхгүй.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "POSTGRES_URL тохируулагдаагүй байна. .env.local файлаа шалгана уу " +
        "(.env.example-ийг харна уу).",
    );
  }
  return drizzle(neon(url), { schema });
}

let cached: Database | undefined;

/** Холболт бэлэн эсэхийг урьдчилан шалгах — `getDb()` дуудахгүйгээр. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL);
}

export function getDb(): Database {
  cached ??= createDb();
  return cached;
}

export { schema };
