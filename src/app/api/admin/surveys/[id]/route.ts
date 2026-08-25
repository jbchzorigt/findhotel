/**
 * Админ — алдаатай бүртгэлийг устгах / сэргээх.
 *
 * ЗӨӨЛӨН устгалт (`status = 'DELETED'`): мөр өөрөө үлдэнэ.
 *
 * Яагаад бүрмөсөн устгахгүй вэ: энэ бол албан ёсны бүртгэлийн систем.
 * "Хэн юуг устгасан" гэдэг нь хожим асуудал болж мэднэ. Мөн андуурч
 * устгасныг сэргээх боломжтой байх ёстой. Устгасан мөр нь давхардлын
 * шалгалт, жагсаалт, экспорт бүрээс хасагдана — практик талаасаа устсантай
 * ижил, гэхдээ ул мөр үлдэнэ.
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { hotelSurveys } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";
import { writeAudit } from "@/lib/auth/audit";
import { getClientIp } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  status: z.enum(["DELETED", "SUBMITTED"]),
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }

  const [updated] = await getDb()
    .update(hotelSurveys)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(hotelSurveys.id, id))
    .returning({ id: hotelSurveys.id, name: hotelSurveys.name });

  if (!updated) {
    return NextResponse.json({ error: "Бүртгэл олдсонгүй." }, { status: 404 });
  }

  await writeAudit({
    actorId: guard.session.sub,
    action:
      parsed.data.status === "DELETED" ? "survey.deleted" : "survey.restored",
    subjectId: id,
    ip: await getClientIp(),
    detail: { name: updated.name, reason: parsed.data.reason ?? null },
  });

  return NextResponse.json({ id: updated.id, status: parsed.data.status });
}
