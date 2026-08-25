/**
 * Локал MinIO дээр bucket үүсгэж, нийтэд унших бодлого тавина.
 *
 * ЗӨВХӨН локал хөгжүүлэлтэд. Бодит R2 дээр bucket болон public хандалтыг
 * Cloudflare-ийн самбараас тохируулна — энэ скрипт `R2_ENDPOINT` заагаагүй
 * бол зориуд татгалзана.
 */
import {
  CreateBucketCommand,
  PutBucketPolicyCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

import { getBucket, getR2 } from "@/lib/storage/r2";

async function main(): Promise<void> {
  if (!process.env.R2_ENDPOINT) {
    throw new Error(
      "R2_ENDPOINT заагаагүй байна. Энэ скрипт зөвхөн локал MinIO-д зориулагдсан —\n" +
        "бодит R2 дээр bucket-ээ Cloudflare самбараас үүсгэнэ үү.",
    );
  }

  const s3 = getR2();
  const Bucket = getBucket();

  try {
    await s3.send(new CreateBucketCommand({ Bucket }));
    console.log(`✓ bucket үүслээ: ${Bucket}`);
  } catch (error) {
    if (
      error instanceof S3ServiceException &&
      (error.name === "BucketAlreadyOwnedByYou" ||
        error.name === "BucketAlreadyExists")
    ) {
      console.log(`• bucket аль хэдийн байна: ${Bucket}`);
    } else {
      throw error;
    }
  }

  // R2-ийн нийтэд нээлттэй bucket-ийг дуурайна.
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${Bucket}/*`],
          },
        ],
      }),
    }),
  );
  console.log("✓ нийтэд унших бодлого тавигдлаа");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
