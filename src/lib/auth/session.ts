/**
 * Сешн — гарын үсэгтэй JWT, httpOnly cookie дотор.
 *
 * `jose` сонгосон шалтгаан: WebCrypto дээр суурилдаг тул Edge runtime-д
 * ажиллана. `proxy.ts` нь Edge дээр ажилладаг тул токеныг тэнд шалгах
 * боломжтой байх ёстой — `jsonwebtoken` гэх мэт Node-only сан тэнд унана.
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "hfs_session";

/** Нэг ээлжийн урт. Refresh token байхгүй — талбарын ажил богино. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export type SurveyorRole = "SURVEYOR" | "ADMIN";

export type SessionClaims = {
  /** surveyor.id */
  sub: string;
  badge: string;
  role: SurveyorRole;
};

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET тохируулагдаагүй эсвэл хэт богино байна " +
        "(доод тал нь 32 тэмдэгт). `openssl rand -base64 48` ашиглана уу.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  claims: SessionClaims,
): Promise<string> {
  return new SignJWT({ badge: claims.badge, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Хүчинтэй бол claims, эс бөгөөс `null`. Хэзээ ч алдаа шиднэ гэж найдахгүй. */
export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    const role = payload.role;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.badge !== "string" ||
      (role !== "SURVEYOR" && role !== "ADMIN")
    ) {
      return null;
    }
    return { sub: payload.sub, badge: payload.badge, role };
  } catch {
    // Хугацаа дууссан, гарын үсэг буруу, гуйвуулсан — бүгд ижил үр дүн.
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
