/**
 * Админ — алба хаагчийн жагсаалт ба шинээр нэмэх.
 *
 * Нууц үгийг админ өөрөө тогтооно. Хамгийн богино урт (8) нь нэвтрэлтийн
 * схемтэй тааруулсан — өөр байвал үүсгэсэн данс нэвтэрч чадахгүй байх
 * төөрөгдөл үүснэ. Нууц үг зөвхөн hash хэлбэрээр хадгалагдана.
 */
import { asc, eq } from "drizzle-orm";
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
  // Урт нь нэвтрэлтийн схемтэй ижил байх ёстой (login route).
  password: z.string().min(8).max(64),
});

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Badge дугаар, нэр, нууц үгээ бүрэн бөглөнө үү " +
          "(нууц үг 8–64 тэмдэгт).",
      },
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

  const [created] = await db
    .insert(surveyors)
    .values({
      badgeNumber: input.badge_number,
      fullName: input.full_name,
      unit: input.unit ?? null,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    })
    .returning({ id: surveyors.id });

  await writeAudit({
    actorId: guard.session.sub,
    action: "surveyor.created",
    subjectId: created!.id,
    ip: await getClientIp(),
    detail: { badge: input.badge_number, role: input.role },
  });

  // Нууц үгийг буцаахгүй — админ өөрөө оруулсан тул аль хэдийн мэдэж байгаа.
  return NextResponse.json(
    { id: created!.id, badge_number: input.badge_number },
    { status: 201 },
  );
}
