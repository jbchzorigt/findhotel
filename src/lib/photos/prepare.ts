/**
 * Зургийг хуулахад бэлтгэх — ЗӨВХӨН браузерт ажиллана.
 *
 * Дараалал нь чухал:
 *   1. EXIF-ийг ЭХЛЭЭД уншина (шахалт үүнийг устгана)
 *   2. Дараа нь шахна — 4MB зураг ~400KB болно
 *   3. Эцэст нь sha256 бодно (шахсаны дараах агуулгаар)
 *
 * Шахалт бол гоёл биш: 5,000 буудал × 2 зураг × 4MB = 40 GB болж R2-ийн
 * 10 GB үнэгүй багтаамжаас хальна. Шахвал ~4 GB (§9).
 */
import imageCompression from "browser-image-compression";

import {
  COMPRESS_MAX_DIMENSION,
  COMPRESS_QUALITY,
  COMPRESS_TARGET_BYTES,
  MAX_UPLOAD_BYTES,
  isAllowedMimeType,
} from "./constants";
import { readPhotoExif, type PhotoExif } from "./exif";

export type PreparedPhoto = {
  /** Хуулах ёстой файл — шахсан, EXIF нь арилсан. */
  blob: Blob;
  contentType: string;
  bytes: number;
  width: number;
  height: number;
  sha256: string;
  /** ЭХ зургаас уншсан EXIF — шахсан хувилбарт байхгүй. */
  exif: PhotoExif;
};

async function measure(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Зургийг уншиж чадсангүй."));
      image.src = url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  // 1. EXIF — заавал шахахаас өмнө.
  const exif = await readPhotoExif(file);

  // 2. Шахалт. `browser-image-compression` нь canvas дээр дахин зурдаг тул
  //    EXIF энд бүрэн устана — нууцлалын шаардлага автоматаар биелнэ.
  const compressed = await imageCompression(file, {
    maxSizeMB: COMPRESS_TARGET_BYTES / (1024 * 1024),
    maxWidthOrHeight: COMPRESS_MAX_DIMENSION,
    initialQuality: COMPRESS_QUALITY,
    useWebWorker: true,
    fileType: "image/jpeg",
  });

  if (compressed.size > MAX_UPLOAD_BYTES) {
    throw new Error("Зураг хэт том байна. Дахин оролдоно уу.");
  }
  const contentType = compressed.type || "image/jpeg";
  if (!isAllowedMimeType(contentType)) {
    throw new Error(`Дэмжигдэхгүй зургийн төрөл: ${contentType}`);
  }

  const [{ width, height }, sha256] = await Promise.all([
    measure(compressed),
    sha256Hex(compressed),
  ]);

  return {
    blob: compressed,
    contentType,
    bytes: compressed.size,
    width,
    height,
    sha256,
    exif,
  };
}

/**
 * Бэлтгэсэн зургийг R2 руу шууд хуулна.
 *
 * Сервер дундуур явахгүй — Vercel-ийн 4.5MB хязгаарыг тойрох гол шалтгаан.
 */
export async function uploadPhoto(
  prepared: PreparedPhoto,
): Promise<{ r2Key: string; publicUrl: string }> {
  const grant = await fetch("/api/photos/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content_type: prepared.contentType,
      content_length: prepared.bytes,
    }),
  });
  if (!grant.ok) {
    const body = await grant.json().catch(() => ({}));
    throw new Error(body.error ?? "Зураг хуулах зөвшөөрөл авч чадсангүй.");
  }
  const { upload_url: uploadUrl, r2_key: r2Key, public_url: publicUrl } =
    await grant.json();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": prepared.contentType },
    body: prepared.blob,
  });
  if (!put.ok) {
    throw new Error(`Зураг хуулахад алдаа гарлаа (${put.status}).`);
  }

  return { r2Key, publicUrl };
}
