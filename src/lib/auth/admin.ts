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
