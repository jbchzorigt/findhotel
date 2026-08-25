/**
 * ADMIN эрхийн шалгалт.
 *
 * `proxy.ts` нь /api/admin/* замыг аль хэдийн хамгаалдаг ч route бүр ДАХИН
 * шалгана. Шалтгаан нь proxy-ийн `matcher`-ийг хэн нэгэн ирээдүйд өөрчилвөл
 * эрхийн нүх чимээгүй нээгдэхээс сэргийлэх — хамгаалалт нэг л газар байвал
 * тэр газар мартагдахад бүх зүйл нээгдэнэ.
 */
import { getSession } from "./request";
import type { SessionClaims } from "./session";

export type AdminGuard =
  | { ok: true; session: SessionClaims }
  | { ok: false; status: 401 | 403; error: string };

export async function requireAdmin(): Promise<AdminGuard> {
  const session = await getSession();
  if (!session) {
    return { ok: false, status: 401, error: "Нэвтрээгүй байна." };
  }
  if (session.role !== "ADMIN") {
    return { ok: false, status: 403, error: "Эрх хүрэхгүй." };
  }
  return { ok: true, session };
}

/**
 * Түр нууц үг үүсгэх.
 *
 * Админ өөрөө нууц үг сонговол богино, таамаглахад хялбар үг сонгох магадлал
 * өндөр. Систем үүсгэсэн санамсаргүй үг нь тэрийг хаана — админ түүнийг
 * алба хаагчид дамжуулж, эхний нэвтрэлтийн дараа солиулна.
 *
 * Андуурч уншихад хялбар тэмдэгт (0/O, 1/l/I) хассан: энэ нь ярианаар эсвэл
 * цаасан дээр дамжуулагддаг.
 */
export function generateTemporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
