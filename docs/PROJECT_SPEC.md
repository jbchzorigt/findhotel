# Hotel Field Survey — Төслийн тодорхойлолт (v4)

> **Статус:** шийдвэрүүд хаагдсан, кодлоход бэлэн.
> v3-аас өөрчлөгдсөн: **бүх төлбөртэй үйлчилгээ хасагдсан** — Google Places/Maps →
> OpenStreetMap (Overpass + Nominatim + Leaflet) · Vercel Blob → Cloudflare R2 ·
> зураг клиент дээр шахагдана. **Сарын зардал: $0.**

---

## 1. Нэг өгүүлбэрээр

Цагдаагийн алба хаагч талбар дээр гар утсаараа **зочид буудлын гаднах зургийг
дарж, нэр, утас, байршлыг тэмдэглэдэг** PWA. Цуглуулсан бүртгэл **Hotel SaaS
руу шууд INSERT хийхэд бэлэн** байдлаар экспортлогдоно.

## 2. Яагаад тусдаа систем вэ

| Шалтгаан | Тайлбар |
|---|---|
| **Итгэлцлийн түвшин өөр** | Талбарын бүртгэл = батлагдаагүй, гаднаас цуглуулсан. SaaS-ийн Tenant = гэрээтэй, батлагдсан. Нэг DB-д хольж болохгүй. |
| **Deploy өөр** | Энэ нь Vercel дээр, SaaS нь өөрийн сервер дээр. Тусдаа амьдралын мөчлөг. |
| **Аюулгүй байдлын гадаргуу** | SaaS-д police realm тусгаарлагдсан DB role-той. Тэнд шинэ mobile upload гадаргуу нэмэх нь тэр тусгаарлалтыг сулруулна. |
| **Дахин ашиглагдана** | Дараа нь ресторан, караоке гэх мэт өөр объект судлахад ижил апп ажиллана. |

## 3. Хамрах хүрээ

### v1-д ОРНО
- Алба хаагчийн нэвтрэлт (badge + нууц үг)
- Гаднах фасадын зураг (1–5 ширхэг, ≥1 заавал) — **клиент дээр шахагдана**
- Буудлын нэр — **заавал**
- Утасны дугаар — **заавал** (лид болж ашиглагдана)
- Байршил: **[📍] товч → GPS-ээр хаяг болон ойролцоох буудлыг автоматаар олох** (§5.1)
- Гараар засах: газрын зураг дээр цэг зөөх, Google Maps линк буулгах *(линк
  задлах нь зүгээр л URL parse — API дуудлага биш, төлбөргүй)*
- Давхардал шалгах
- Алба хаагч **шууд submit хийнэ** — хяналтын шат байхгүй
- Админ дэлгэц: бүх бүртгэл, экспорт татах, алба хаагч удирдах
- Аудит лог

### v1-д ОРОХГҮЙ
- Ахлагчийн батламж/хяналтын дараалал *(хасагдсан — §4)*
- **Оффлайн ажиллагаа** — эцэслэн хасагдсан. Сүлжээгүй бол бүртгэл хийхгүй.
  (`client_uuid` талбар үлдэнэ — хожим нэмэх шаардлага гарвал схем эвдэхгүй)
- Төлбөртэй API (Google Places, Maps JS, Mapbox гэх мэт) — **бүрэн хориотой**
- Өрөө/үнэ/ажилтны мэдээлэл
- Иргэний хувийн мэдээлэл — **РД, иргэний нэр хэзээ ч хадгалахгүй**

### Тодорхой хориглох зүйл
Апп нь **хүн зураглахгүй** — зөвхөн барилгын гаднах тал. Энэ дүрэм камерын
дэлгэц дээр бичигдэнэ.

## 4. Хэрэглэгчид ба үүрэг

| Үүрэг | Юу хийдэг |
|---|---|
| `SURVEYOR` (алба хаагч) | Бүртгэл үүсгэж **шууд илгээнэ**. Зөвхөн өөрийн бүртгэлээ харна. Илгээсний дараа засах эрхгүй. |
| `ADMIN` | Бүх бүртгэл харах, экспорт татах, алба хаагчийн эрх нээх/хаах, алдаатай мөр устгах. |

> **Хяналтын шат хасагдсаны үр дагавар:** өгөгдлийн чанарын цорын ганц
> хамгаалалт нь **submit хийх агшин дахь автомат шалгалт** болж үлдлээ.
> Тиймээс §11-ийн шалгалтууд нь зөөлөн анхааруулга биш, **хатуу блок**.

