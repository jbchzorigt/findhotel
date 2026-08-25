/**
 * Зураг хуулах зөвшөөрөл олгоно (presigned PUT URL).
 *
 * Аюулгүй байдлын зарчмууд (§10):
 *   - Зөвхөн нэвтэрсэн алба хаагч.
 *   - **Клиентийн файлын нэрийг ХЭЗЭЭ Ч ашиглахгүй.** Түлхүүрийг сервер
 *     өөрөө үүсгэнэ — зам гарах (`../../`) болон бусдын файлыг дарах
 *     халдлагыг үндсээр нь таслана.
 *   - Төрөл болон хэмжээ нь гарын үсэгт ОРНО. Клиент өөр төрөл/хэмжээтэй
 *     илгээвэл R2 өөрөө татгалзана — зөвхөн апп дээрх шалгалтад найдахгүй.
 *   - URL 5 минут амьдарна, зөвхөн PUT, зөвхөн ЭНЭ нэг объектод.
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAudit } from "@/lib/auth/audit";
import { getClientIp, getSession } from "@/lib/auth/request";
import { checkActorRate } from "@/lib/auth/throttle";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_URL_TTL_SECONDS,
} from "@/lib/photos/constants";
import { getBucket, getR2, publicUrlFor } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60;

const RequestSchema = z.object({
  content_type: z.enum(ALLOWED_MIME_TYPES),
  content_length: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрээгүй байна." }, { status: 401 });
  }

  const parsed = RequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Зөвхөн JPEG/PNG/WebP, 10MB хүртэл зураг зөвшөөрнө.",
      },
      { status: 400 },
    );
  }

  const allowed = await checkActorRate({
    actorId: session.sub,
    action: "photo.upload_url",
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Хэт олон зураг хуулж байна. Түр хүлээнэ үү." },
      { status: 429, headers: { "Retry-After": String(RATE_WINDOW_SECONDS) } },
    );
  }

  const { content_type: contentType, content_length: contentLength } =
    parsed.data;

  // Түлхүүр нь бүхэлдээ серверийн бүтээгдэхүүн. Огноогоор бүлэглэсэн нь
  // хожим цэвэрлэх/шилжүүлэхэд хялбар болгоно.
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const key = `photos/${yyyy}/${mm}/${crypto.randomUUID()}.${EXTENSION[contentType]}`;

  const uploadUrl = await getSignedUrl(
    getR2(),
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      /*
       * ЗААВАЛ: AWS SDK нь анхны байдлаараа зөвхөн `host`-ыг гарын үсэгт
       * оруулдаг. Үүнгүйгээр jpeg гэж зөвшөөрөл авсан клиент `text/html`
       * агуулга PUT хийж чадна — зураг нь нийтэд нээлттэй URL-тэй тул
       * тэр нь хадгалагдсан XSS болж хувирна.
       */
      signableHeaders: new Set(["content-type", "content-length"]),
    },
  );

  await writeAudit({
    actorId: session.sub,
    action: "photo.upload_url",
    ip: await getClientIp(),
    detail: { key, contentType, contentLength },
  });

  return NextResponse.json({
    upload_url: uploadUrl,
    r2_key: key,
    public_url: publicUrlFor(key),
    expires_in: UPLOAD_URL_TTL_SECONDS,
  });
}
