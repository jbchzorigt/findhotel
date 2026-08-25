/**
 * Аудит лог — хэн, хэзээ, юу хийсэн.
 *
 * Нэвтрэлтийн оролдлогын лог нь §10-ийн шаардлага байхаас гадна нэвтрэлтийн
 * хязгаарлалтын (throttle) эх өгөгдөл болдог — тусад нь тоолуур барих
 * шаардлагагүй.
 */
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditAction =
  | "auth.login.ok"
  | "auth.login.failed"
  | "auth.logout"
  | "surveyor.created"
  | "surveyor.password_reset"
  | "photo.upload_url";

export async function writeAudit(entry: {
  actorId?: string | null;
  action: AuditAction;
  subjectId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getDb().insert(auditLogs).values({
      actorId: entry.actorId ?? null,
      action: entry.action,
      subjectId: entry.subjectId ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      detail: entry.detail ?? null,
    });
  } catch (cause) {
    // Аудит бичих нь бүтэлгүйтсэн ч үндсэн үйлдлийг унагаахгүй — гэхдээ
    // чимээгүй нурааж болохгүй тул серверийн лог руу бичнэ.
    console.error("[audit] бичиж чадсангүй:", entry.action, cause);
  }
}