## 5. Гол урсгал

```
Алба хаагч буудлын өмнө зогсоно
  │
  ├─ Апп нээнэ → GPS автоматаар асна
  ├─ [Зураг дарах] → фасадын зураг (≥1, ≤5)
  │     ├─ клиент дээр 1600px / JPEG q0.8 болж шахагдана (4MB → ~400KB)
  │     └─ EXIF-ийн GPS уншаад аваад, дараа нь зурагнаас арилгана
  │     └─ шахсан файл клиентээс ШУУД R2 руу орно (сервер дундуур биш)
  │
  ├─ [📍 Байршлаас олох] дарна  ← ГОЛ УРСГАЛ, §5.1
  │     └─ хаяг автоматаар бөглөгдөнө; буудал олдвол нэр нь ч бөглөгдөнө
  ├─ Нэр бичнэ/шалгана ← "хаалганы самбар дээрхээр яг бич"
  ├─ Утас бичнэ       ← 8 оронтой, 7/8/9-өөр эхэлнэ
  │
  ├─ [Илгээх] → сервер шалгана:
  │     ├─ GPS нарийвчлал > 100м        → БЛОК: "сүлжээ/GPS-ээ хүлээнэ үү"
  │     ├─ EXIF GPS маягтаас >150м зөрсөн → БЛОК: "зургаа энд дарна уу"
  │     ├─ давхардал (§11)               → БЛОК + өмнөх бүртгэлийн зураг
  │     └─ бүгд цэвэр → SUBMITTED  ✅ дууслаа
  │
  ▼
Админ дэлгэц → [Экспорт татах] → .sql эсвэл JSON
  │
  ▼
Hotel SaaS: psql-ээр .sql-ийг оруулна → contact_requests (lead) үүснэ
```

### 5.1 [📍] товчны логик — бүрэн үнэгүй эх сурвалжаар

```
Алба хаагч [📍] дарна
  │
  ├─ Браузер GPS асаана (enableHighAccuracy: true)
  │     └─ нарийвчлал > 100м бол "хүлээнэ үү" гэж эргүүлнэ
  │
  ├─ POST /api/geo/lookup { lat, lng }     ← бүх дуудлага сервер дундуур
  │     │
  │     ├─ ЭХ СУРВАЛЖ 1 — Манай өөрийн DB (шуурхай, үнэгүй, хязгааргүй)
  │     │     150м дотор өмнө бүртгэсэн буудал байна уу?
  │     │     → байвал "аль хэдийн бүртгэгдсэн" гэж тэмдэглэж харуулна
  │     │
  │     ├─ ЭХ СУРВАЛЖ 2 — Overpass API (OpenStreetMap-ийн POI)
  │     │     [out:json];
  │     │     nwr(around:150,LAT,LNG)
  │     │        [~"^(tourism|building)$"~"^(hotel|motel|hostel|guest_house|apartment)$"];
  │     │     out center tags;
  │     │     → [{ osmRef:"node/123", name, tags, lat, lng, distanceM }]
  │     │
  │     └─ ЭХ СУРВАЛЖ 3 — Nominatim reverse geocode (ҮРГЭЛЖ дуудагдана)
  │           GET /reverse?lat=..&lon=..&format=jsonv2&zoom=18
  │           → гудамжны хаяг: "СБД, 1-р хороо, Энхтайваны өргөн чөлөө 15"
  │
  ▼
Дэлгэц дээр:
  ┌────────────────────────────────────────────────┐
  │ 📍 СБД, 1-р хороо, Энхтайваны өргөн чөлөө 15   │  ← хаяг ҮРГЭЛЖ гарна
  │ ────────────────────────────────────────────── │
  │ Ойролцоох буудлууд:                            │
  │ ⚠ Туушин Зочид Буудал  · 8м  · БҮРТГЭГДСЭН    │  ← манай DB-ээс
  │ ○ Bayangol Hotel       · 41м · OSM             │  ← Overpass-аас
  │ ────────────────────────────────────────────── │
  │ ● Жагсаалтад алга — нэрийг гараар бичих        │  ← ХАМГИЙН ТҮГЭЭМЭЛ
  └────────────────────────────────────────────────┘
```

