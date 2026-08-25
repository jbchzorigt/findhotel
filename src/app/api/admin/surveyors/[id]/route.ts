/**
 * Админ — алба хаагчийн эрх нээх/хаах, нууц үг сэргээх.
 *
 * Устгах үйлдэл ЗОРИУД байхгүй: алба хаагчийн мөр нь бүртгэл бүрийн эзнийг
 * заадаг (`hotel_survey.surveyor_id`). Устгавал түүхэн бүртгэл эзэнгүй
 * болно. Идэвхгүй болгох нь нэвтрэлтийг таслаад түүхийг хадгална.
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { surveyors } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";
import { writeAudit } from "@/lib/auth/audit";
import { hashPassword } from "@/lib/auth/password";
import { getClientIp } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  is_active: z.boolean().optional(),
  /** Шинэ нууц үг — админ өөрөө тогтооно. */
  password: z.string().min(8).max(64).optional(),
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
  const input = parsed.data;

  // Админ өөрийгөө идэвхгүй болговол системд орох хүнгүй үлдэж мэднэ.
  if (input.is_active === false && id === guard.session.sub) {
    return NextResponse.json(
      { error: "Өөрийгөө идэвхгүй болгох боломжгүй." },
      { status: 400 },
    );
  }

  const values: Record<string, unknown> = { updatedAt: new Date() };

  if (input.is_active !== undefined) values.isActive = input.is_active;
  if (input.password) {
    values.passwordHash = await hashPassword(input.password);
  }

  const [updated] = await getDb()
    .update(surveyors)
    .set(values)
    .where(eq(surveyors.id, id))
    .returning({
      id: surveyors.id,
      badgeNumber: surveyors.badgeNumber,
      isActive: surveyors.isActive,
    });

  if (!updated) {
    return NextResponse.json({ error: "Алба хаагч олдсонгүй." }, { status: 404 });
  }

  await writeAudit({
    actorId: guard.session.sub,
    action: input.password ? "surveyor.password_reset" : "surveyor.updated",
    subjectId: id,
    ip: await getClientIp(),
    detail: { badge: updated.badgeNumber, isActive: updated.isActive },
  });

  return NextResponse.json({ id: updated.id, is_active: updated.isActive });
}
