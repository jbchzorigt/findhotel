import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js нь `.env.local`-ыг уншдаг ч drizzle-kit нь тусдаа процесс тул
// өөрөө ачаалж өгөх хэрэгтэй.
config({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.POSTGRES_URL ?? "" },
  strict: true,
  verbose: true,
});