**Үнэнч байдлаар хэлэхэд:** OpenStreetMap дээр Монголын буудлын мэдээлэл
Google-ээс мэдэгдэхүйц сийрэг. УБ-ын томоохон буудлууд байгаа ч жижиг зочид
байр, гэст хаусны олонх нь OSM-д байхгүй. Тиймээс **"нэрийг гараар бичих"
нь онцгой тохиолдол биш, ердийн урсгал** гэж үзэж UI-г тэрэнд тохируулна
(тэр сонголт хамгийн доор биш, тод харагдана).

Харин **хаяг автоматаар гарах хэсэг найдвартай ажиллана** — Nominatim нь
гудамж/хороо/дүүргийн түвшинд УБ-д хангалттай сайн. Энэ бол чиний гол хүсэлт.

**Талбарт буух зүйл:**

| Талбар | Хаанаас |
|---|---|
| `address_text` | Nominatim reverse — үргэлж |
| `name` | OSM-ээс сонговол урьдчилан бөглөгдөнө, эс бөгөөс гараар |
| `lat`/`lng` | OSM POI сонговол түүний координат, эс бөгөөс утасны GPS |
| `osm_ref` | `"node/123456"` — сонгосон бол. Давхардлын найдвартай түлхүүр |
| `location_source` | `OSM_POI` / `GPS` / `MAP_PIN` / `MAPS_LINK` |

**Кэш:** ~25м торон дээр бөөрөнхийлсөн координатаар `geo_cache` хүснэгтэд
хадгална. OSM өгөгдөл нь ODbL нээлттэй лиценз тул **хугацаагүй хадгалж болно**
(Google-ийн 30 хоногийн хязгаарлалт энд байхгүй) — зөвхөн эх сурвалжийг
заавал тэмдэглэнэ (§13.3).

## 6. Hotel SaaS-тэй холбогдох гэрээ  ⭐

### 6.1 Тогтмол дүрэм

> **Энэ систем Hotel SaaS-д Tenant үүсгэхгүй.**

Hotel SaaS-ийн `ContactRequest` docstring дээр:
*"Deliberately NOT a Tenant and NOT self-serve: because the platform is wired
into the police realm, tenant creation is a manual, verified, admin-only act."*
Тэр шийдвэрийг зөрчихгүй. Экспорт нь **lead** болж буух ба platform admin л
түүнийг Tenant болгоно.

### 6.2 Өгөгдлийн зураглал

| Survey (энэ систем) | Hotel SaaS `contact_requests` |
|---|---|
| `name` | `hotel_name` |
| `phone` | `phone` ✅ *(заавал болсон тул NOT NULL хэвээр)* |
| `address_text` | `address` *(шинэ багана)* |
| `lat` / `lng` | `maps_lat` / `maps_lng` *(шинэ багана)* |
| `primary_photo_url` | `photo_url` *(шинэ багана)* |
| `id` (uuid) | `external_ref` *(шинэ багана, UNIQUE)* |
| — | `source = 'FIELD_SURVEY'` *(шинэ багана)* |
| — | `status = 'NEW'` |

### 6.3 Hotel SaaS тал дээр хийгдэх миграци

Бүхэлдээ **additive** — одоо байгаа мөр, урсгалыг эвдэхгүй:

```sql
CREATE TYPE contact_request_source AS ENUM ('WEB_FORM', 'FIELD_SURVEY');

ALTER TABLE contact_requests
  ADD COLUMN source       contact_request_source NOT NULL DEFAULT 'WEB_FORM',
  ADD COLUMN external_ref uuid UNIQUE,
  ADD COLUMN address      text,
  ADD COLUMN maps_lat     numeric(9,6),
  ADD COLUMN maps_lng     numeric(10,6),
  ADD COLUMN photo_url    text;

-- Талбарын бүртгэлд "холбоо барих хүний нэр" гэж байхгүй (зөвхөн буудлын нэр).
ALTER TABLE contact_requests ALTER COLUMN contact_name DROP NOT NULL;
ALTER TABLE contact_requests ADD CONSTRAINT web_form_needs_contact_name
  CHECK (source <> 'WEB_FORM' OR contact_name IS NOT NULL);
```

`phone` нь **NOT NULL хэвээрээ** — энэ системд утас заавал болсон.

### 6.4 Экспортын хэлбэр: INSERT-д бэлэн SQL

