/**
 * Алба хаагч үүсгэх / нууц үг сэргээх.
 *
 *   npm run seed -- --badge A-1001 --name "Батын Болд" --unit "СБД" --role ADMIN
 *   npm run seed -- --badge A-1001 --reset-password
 *
 * Нууц үгийг тушаалын мөрөнд БИЧИХГҮЙ — далд горимоор асууна. Учир нь
 * тушаалын мөр нь shell-ийн түүхэнд болон `ps` дээр харагддаг.
 */
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { config } from "dotenv";
import { eq } from "drizzle-orm";

// `getDb()` нь орчны хувьсагчийг дуудагдах агшинд уншдаг (залхуу) тул
// доорх импортууд аюулгүй — зөвхөн энэ мөр тэднээс өмнө ажиллахад хангалттай.
config({ path: ".env.local", quiet: true });

import { getDb } from "@/db";
import { surveyors } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

// ---------------------------------------------------------------------------
// Тушаалын мөр
// ---------------------------------------------------------------------------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const USAGE = [
  'npm run seed -- --badge A-1001 --name "Батын Болд" --unit "СБД" --role ADMIN',
  "npm run seed -- --badge A-1001 --reset-password",
].join("\n  ");

// ---------------------------------------------------------------------------
// Далд оролт
// ---------------------------------------------------------------------------
/**
 * ЧУХАЛ: readline interface-ийг НЭГ л удаа үүсгэнэ.
 *
 * Асуулт бүрт шинээр үүсгээд `close()` дуудвал эхний хаалт `stdin`-г
 * битүүмжилж, дараагийн асуулт мөнхөд өлгөгддөг. Энэ нь TTY дээр заримдаа
 * ажиллаад, pipe-аар оролт өгөх үед тогтмол унадаг тул амархан өнгөрдөг алдаа.
 */
function createHiddenPrompt() {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  let muted = false;

  const out = rl as unknown as { _writeToOutput: (chunk: string) => void };
  const writeOriginal = out._writeToOutput.bind(rl);
  out._writeToOutput = (chunk: string) => {
    if (!muted) writeOriginal(chunk);
  };

  return {
    ask(question: string): Promise<string> {
      return new Promise((resolve) => {
        muted = false;
        rl.question(question, (answer) => {
          stdout.write("\n");
          resolve(answer);
        });
        // Асуултын текст бичигдсэний ДАРАА далдална — цаашид дарсан
        // тэмдэгтүүд дэлгэц дээр харагдахгүй.
        muted = true;
      });
    },
    close() {
      rl.close();
    },
  };
}

/**
 * Не-интерактив горим: `stdin` нь терминал биш үед (pipe, CI) бүх оролтыг
 * уншиж эхний мөрийг нууц үг болгон авна. Далдлах шаардлагагүй — дэлгэц алга.
 *
 * Энэ нь зөвхөн тохь тух биш: TTY-гүй орчинд readline нь хоёр дахь асуултаа
 * уншиж чадалгүй процесс чимээгүй гардаг тул ийм салаа зам заавал хэрэгтэй.
 */
function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      buffer += chunk;
    });
    stdin.on("end", () => resolve(buffer.split("\n")[0]!.trim()));
    stdin.on("error", reject);
  });
}

async function readNewPassword(): Promise<string> {
  if (!stdin.isTTY) {
    console.warn("(терминал биш — нууц үгийг stdin-ээс уншиж байна)");
    const piped = await readPasswordFromStdin();
    if (piped.length < 8 || piped.length > 64) {
      throw new Error("Нууц үг 8–64 тэмдэгт байх ёстой.");
    }
    return piped;
  }

  const prompt = createHiddenPrompt();
  try {
    const first = await prompt.ask("Шинэ нууц үг (8–64 тэмдэгт): ");
    if (first.length < 8 || first.length > 64) {
      throw new Error("Нууц үг 8–64 тэмдэгт байх ёстой.");
    }
    const again = await prompt.ask("Дахин оруулна уу: ");
    if (first !== again) {
      throw new Error("Нууц үг таарахгүй байна.");
    }
    return first;
  } finally {
    prompt.close();
  }
}

// ---------------------------------------------------------------------------
// Гүйцэтгэл
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const badge = arg("badge");
  const fullName = arg("name");
  const unit = arg("unit");
  const role = (arg("role") ?? "SURVEYOR").toUpperCase();
  const resetPassword = hasFlag("reset-password");

  if (!badge) {
    throw new Error(`--badge заавал шаардлагатай.\n\n  ${USAGE}`);
  }
  if (role !== "SURVEYOR" && role !== "ADMIN") {
    throw new Error(`--role нь SURVEYOR эсвэл ADMIN байх ёстой (өгсөн: ${role})`);
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: surveyors.id, fullName: surveyors.fullName })
    .from(surveyors)
    .where(eq(surveyors.badgeNumber, badge))
    .limit(1);

  if (existing && !resetPassword) {
    throw new Error(
      `"${badge}" аль хэдийн бүртгэлтэй (${existing.fullName}).\n` +
        "Нууц үгийг нь солих бол --reset-password нэмнэ үү.",
    );
  }
  if (!existing && resetPassword) {
    throw new Error(`"${badge}" олдсонгүй — эхлээд үүсгэнэ үү.`);
  }
  if (!existing && !fullName) {
    throw new Error("Шинэ алба хаагчид --name шаардлагатай.");
  }

  const passwordHash = await hashPassword(await readNewPassword());

  if (existing) {
    await db
      .update(surveyors)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(surveyors.id, existing.id));
    console.log(`✓ "${badge}" — нууц үг шинэчлэгдлээ.`);
    return;
  }

  const [created] = await db
    .insert(surveyors)
    .values({
      badgeNumber: badge,
      fullName: fullName!,
      unit: unit ?? null,
      role: role as "SURVEYOR" | "ADMIN",
      passwordHash,
    })
    .returning({ id: surveyors.id });

  console.log(`✓ "${badge}" (${fullName}) — ${role} эрхтэйгээр үүслээ.`);
  console.log(`  id: ${created!.id}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
