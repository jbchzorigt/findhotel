/**
 * Cloudflare R2 — зургийн хадгалалт.
 *
 * R2 нь S3-нийцтэй тул стандарт AWS SDK ашиглана. Локал хөгжүүлэлтэд
 * `R2_ENDPOINT`-ийг MinIO руу чиглүүлж яг ижил кодоор турших боломжтой.
 *
 * Яагаад presigned URL вэ: Vercel-ийн serverless функц хүсэлтийн биед 4.5MB
 * хязгаартай. Зургийг сервер дундуур дамжуулбал том зураг тэр хязгаарт тулна.
 * Presigned URL нь клиентийг ШУУД хадгалах сан руу илгээх боломж олгоно —
 * функц зөвхөн зөвшөөрөл олгож, өгөгдөл өөрөө дамжуулахгүй.
 */
import { S3Client } from "@aws-sdk/client-s3";

let cached: S3Client | undefined;

export function getR2(): S3Client {
  if (cached) return cached;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 тохируулагдаагүй байна: R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY " +
        "(.env.example-ийг харна уу).",
    );
  }

  // Локал турших үед MinIO гэх мэт S3-нийцтэй сервер рүү чиглүүлнэ.
  const endpoint =
    process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;

  cached = new S3Client({
    region: "auto", // R2 бүсгүй — үргэлж "auto"
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // MinIO нь дэд домэйн хэлбэрийн bucket хаягийг локал дээр дэмждэггүй.
    forcePathStyle: Boolean(process.env.R2_ENDPOINT),
  });
  return cached;
}

export function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET тохируулагдаагүй байна.");
  return bucket;
}

/** Зураг нийтэд харагдах хаяг. */
export function publicUrlFor(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) throw new Error("R2_PUBLIC_BASE_URL тохируулагдаагүй байна.");
  return `${base.replace(/\/+$/, "")}/${key}`;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL,
  );
}
