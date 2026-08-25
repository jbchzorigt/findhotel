# Production-д гаргах

## 0. Эхлэхийн өмнө — нэг заавал хийх зүйл

> ⚠ **Neon-ийн нууц үгээ солино уу.**
>
> Хөгжүүлэлтийн явцад холболтын мөр чат/терминалын түүхэнд орсон.
> Локал дээр асуудалгүй байсан ч production-д тэр DB нь бодит бүртгэл
> хадгална.
>
> Neon Console → project → **Roles** → `neondb_owner` → **Reset password**
> → шинэ мөрийг `.env.local` болон Vercel-ийн орчны хувьсагчид тавина.

---

## 1. Бүсийн сонголт (аль хэдийн шийдэгдсэн)

| Юу | Бүс | Код |
|---|---|---|
| Neon Postgres | AWS Asia Pacific (Singapore) | `aws-ap-southeast-1` |
| Cloudflare R2 | Asia-Pacific | `APAC` |
| Vercel функц | Singapore | `sin1` (`vercel.json`-д бэхлэгдсэн) |

**Гурвуулаа ижил бүсэд байх нь чухал.** Vercel-ийн анхны утга нь `iad1`
(Вашингтон) — тэгвэл API хүсэлт бүрийн query нэг бүр Номхон далайг хоёр удаа
гатална. Хэрэглэгчээс функц хүртэлх зайг НЭГ л удаа төлдөг бол, функцээс DB
хүртэлх зайг **query бүрт** төлнө.

> Neon-д Токиогийн бүс байхгүй (2026-08 байдлаар AWS-ийн Ази-Номхон далайн
> сонголт нь Сингапур, Сидней хоёр). **Neon дээр бүсийг дараа өөрчилж
> БОЛОХГҮЙ** — өөрчлөх бол шинэ project үүсгээд өгөгдлөө нүүлгэнэ.

---

## 2. Cloudflare R2 (зургийн хадгалалт)

<https://dash.cloudflare.com> → **R2**

1. **Bucket үүсгэх**
   - Нэр: `hotel-survey-photos`
   - Байршил: **APAC**

2. **Нийтэд харагдах хаяг өгөх**
   - Bucket → Settings → **Public Development URL** → Enable
   - `https://pub-xxxxx.r2.dev` гэсэн хаяг гарна — үүнийг `R2_PUBLIC_BASE_URL`-д тавина
   - *(Албан ёсны домэйнтэй бол Custom Domain холбож болно)*

3. **API токен**
   - R2 → **Manage API Tokens** → Create API Token
   - Эрх: **Object Read & Write**, зөвхөн энэ bucket-д
   - Гарч ирэх **Access Key ID** болон **Secret Access Key**-г хуулж авна
     *(Secret нь нэг л удаа харагдана)*
   - **Account ID** нь самбарын баруун талд байна

**Үнэгүй хязгаар:** 10 GB хадгалалт, egress төлбөргүй. Шахсан зураг ~70–400KB
тул 5,000 буудал × 2 зураг ≈ 1–4 GB — тухтай багтана.

---

## 3. Vercel

<https://vercel.com> → **Add New → Project** → `jbchzorigt/findhotel` импортлох

**Framework:** Next.js (автоматаар танина). Build тохиргоог өөрчлөх шаардлагагүй.

### Орчны хувьсагчид

Settings → Environment Variables → **Production** (мөн Preview-д хүсвэл):

| Түлхүүр | Утга |
|---|---|
| `POSTGRES_URL` | Neon-ий **шинэ** connection string (§0-ыг үз) |
| `JWT_SECRET` | Доорх командаар өөрөө үүсгэнэ |
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 API токеноос |
| `R2_SECRET_ACCESS_KEY` | R2 API токеноос |
| `R2_BUCKET` | `hotel-survey-photos` |
| `R2_PUBLIC_BASE_URL` | `https://pub-xxxxx.r2.dev` |
| `GEO_USER_AGENT` | `HotelFieldSurvey/1.0 (таны-имэйл)` |
| `EXPORT_API_KEY` | Phase 6-д хэрэгтэй — одоохондоо хоосон байж болно |