```sql
-- hotel-survey-export-2026-08-25.sql
-- 42 мөр · exported_at 2026-08-25T14:03:11Z
BEGIN;

INSERT INTO contact_requests
  (id, hotel_name, contact_name, phone, status, source, external_ref,
   address, maps_lat, maps_lng, photo_url, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Туушин Зочид Буудал', NULL, '99112233', 'NEW',
   'FIELD_SURVEY', 'a3f1...'::uuid, 'СБД 1-р хороо, Энхтайваны өргөн чөлөө 15',
   47.918900, 106.917400, 'https://<r2-public>/photos/....jpg',
   now(), now())
  -- ... үлдсэн мөрүүд
ON CONFLICT (external_ref) DO NOTHING;

COMMIT;
```

**`ON CONFLICT (external_ref) DO NOTHING`** нь гол цэг: нэг файлыг хэдэн ч удаа
оруулсан давхардахгүй. "Алийг нь оруулсан бэ" гэж санах шаардлагагүй.

Хажуугаар нь `GET /api/export/leads?since=` (API key-тэй, JSON) байна.

**Мөр зугтахаас хамгаалах:** SQL-ийг мөр холбож үүсгэхгүй — драйверийн literal
escaper эсвэл `format('%L', ...)` ашиглана. Буудлын нэрэнд `'` байх нь бодит зүйл.

## 7. Өгөгдлийн загвар

```
surveyor
  id            uuid pk default gen_random_uuid()
  badge_number  varchar(32) unique not null    -- нэвтрэх нэр
  full_name     varchar(160) not null
  unit          varchar(120)                   -- харьяа хэлтэс
  role          enum(SURVEYOR, ADMIN) not null default 'SURVEYOR'
  password_hash text not null
  is_active     bool not null default true
  created_at / updated_at

hotel_survey
  id                   uuid pk
  client_uuid          uuid unique not null   -- утас үүсгэнэ; давхар илгээлтээс хамгаална
  name                 varchar(200) not null
  name_normalized      varchar(200) not null  -- жижиг үсэг, зай цэгцэлсэн, кирилл жигдрүүлсэн
  phone                varchar(32)  not null  -- CHECK ~ '^[7-9][0-9]{7}$'
  address_text         text
  lat                  numeric(9,6)  not null -- CHECK BETWEEN -90 AND 90
  lng                  numeric(10,6) not null -- CHECK BETWEEN -180 AND 180
  location_source      enum(OSM_POI, GPS, MAP_PIN, MAPS_LINK) not null
  location_accuracy_m  int                    -- GPS нарийвчлал (метр)
  osm_ref              text                   -- "node/123456" — сонгосон бол
  osm_raw_name         text                   -- OSM юу гэж нэрлэсэн (зассан бол зөрүү үлдэнэ)
  google_maps_url      text                   -- буулгасан линк (зүгээр parse, API биш)
  note                 text
  status               enum(SUBMITTED, EXPORTED, DELETED) not null default 'SUBMITTED'
  duplicate_ack        bool not null default false
  duplicate_of         uuid
  surveyor_id          uuid fk -> surveyor not null
  captured_at          timestamptz not null
  exported_at          timestamptz
  created_at / updated_at

survey_photo
  id            uuid pk
  survey_id     uuid fk -> hotel_survey on delete cascade
  r2_key        text not null          -- объектын түлхүүр (устгахад хэрэгтэй)
  public_url    text not null
  sha256        char(64)               -- ижил зураг дахин илгээхээс хамгаална
  bytes         int                    -- шахсаны дараах хэмжээ
  width / height int
  exif_lat      numeric(9,6)           -- зургийн GPS (арилгахаас өмнө уншсан)
  exif_lng      numeric(10,6)
  exif_taken_at timestamptz
  is_primary    bool not null default false
  created_at

geo_cache
  grid_key      text pk                -- "47.91890,106.91740" ~25м торонд бөөрөнхийлсөн
  address_text  text                   -- Nominatim reverse
  poi           jsonb                  -- Overpass-ийн буудлууд
  fetched_at    timestamptz not null
  -- OSM бол ODbL нээлттэй өгөгдөл → хугацаагүй хадгална, 30 хоногийн дараа
  -- зөвхөн шинэчлэхийг оролдоно (амжилтгүй бол хуучныг ашиглана)

audit_log
  id, actor_id, action, subject_id, ip, user_agent, detail jsonb, created_at
```

**DRAFT төлөв байхгүй** — алба хаагч шууд илгээх тул маягт зөвхөн клиент дээр
амьдарна. Сервер дээр мөр үүсэх = аль хэдийн SUBMITTED.

