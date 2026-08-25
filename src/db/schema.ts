/**
 * Өгөгдлийн бүтэн загвар — docs/PROJECT_SPEC.md §7.
 *
 * Зарчим (Hotel SaaS-тай тууштай байлгах үүднээс):
 *   - Бүх анхдагч түлхүүр uuid, `gen_random_uuid()`-аар үүснэ
 *   - Бүх цагийн талбар timestamptz — локал цагийн бүс хэзээ ч хадгалагдахгүй
 *   - Хязгаарлалтыг DB дээр CHECK-ээр барина, зөвхөн аппын кодод найдахгүй
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ===========================================================================
// Enum-ууд
// ===========================================================================
export const surveyorRole = pgEnum("surveyor_role", ["SURVEYOR", "ADMIN"]);

/** Байршил хаанаас гаралтай вэ — мөрдөх ул мөр (§5.1). */
export const locationSource = pgEnum("location_source", [
  "OSM_POI", // Overpass-аас сонгосон буудал — координат нь барилгын төв
  "GPS", // Зөвхөн утасны GPS
  "MAP_PIN", // Алба хаагч газрын зураг дээр гараар зөөсөн
  "MAPS_LINK", // Google Maps линкээс задалсан (API дуудлагагүй, зүгээр parse)
]);

/**
 * DRAFT төлөв ЗОРИУДААР байхгүй: алба хаагч шууд илгээдэг тул маягт зөвхөн
 * клиент дээр амьдарна. Сервер дээр мөр үүсэх = аль хэдийн SUBMITTED.
 */
export const surveyStatus = pgEnum("survey_status", [
  "SUBMITTED",
  "EXPORTED",
  "DELETED",
]);

// ===========================================================================
// surveyor — алба хаагч
// ===========================================================================
export const surveyors = pgTable(
  "surveyor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    badgeNumber: varchar("badge_number", { length: 32 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    unit: varchar("unit", { length: 120 }),
    role: surveyorRole("role").notNull().default("SURVEYOR"),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("surveyor_badge_number_key").on(t.badgeNumber)],
);

// ===========================================================================
// hotel_survey — бүртгэлийн үндсэн хүснэгт
// ===========================================================================
export const hotelSurveys = pgTable(
  "hotel_survey",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Утас үүсгэнэ. Сүлжээ тасарч дахин илгээхэд давхар мөр үүсэхээс хамгаална. */
    clientUuid: uuid("client_uuid").notNull(),

    name: varchar("name", { length: 200 }).notNull(),
    /** Жижиг үсэг + зай цэгцэлсэн хувилбар — давхардлын trigram хайлтад. */
    nameNormalized: varchar("name_normalized", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    addressText: text("address_text"),

    lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
    lng: numeric("lng", { precision: 10, scale: 6 }).notNull(),
    locationSource: locationSource("location_source").notNull(),
    /** GPS-ийн мэдээлсэн нарийвчлал, метрээр. >100м бол илгээлт блоклогдоно. */
    locationAccuracyM: integer("location_accuracy_m"),

    /** OSM объектын лавлагаа, ж: "node/123456". Давхардлын хамгийн найдвартай түлхүүр. */
    osmRef: text("osm_ref"),
    /** OSM юу гэж нэрлэсэн. `name`-ээс зөрвөл алба хаагч зассан гэсэн үг. */
    osmRawName: text("osm_raw_name"),
    googleMapsUrl: text("google_maps_url"),

    note: text("note"),
    status: surveyStatus("status").notNull().default("SUBMITTED"),

    /** Алба хаагч "давхардал биш, өөр буудал мөн" гэж баталсан эсэх. */
    duplicateAck: boolean("duplicate_ack").notNull().default(false),
    /** Аль мөртэй таарч байсныг тэмдэглэнэ — админ хожим шүүж хардаг. */
    duplicateOf: uuid("duplicate_of").references(
      (): AnyPgColumn => hotelSurveys.id,
      { onDelete: "set null" },
    ),

    surveyorId: uuid("surveyor_id")
      .notNull()
      .references(() => surveyors.id, { onDelete: "restrict" }),

    /** Утсан дээр бүртгэсэн цаг (сервер хүлээж авсан цаг биш). */
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    /** Экспортын файлд орсон цаг. */
    exportedAt: timestamp("exported_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("hotel_survey_client_uuid_key").on(t.clientUuid),
    check("hotel_survey_lat_range", sql`${t.lat} BETWEEN -90 AND 90`),
    check("hotel_survey_lng_range", sql`${t.lng} BETWEEN -180 AND 180`),
    // Монголын гар утасны дугаар: 8 орон, 7/8/9-өөр эхэлнэ.
    check("hotel_survey_phone_format", sql`${t.phone} ~ '^[7-9][0-9]{7}$'`),
    check(
      "hotel_survey_accuracy_sane",
      sql`${t.locationAccuracyM} IS NULL OR ${t.locationAccuracyM} BETWEEN 0 AND 100000`,
    ),
    index("hotel_survey_status_created_idx").on(t.status, t.createdAt.desc()),
    index("hotel_survey_surveyor_created_idx").on(
      t.surveyorId,
      t.createdAt.desc(),
    ),
    // Давхардлын bounding-box хайлт (§11). PostGIS хэрэггүй.
    index("hotel_survey_lat_lng_idx").on(t.lat, t.lng),
    index("hotel_survey_osm_ref_idx")
      .on(t.osmRef)
      .where(sql`osm_ref IS NOT NULL`),
    // Нэрний ойролцоо ижилслийг хайхад (§11.3). `pg_trgm` өргөтгөл
    // эхний миграцид үүсгэгдэнэ.
    index("hotel_survey_name_trgm_idx").using(
      "gin",
      sql`${t.nameNormalized} gin_trgm_ops`,
    ),
  ],
);

// ===========================================================================
// survey_photo
// ===========================================================================
export const surveyPhotos = pgTable(
  "survey_photo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => hotelSurveys.id, { onDelete: "cascade" }),

    /** R2 объектын түлхүүр — устгахад хэрэгтэй. Клиентийн файлын нэр ХЭЗЭЭ Ч биш. */
    r2Key: text("r2_key").notNull(),
    publicUrl: text("public_url").notNull(),

    /** Ижил зургийг дахин илгээхийг илрүүлнэ. */
    sha256: char("sha256", { length: 64 }),
    /** Клиент дээр шахсаны ДАРААХ хэмжээ. */
    bytes: integer("bytes"),
    width: integer("width"),
    height: integer("height"),

    // Зургийн өөрийнх нь GPS — арилгахаас ӨМНӨ уншиж авсан утга.
    // Маягтын байршилтай >150м зөрвөл илгээлт блоклогдоно (§11.2).
    exifLat: numeric("exif_lat", { precision: 9, scale: 6 }),
    exifLng: numeric("exif_lng", { precision: 10, scale: 6 }),
    exifTakenAt: timestamp("exif_taken_at", { withTimezone: true }),

    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("survey_photo_survey_idx").on(t.surveyId),
    check(
      "survey_photo_exif_lat_range",
      sql`${t.exifLat} IS NULL OR ${t.exifLat} BETWEEN -90 AND 90`,
    ),
    check(
      "survey_photo_exif_lng_range",
      sql`${t.exifLng} IS NULL OR ${t.exifLng} BETWEEN -180 AND 180`,
    ),
  ],
);

