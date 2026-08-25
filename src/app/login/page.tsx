import { redirect } from "next/navigation";

import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Нэвтэрсэн хүнийг нэвтрэх дэлгэц дээр барих шаардлагагүй.
  if (await getSession()) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-bold">Зочид буудлын бүртгэл</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Албан хаагчийн badge дугаараар нэвтэрнэ үү.
      </p>
      <LoginForm />
    </main>
  );
}
