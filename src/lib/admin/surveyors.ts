/**
 * Алба хаагчдын жагсаалт — хуудас болон API хоёрын ХАМТЫН эх сурвалж.
 *
 * Хоёр газар тусад нь query бичвэл хэзээ нэгэн цагт салдаг: нэг нь устгасан
 * бүртгэлийг тоолж, нөгөө нь тоолохгүй байх гэх мэт. Нэг функц байвал
 * тэр зөрүү үүсэх боломжгүй.
 */
import { asc, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { surveyors } from "@/db/schema";

export type SurveyorRow = {
  id: string;
  badge_number: string;
  full_name: string;
  unit: string | null;
  role: "SURVEYOR" | "ADMIN";
  is_active: boolean;
  /** Устгаагүй бүртгэлийн тоо. */
  survey_count: number;
};

export async function listSurveyors(): Promise<SurveyorRow[]> {
  const rows = await getDb()
    .select({
      id: surveyors.id,
      badge_number: surveyors.badgeNumber,
      full_name: surveyors.fullName,
      unit: surveyors.unit,
      role: surveyors.role,
      is_active: surveyors.isActive,
      /*
       * Хамааралт дэд query. `hotel_survey(surveyor_id, created_at)` индекс
       * дээр ажиллана. Устгасан мөрийг тоолохгүй — админ "энэ хүн хэдэн
       * бүртгэл хийсэн бэ" гэж асуухдаа хүчинтэй бүртгэлийг хэлж байгаа.
       *
       * ГАДНА баганыг ЗААВАЛ хүснэгтийн нэрээр заана (`surveyor.id`).
       * `${"$"}{surveyors.id}` бичвэл Drizzle нь зүгээр `"id"` гэж гаргадаг ба
       * дэд query дотор тэр нэр эхлээд `hotel_survey`-ийн ӨӨРИЙНХ нь `id`
       * баганад холбогдоно — үр дүнд `hs.surveyor_id = hs.id` болж хэзээ ч
       * таарахгүй. Алдаа шиддэггүй, зүгээр л бүгдийг 0 гэж буцаадаг.
       */
      survey_count: sql<number>`(
        select count(*)::int from hotel_survey hs
        where hs.surveyor_id = surveyor.id and hs.status <> 'DELETED'
      )`,
    })
    .from(surveyors)
    .orderBy(asc(surveyors.badgeNumber));

  return rows;
}
