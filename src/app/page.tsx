import { redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { SurveyForm } from "@/components/SurveyForm";
import { getSession } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export default async function NewSurveyPage() {
  /*
   * `proxy.ts` нь зөвхөн /api/* замыг хамгаалдаг тул хуудас өөрөө шалгана.
   * Хуудсыг proxy-д оруулбал статик хөрөнгө бүр дээр шалгалт явж, CDN-ийн
   * кэш алдагдана.
   */
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-md p-4">
      <AppHeader active="new" />
      <SurveyForm surveyorName={`${session.badge} — нэвтэрсэн`} />
    </main>
  );
}
