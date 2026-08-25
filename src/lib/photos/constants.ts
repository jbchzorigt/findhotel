/**
 * Зурагтай холбоотой хязгаарууд — сервер, клиент хоёрт НЭГ эх сурвалж.
 *
 * Хоёр талд тусад нь бичвэл хэзээ нэгэн цагт салж, клиент зөвшөөрсөн зургийг
 * сервер татгалзах (эсвэл эсрэгээр) байдал үүснэ.
 */

/** Зөвшөөрөгдөх төрлүүд. HEIC байхгүй: браузер шахахдаа JPEG болгодог. */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Хуулах зөвшөөрөгдөх дээд хэмжээ (10MB) — ШАХСАНЫ дараах хэмжээнд хамаарна.
 * Шахалт хэвийн ажиллавал ~400KB болох ёстой; 10MB бол зөвхөн хамгаалалт.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Нэг бүртгэлд зөвшөөрөх зургийн тоо (§3). */
export const MIN_PHOTOS = 1;
export const MAX_PHOTOS = 5;

/** Клиент дээрх шахалтын тохиргоо — §9-ийн зардлын тооцоо үүнээс хамаарна. */
export const COMPRESS_MAX_DIMENSION = 1600;
export const COMPRESS_QUALITY = 0.8;
/** Шахалтын зорилтот хэмжээ — R2-ийн 10 GB үнэгүй багтаамжид багтахын тулд. */
export const COMPRESS_TARGET_BYTES = 600 * 1024;

/** Presigned URL-ийн хүчинтэй хугацаа (§10). */
export const UPLOAD_URL_TTL_SECONDS = 5 * 60;

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}
