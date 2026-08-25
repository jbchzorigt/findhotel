import { NextResponse } from "next/server";

import { writeAudit } from "@/lib/auth/audit";
import { getClientIp, getSession, getUserAgent } from "@/lib/auth/request";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();

  if (session) {
    await writeAudit({
      actorId: session.sub,
      action: "auth.logout",
      subjectId: session.sub,
      ip: await getClientIp(),
      userAgent: await getUserAgent(),
    });
  }

  // Сешн байсан эсэхээс үл хамааран cookie-г арилгана — давхар дарсан ч
  // алдаа заахгүй байх нь зөв зан төлөв.
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