// ===========================================================================
// geo_cache — Nominatim / Overpass-ийн хариуг хадгална
// ===========================================================================
/**
 * OSM бол ODbL нээлттэй өгөгдөл тул хугацаагүй хадгалж болно (Google-ийн
 * 30 хоногийн хязгаарлалт энд хамаарахгүй). Кэш нь Nominatim-ийн "секундэд
 * 1 дуудлага" дүрмийг баримтлах гол хэрэгсэл — §13.3.
 */
export const geoCache = pgTable("geo_cache", {
  /** ~25м торонд бөөрөнхийлсөн координат, ж: "47.91890,106.91740". */
  gridKey: text("grid_key").primaryKey(),
  addressText: text("address_text"),
  poi: jsonb("poi"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===========================================================================
// geo_rate_gate — гадаад үйлчилгээний дуудлагыг цэгцлэх
// ===========================================================================
/**
 * Nominatim-ийн хэрэглээний нөхцөл "секундэд 1-ээс илүү дуудлага байж
 * болохгүй" гэж шаарддаг. Serverless дээр функц бүр өөрийн санах ойтой тул
 * процесс доторх тоолуур утгагүй — халуун 10 функц секундэд 10 дуудлага
 * хийчихнэ. Зөрчвөл IP хоригдох ба Vercel дээр тэр IP бусад хэрэглэгчидтэй
 * хуваалцдаг тул үр дагавар нь зөвхөн бидэнд хамаарахгүй.
 *
 * Шийдэл: дараагийн зөвшөөрөгдөх агшныг НЭГ атомик UPDATE-ээр захиална
 * (`geo.ts` доторх `reserveSlot`). Түгжээ ч, гүйлгээ ч шаардахгүй — зэрэг
 * ирсэн дуудлагууд дараалан 1 секундын зайтай слот авна.
 */
export const geoRateGate = pgTable("geo_rate_gate", {
  service: text("service").primaryKey(),
  lastCalledAt: timestamp("last_called_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===========================================================================
// audit_log
// ===========================================================================
export const auditLogs = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** NULL = системийн үйлдэл (ж: экспортын машин хэрэглэгч). */
    actorId: uuid("actor_id").references(() => surveyors.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 64 }).notNull(),
    subjectId: uuid("subject_id"),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("user_agent"),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_actor_created_idx").on(t.actorId, t.createdAt.desc()),
    index("audit_log_subject_idx").on(t.subjectId),
    // Нэвтрэлтийн хязгаарлалт (throttle) энэ индекс дээр амьдарна:
    // "сүүлийн 5 минутад action='auth.login.failed' байсан мөрүүд".
    index("audit_log_action_created_idx").on(t.action, t.createdAt.desc()),
  ],
);