**Индекс:** `hotel_survey(status, created_at desc)` ·
`hotel_survey(surveyor_id, created_at desc)` ·
`hotel_survey(lat, lng)` — давхардлын bounding-box хайлт ·
`hotel_survey(osm_ref) WHERE osm_ref IS NOT NULL` ·
`gin(name_normalized gin_trgm_ops)` — нэрний ижилсэл.

**PostGIS хэрэггүй** — хэдэн мянган мөрөнд bounding box + Haversine хангалттай.

## 8. API (Next.js Route Handlers)

```
POST   /api/auth/login          badge_number + password → httpOnly cookie
POST   /api/auth/logout
GET    /api/auth/me

POST   /api/geo/lookup          {lat,lng} → { addressText, nearby[] }
                                манай DB + Overpass + Nominatim гурвыг нэгтгэнэ
                                кэштэй; хэрэглэгчид 60/цаг; глобал 1 дуудлага/сек

POST   /api/photos/upload-url   R2 presigned PUT URL олгоно (нэвтрэлт шалгана)

POST   /api/surveys             бүрэн бүртгэл + зургийн URL-ууд → SUBMITTED
                                client_uuid-аар idempotent
POST   /api/surveys/precheck    {lat,lng,name} → давхардлын анхааруулга
GET    /api/surveys             миний жагсаалт (ADMIN бол бүгд)
GET    /api/surveys/{id}

# ADMIN
GET    /api/admin/surveys        шүүлт: огноо, алба хаагч, давхардлын туг
DELETE /api/admin/surveys/{id}   алдаатай мөрийг устгах (audit-д бичигдэнэ)
GET    /api/admin/export?format=sql|json&since=
POST   /api/admin/surveyors
PATCH  /api/admin/surveyors/{id}

# Машин хэрэглэгч (x-api-key)
GET    /api/export/leads?since=&cursor=&limit=
```

## 9. Технологийн сонголт — бүгд үнэгүй

| Давхарга | Сонголт | Үнэгүй нөхцөл |
|---|---|---|
| Апп | **Next.js 16 (App Router)** | — |
| Хостинг | **Vercel Hobby** | Үнэгүй. ⚠ §13.6 — арилжааны хэрэглээний заалт |
| DB | **Neon Postgres** үнэгүй tier | 0.5 GB хадгалалт · autosuspend. ~5,000 мөрөнд хангалттай |
| ORM | **Drizzle** | SQL-д ойр, migration нь жинхэнэ SQL файл |
| Зураг | **Cloudflare R2** | **10 GB хадгалалт + egress ҮНЭГҮЙ**. Vercel Blob-оос хамаагүй өгөөмөр |
| Зураг шахах | `browser-image-compression` клиент дээр | 1600px / q0.8 → 4MB нь ~400KB болно |
| Газрын зураг | **Leaflet + OSM tile** | Үнэгүй. Google-гүй болсон тул ToS-ийн саад ч алга |
| Хаяг олох | **Nominatim** (reverse geocode) | Үнэгүй. 1 дуудлага/сек, кэшлэх, User-Agent заавал |
| Ойролцоох буудал | **Overpass API** | Үнэгүй. Боломжийн хэрэглээ, кэштэй |
| Auth | JWT (`jose`) httpOnly cookie + `bcryptjs` | — |
| Validation | Zod — клиент, сервер нэг схем | — |
| PWA | `next-pwa` | — |

**Нийт сарын зардал: $0** (домэйн авахгүй бол).

### Зургийн хэмжээний тооцоо

```
5,000 буудал × 2 зураг × ~400KB (шахсан)  =  ~4 GB
R2 үнэгүй хязгаар                          =  10 GB  ✅ багтана
Шахахгүй бол: 5,000 × 2 × 4MB = 40 GB      →  багтахгүй ❌
```

Тиймээс **клиент дээрх шахалт нь гоёл биш, зайлшгүй шаардлага**.

### Яагаад FastAPI биш вэ (өмнөх төслөөс салсан цэг)

Vercel сонгосон нь энэ шийдвэрийг тулгасан:
1. **4.5MB body хязгаар** — зураг заавал клиентээс шууд storage руу орно.
2. **Локал диск байхгүй** — SaaS-ийн `static/uploads/` загвар энд ажиллахгүй.
3. Python serverless-ийн cold start + connection pooling нэмэлт төвөг.

