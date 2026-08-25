/**
 * Админ — алба хаагчийн жагсаалт ба шинээр нэмэх.
 *
 * Нууц үгийг СИСТЕМ үүсгэнэ, админ сонгохгүй. Админ өөрөө бодвол богино,
 * таамаглахад хялбар үг сонгох магадлал өндөр — бүх данс нэг хүний зуршлаас
 * хамаарах нь эмзэг. Үүссэн нууц үг НЭГ л удаа хариуд буцна.
 */
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { surveyors } from "@/db/schema";
import { generateTemporaryPassword, requireAdmin } from "@/lib/auth/admin";
import { writeAudit } from "@/lib/auth/audit";
import { hashPassword } from "@/lib/auth/password";
import { getClientIp } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const rows = await getDb()
    .select({
      id: surveyors.id,
      badgeNumber: surveyors.badgeNumber,
      fullName: surveyors.fullName,
      unit: surveyors.unit,
      role: surveyors.role,
      isActive: surveyors.isActive,
      createdAt: surveyors.createdAt,
    })
    .from(surveyors)
    .orderBy(asc(surveyors.badgeNumber));

  return NextResponse.json({
    surveyors: rows.map((row) => ({
      id: row.id,
      badge_number: row.badgeNumber,
      full_name: row.fullName,
      unit: row.unit,
      role: row.role,
      is_active: row.isActive,
      created_at: row.createdAt.toISOString(),
    })),
  });
}

const CreateSchema = z.object({
  badge_number: z.string().trim().min(2).max(32),
  full_name: z.string().trim().min(2).max(160),
  unit: z.string().trim().max(120).nullable().optional(),
  role: z.enum(["SURVEYOR", "ADMIN"]).default("SURVEYOR"),
});

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Badge дугаар болон нэрээ бүрэн бөглөнө үү." },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const db = getDb();

  const [existing] = await db
    .select({ id: surveyors.id })
    .from(surveyors)
    .where(eq(surveyors.badgeNumber, input.badge_number))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: `"${input.badge_number}" аль хэдийн бүртгэлтэй байна.` },
      { status: 409 },
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const [created] = await db
    .insert(surveyors)
    .values({
      badgeNumber: input.badge_number,
      fullName: input.full_name,
      unit: input.unit ?? null,
      role: input.role,
      passwordHash: await hashPassword(temporaryPassword),
    })
    .returning({ id: surveyors.id });

  await writeAudit({
    actorId: guard.session.sub,
    action: "surveyor.created",
    subjectId: created!.id,
    ip: await getClientIp(),
    detail: { badge: input.badge_number, role: input.role },
  });

  return NextResponse.json(
    {
      id: created!.id,
      badge_number: input.badge_number,
      // НЭГ л удаа буцна — DB-д зөвхөн hash хадгалагдана.
      temporary_password: temporaryPassword,
    },
    { status: 201 },
  );
}
