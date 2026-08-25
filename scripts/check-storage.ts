/**
 * Зургийн хадгалалт бодитоор ажиллаж байгааг батлах.
 *
 * Тохиргоог "бөглөсөн эсэх"-ээр биш, БОДИТ үйлдлээр шалгана: түр файл
 * хуулж, нийтэд уншиж, буцаад устгана. Алдаатай эрх, буруу bucket, public
 * хандалт нээгээгүй байдал — бүгд энд илэрнэ, талбарын ажлын дундуур биш.
 *
 * Нууц түлхүүрийг хэвлэхгүй.
 */
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

import { getBucket, getR2, publicUrlFor } from "@/lib/storage/r2";

/**
 * Нууц утгыг БҮРЭН далдална — зөвхөн урт нь харагдана.
 *
 * Энэ скриптийн гаралтыг хүмүүс дэмжлэг хүсэхдээ хуулж тавьдаг. Түлхүүрийн
 * эхний хэдэн тэмдэгт ч гэсэн тэр замаар гадагш гарах ёсгүй. Урт нь
 * "буруу зүйл буулгасан уу" гэдгийг шалгахад хангалттай.
 */
function mask(value: string | undefined): string {
  if (!value) return "(тавигдаагүй)";
  return `•••••••• (${value.length} тэмдэгт)`;
}

async function main(): Promise<void> {
  const isLocal = Boolean(process.env.R2_ENDPOINT);

  console.log("Тохиргоо");
  console.log("  горим              :", isLocal ? "ЛОКАЛ (MinIO)" : "БОДИТ R2");
  if (isLocal) console.log("  R2_ENDPOINT        :", process.env.R2_ENDPOINT);
  console.log("  R2_ACCOUNT_ID      :", mask(process.env.R2_ACCOUNT_ID));
  console.log("  R2_ACCESS_KEY_ID   :", mask(process.env.R2_ACCESS_KEY_ID));
  console.log("  R2_SECRET_ACCESS_KEY:", mask(process.env.R2_SECRET_ACCESS_KEY));
  console.log("  R2_BUCKET          :", process.env.R2_BUCKET ?? "(тавигдаагүй)");
  console.log("  R2_PUBLIC_BASE_URL :", process.env.R2_PUBLIC_BASE_URL ?? "(тавигдаагүй)");

  if (isLocal) {
    console.log(
      "\n⚠ R2_ENDPOINT тавигдсан байна — апп локал MinIO руу хандана.\n" +
        "  Бодит R2-г шалгах бол тэр мөрийг тайлбар болгоно уу.",
    );
  }

  const s3 = getR2();
  const Bucket = getBucket();
  const key = `healthcheck/${crypto.randomUUID()}.txt`;
  const body = `hotel-field-survey storage check`;

  console.log("\nШалгалт");

  // 1. Бичих
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket,
        Key: key,
        Body: body,
        ContentType: "text/plain",
      }),
    );
    console.log("  ✓ бичих эрх");
  } catch (error) {
    const name = error instanceof S3ServiceException ? error.name : "Unknown";
    console.error(`  ❌ бичиж чадсангүй (${name})`);
    if (name === "NoSuchBucket") console.error("     → bucket-ийн нэр буруу байна");
    if (name === "InvalidAccessKeyId" || name === "SignatureDoesNotMatch")
      console.error("     → Access Key / Secret буруу байна");
    process.exit(1);
  }

  // 2. Нийтэд унших — presigned URL-гүйгээр, зүгээр л хаягаар
  const url = publicUrlFor(key);
  try {
    const response = await fetch(url);
    if (response.ok && (await response.text()) === body) {
      console.log("  ✓ нийтэд унших (public access нээлттэй)");
    } else {
      console.error(`  ❌ нийтэд уншиж чадсангүй — HTTP ${response.status}`);
      console.error("     → Bucket → Settings → Public access-ийг нээнэ үү");
      console.error("     → эсвэл R2_PUBLIC_BASE_URL буруу байна");
      process.exit(1);
    }
  } catch {
    console.error("  ❌ нийтийн хаяг руу холбогдож чадсангүй:", url);
    process.exit(1);
  }

  /*
   * 3. CORS — браузерын preflight-ыг дуурайлгана.
   *
   * Энэ шалгалт байгаагийн шалтгаан: локал MinIO нь CORS-ыг анхныхаараа
   * нээлттэй байлгадаг тул зөрүү нь зөвхөн бодит R2 дээр илэрдэг. Тохиргоог
   * уншихад bucket-ийн admin эрх хэрэгтэй ч preflight илгээхэд эрх
   * шаардлагагүй — тиймээс энэ нь ажиллах баталгаатай арга.
   */
  const probeUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket,
      Key: "cors-probe/probe.jpg",
      ContentType: "image/jpeg",
      ContentLength: 1,
    }),
    { expiresIn: 60, signableHeaders: new Set(["content-type", "content-length"]) },
  );

  const origin = process.env.APP_ORIGIN ?? "http://localhost:3100";
  const preflight = await fetch(probeUrl, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  }).catch(() => null);

  if (preflight?.headers.get("access-control-allow-origin")) {
    console.log(`  ✓ CORS (${origin} → PUT зөвшөөрөгдсөн)`);
  } else if (isLocal) {
    console.log("  • CORS шалгалт алгасав (MinIO анхныхаараа нээлттэй)");
  } else {
    console.error(`  ❌ CORS: ${origin} гарал үүслээс PUT хийх боломжгүй`);
    console.error("     → Bucket → Settings → CORS Policy дээр дараахыг нэмнэ үү:");
    console.error(`     [{"AllowedOrigins":["${origin}"],"AllowedMethods":["PUT","GET"],`);
    console.error('      "AllowedHeaders":["content-type"],"MaxAgeSeconds":3600}]');
    console.error("     (Энэ дүрэмгүйгээр браузер зураг хуулах хүсэлтийг хаана.)");
    process.exit(1);
  }

  // 4. Цэвэрлэх
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
  console.log("  ✓ устгах эрх (шалгалтын файл цэвэрлэгдлээ)");

  console.log("\n✓ Хадгалалт бэлэн.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