Гэхдээ **SQL болон өгөгдлийн загварын хэв маягийг** SaaS-тай тууштай барина
(uuid pk, `timestamptz`, CHECK constraint, enum) — хооронд нь ойлгоход хялбар.

## 10. Аюулгүй байдал

- JWT httpOnly + `Secure` + `SameSite=Lax` cookie, 12 цаг (нэг ээлж)
- `SURVEYOR` зөвхөн өөрийн мөрийг харна — **query-д хатуу шүүлт**, UI-д биш
- R2 presigned URL: нэвтэрсэн хэрэглэгчид, нэг объектод, 5 минут, PUT л зөвшөөрнө
- Зөвшөөрөгдөх зураг: `image/jpeg`, `image/png`, `image/webp`; дээд тал нь 10MB
- **EXIF-ийг уншаад арилгана** — зураг олон нийтэд нээлттэй URL-тэй тул
  алба хаагчийн утасны загвар, серийн дугаар зэрэг мэдээлэл гадагш гарахгүй
- Rate limit: login 5/мин/IP · upload-url 30/мин/хэрэглэгч ·
  survey 20/мин/хэрэглэгч · **geo/lookup 60/цаг/хэрэглэгч + глобал 1/сек**
- Бүх төлөв өөрчлөлт `audit_log`-д
- **Хувь хүний өгөгдөл хадгалахгүй** — РД, иргэний нэр огт байхгүй
- Экспортын API key тусдаа, эргүүлж болдог
- R2 URL таамаглашгүй (random түлхүүр) боловч нийтэд нээлттэй; §13.5

## 11. Чанарын хяналт (хяналтын шат байхгүй тул чангатгасан)

`POST /api/surveys` дээр дараалан шалгана:

1. **GPS нарийвчлал** > 100м → блок
2. **EXIF GPS** байгаа бол маягтын байршилтай харьцуул; > 150м зөрвөл → блок
3. **Давхардал — эхлээд `osm_ref`:**
   - ижил `osm_ref`-тэй мөр байвал → **бараг гарцаагүй давхардал**, блок
   - `osm_ref` байхгүй бол (гараар бичсэн — түгээмэл тохиолдол):
     - `lat/lng`-ийн ±75м bounding box-оос нэр дэвшигчдийг ав
     - Haversine-аар яг зай бод
     - `name_normalized` дээр trigram ижилсэл (`pg_trgm`)
     - зай < 75м **ба** ижилсэл > 0.45 → **боломжит давхардал**
     - зай < 25м → нэр өөр байсан ч анхааруулна (нэг барилга)
   - алба хаагч зурагтай нь харьцуулаад "өөр буудал мөн" гэвэл
     `duplicate_ack=true`, `duplicate_of=<id>` болж үргэлжилнэ — админ энэ
     тугаар шүүж хараад алдаатайг нь устгана
4. **Утас** `^[7-9][0-9]{7}$`; ижил утас өөр буудалд байвал анхааруулна
5. **Зураг** ≥1

## 12. Фазууд

| Фаз | Агуулга | Гарц |
|---|---|---|
| **0** | Next.js репо, Drizzle схем, Neon холболт, `/api/health`, Vercel deploy | Vercel URL дээр `{"ok":true}` |
| **1** | Auth: login, cookie, middleware, seed script | Утаснаас badge-ээр нэвтэрнэ |
| **2** | Зураг: R2 presigned URL + клиент шахалт + EXIF унших/арилгах | Утасны зураг ~400KB болж R2 дээр буулаа |
| **3** | Маягт: камер, GPS, **[📍] geo/lookup**, Leaflet цэг, Zod | Нэг товчоор хаяг бөглөгдөж, бүртгэл SUBMITTED |
| **4** | Давхардал + чанарын шалгалт (§11) | Хог өгөгдөл блоклогдоно, тесттэй |
| **5** | Админ дэлгэц: жагсаалт, шүүлт, устгах, алба хаагч удирдах | Админ бүх зургийг хараад цэгцэлнэ |
| **6** | Экспорт: `.sql` + JSON API + SaaS талын миграци | SaaS-д `psql -f` хийхэд lead орно |

Phase 0–3 нь **ашиглаж болох бүтээгдэхүүн**. 4–6 нь чанар, ашиглалтыг гүйцээнэ.

## 13. Анхаарах зүйлс

