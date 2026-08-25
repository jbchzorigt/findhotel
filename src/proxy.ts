/**
 * Хамгаалалтын эхний хаалт (Next.js 16-д `middleware` нь `proxy` болсон).
 *
 * Энэ давхаргын үүрэг ХЯЗГААРЛАГДМАЛ ба зориуд тийм:
 *
 *   1. Токенгүй/хүчингүй хүсэлтийг эрт таслах — route хүртэл, DB хүртэл
 *      хүрэхгүй. Serverless дээр энэ нь хэмнэлт.
 *   2. Клиентээс ирсэн хуурамч таних header байвал устгах.
 *
 * Энэ нь таних тэмдгийг route руу header-ээр дамжуулдаггүй. Учир нь клиент
 * тэр header-ийг өөрөө илгээж чадна — proxy бүх замыг барихгүй бол
 * хуурамчаар нэвтрэх нүх үүснэ. Route бүр `getSession()`-оор cookie-гоос
 * гарын үсгийг ДАХИН шалгана. Proxy бол хурд, харин cookie бол үнэн.
 *
 * Edge runtime дээр ажилладаг тул `jose`-оос өөр (DB, bcryptjs) юу ч энд
 * импортлож болохгүй.
 */
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "./lib/auth/session";

/** Нэвтрэлтгүйгээр хандах боломжтой API замууд. */
const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout", // давхар гарахад алдаа заах шаардлагагүй
]);

/** Клиент илгээвэл устгах ёстой header-ууд — доор дурдсан шалтгаанаар. */
const SPOOFABLE_HEADERS = ["x-surveyor-id", "x-surveyor-role", "x-badge"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const headers = new Headers(request.headers);
  let stripped = false;
  for (const name of SPOOFABLE_HEADERS) {
    if (headers.has(name)) {
      headers.delete(name);
      stripped = true;
    }
  }
  const forward = () =>
    stripped
      ? NextResponse.next({ request: { headers } })
      : NextResponse.next();

  if (!pathname.startsWith("/api/") || PUBLIC_API_PATHS.has(pathname)) {
    return forward();
  }

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Нэвтрээгүй байна." }, { status: 401 });
  }

  // ADMIN-ы зам — SURVEYOR энд хүрэхгүй.
  if (pathname.startsWith("/api/admin/") && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Эрх хүрэхгүй." }, { status: 403 });
  }

  return forward();
}

export const config = {
  matcher: [
    /*
     * Статик файл, зураг оруулаагүй — тэдгээрт шалгалт хэрэггүй ба
     * CDN дээр кэшлэгдэх ёстой.
     */
    "/api/:path*",
  ],
};
