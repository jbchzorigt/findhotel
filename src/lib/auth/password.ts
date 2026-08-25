/**
 * Нууц үгийн hash. ЗӨВХӨН Node runtime — `bcryptjs` нь Edge дээр ажиллахгүй.
 */
import bcrypt from "bcryptjs";

/** cost 12 ≈ 200мс. Нэвтрэлт ховор үйлдэл тул энэ нь боломжийн үнэ. */
const COST = 12;

/**
 * Олдоогүй хэрэглэгчийн оронд харьцуулах хуурамч hash.
 *
 * Ингэснээр "badge олдсонгүй" болон "нууц үг буруу" хоёр ижил хугацаа
 * зарцуулна — цагийн зөрүүгээр аль badge бодитой болохыг таах боломжгүй.
 * (Hotel SaaS-ийн `DUMMY_HASH`-тай ижил зарчим.)
 */
export const DUMMY_HASH = bcrypt.hashSync("dummy-password-never-matches", COST);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