```bash
openssl rand -base64 48
```

> **`R2_ENDPOINT`-ийг production-д ТАВИХГҮЙ.** Тэр нь зөвхөн локал MinIO-д
> зориулагдсан. Тавибал апп бодит R2 руу биш, тэр хаяг руу хандахыг оролдоно.

Deploy дарна. `vercel.json` нь функцыг `sin1`-д бэхэлнэ — эхний deploy-ийн
дараа Settings → Functions хэсэгт Singapore гэж харагдаж байгааг шалгаарай.

---

## 4. Өгөгдлийн санг бэлдэх

Миграцийг **локал дээрээс** production DB рүү тавина (Vercel build дээр
миграци ажиллуулахгүй — build бүрт схем өөрчлөгдөх нь эрсдэлтэй):

```bash
npm run db:migrate
```

`.env.local` дахь `POSTGRES_URL` нь production-ийхтэй ижил байх ёстой.

---

## 5. Эхний админ

```bash
npm run seed -- --badge A-1001 --name "Овог Нэр" --unit "Хэлтэс" --role ADMIN
```

Үүний дараа бусад алба хаагчийг **`/admin/surveyors`** дэлгэцээс нэмнэ —
систем түр нууц үг үүсгэж нэг удаа харуулна.

---

## 6. Deploy-ийн дараах шалгалт

```
https://<домэйн>/api/health     →  {"ok":true,"db":"up"}
https://<домэйн>/login          →  нэвтэрнэ
https://<домэйн>/               →  [📍] дарж хаяг гарч ирэх
                                →  зураг дарж илгээх
https://<домэйн>/admin          →  бүртгэл болон зураг харагдах
```

**Утаснаас заавал турших ёстой зүйлс** (компьютер дээр илэрдэггүй):
- Камер нээгдэж байна уу (`capture="environment"`)
- Байршлын зөвшөөрөл асууж байна уу
- Гадаа, нарны гэрэлд дэлгэц уншигдаж байна уу
- "Нүүр хуудсанд нэмэх" (Add to Home Screen) ажиллаж байна уу

---

## 7. Мэдэж байх зүйлс

**Neon үнэгүй tier ажилгүй үед унтардаг.** Өдрийн эхний хүсэлт ~500мс удаан
байх нь хэвийн — алдаа биш.

**Vercel Hobby нь арилжааны бус хэрэглээнд зориулагдсан.** Албан
байгууллагын систем үүнд хамаарах эсэх тодорхойгүй тул Vercel-ийн нөхцөлийг
шалгаарай. Асуудал гарвал код нь стандарт Next.js тул **Cloudflare
Pages/Workers** руу шилжихэд хялбар.

**Апп хайлтын системд индексжихгүй** — `robots.txt` болон `X-Robots-Tag:
noindex` хоёулаа тавигдсан.

**Nominatim/Overpass-ийн хэрэглээний нөхцөл** — `GEO_USER_AGENT` дотор
БОДИТ холбоо барих имэйл байх ёстой. Үүнгүй бол IP хоригдож, Vercel дээр тэр
IP бусад хэрэглэгчидтэй хуваалцдаг.

**Зураг нийтэд нээлттэй URL-тэй.** Гаднах фасадын зураг тул хүлээн
зөвшөөрөгдөнө гэж үзсэн; EXIF нь шахалтын үед арилдаг. Хаалттай байх
шаардлага гарвал зургийг нэвтрэлт шалгасан route дундуур дамжуулна.

---

## Локал хөгжүүлэлт (production-д нөлөөлөхгүй)

```bash
docker compose up -d && npm run storage:init   # MinIO — R2-ийн орлуулагч
npm run dev
```

`.env.local` дотор `R2_ENDPOINT=http://localhost:9100` байвал апп MinIO
руу хандана.