1. **Оффлайн:** эцэслэн ОРОХГҮЙ *(шийдэгдсэн)*. `client_uuid` талбар үлдэнэ.

2. **OSM-ийн хамрах хүрээ — гол хязгаарлалт.** УБ-ын томоохон буудлууд OSM-д
   байгаа ч жижиг зочид байр/гэст хаусны олонх нь байхгүй. Тиймээс:
   - "нэрийг гараар бичих" сонголт **тод, хялбар** байрлана
   - хаяг (Nominatim) харин найдвартай ажиллана — гол хүсэлт хангагдана
   - манай өөрийн DB нь цаг хугацаа өнгөрөх тусам хамгийн сайн эх сурвалж
     болж өснө (бүртгэсэн буудал бүр дараагийн хүнд харагдана)

3. **Nominatim / Overpass-ийн хэрэглээний нөхцөл** — заавал баримтална:
   - **Nominatim: секундэд 1-ээс илүү дуудлага хийхгүй.** Манай серверийн
     дундуур л явдаг тул глобал дараалал (queue) тавьж хангана
   - **User-Agent-д аппын нэр + холбоо барих имэйл** заавал бичнэ
   - үр дүнг **кэшлэх шаардлагатай** (`geo_cache`) — олноор нь bulk хийхгүй
   - **Attribution:** газрын зураг болон хаяг харуулсан газарт
     "© OpenStreetMap contributors" гэж заавал харуулна (ODbL шаардлага)
   - хэрэглээ ихсэх юм бол өөрийн Nominatim/Overpass суулгах хувилбар нээлттэй
     (үнэгүй програм хангамж, зөвхөн сервер хэрэгтэй)

4. **Google Maps линк буулгах** нь үлдэж байна — гэхдээ энэ нь ямар ч API
   дуудахгүй, зүгээр л URL-аас координат сугалж авдаг parse. Төлбөргүй.
   *(`maps.app.goo.gl` богино линк нь redirect дагах шаардлагатай — энэ нь
   энгийн HTTP GET, API биш.)*

5. **Зургийн нууцлал:** R2 нийтэд нээлттэй URL өгнө. Гаднах фасадын зураг тул
   асуудалгүй гэж үзэв; EXIF арилгасан. Хаалттай байх шаардлагатай бол
   зургийг `/api/photos/{id}` дундуур нэвтрэлт шалгаж дамжуулна (нэмэлт ажил).

6. **⚠ Vercel Hobby нь арилжааны бус хэрэглээнд зориулагдсан.** Албан
   байгууллагын систем үүнд хамаарах эсэх нь тодорхойгүй — Vercel-ийн
   нөхцөлийг шалгах хэрэгтэй. Асуудал гарвал үнэгүй хувилбарууд:
   **Cloudflare Pages/Workers** (өгөөмөр үнэгүй tier, арилжааны хэрэглээ
   зөвшөөрөгддөг) эсвэл өөрийн сервер дээр. Кодыг нэг тодорхой платформд
   хатуу уяхгүй бичнэ (стандарт Next.js) — шилжих шаардлага гарвал хялбар.

7. **Хэмжээ:** ~5,000 буудал гэж тооцов. Neon 0.5 GB, R2 10 GB — багтана.

8. **Домэйн:** `*.vercel.app` HTTPS-тэй тул камер/GPS ажиллана. Албан ёсны
   домэйн нь цорын ганц төлбөртэй зүйл байх магадлалтай (жилд ~$10) — заавал биш.

## 14. Хөгжүүлэлтийн орчны онцлог

- `.env.local`:
  ```
  POSTGRES_URL=                  # Neon
  R2_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  R2_BUCKET=
  R2_PUBLIC_BASE_URL=            # r2.dev эсвэл өөрийн домэйн
  JWT_SECRET=
  EXPORT_API_KEY=
  GEO_USER_AGENT=                # "HotelSurvey/1.0 (имэйл)" — Nominatim шаардана
  ```
- **API түлхүүр огт хэрэггүй** — OSM үйлчилгээнүүд бүртгэлгүй ажилладаг.
  Тиймээс клиент дээр задрах нууц ч байхгүй.
- R2 нь S3-тэй нийцтэй → `@aws-sdk/client-s3` ашиглана.
- Локал DB: Neon-ы dev branch (docker хэрэггүй, production-тай ижил).
- Nominatim-ийг локал хөгжүүлэлтэд ч 1/сек-ээр л дуудна — кэш эхнээсээ ажиллана.
