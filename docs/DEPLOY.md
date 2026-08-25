# Deploy — бүсийн сонголт ба алхмууд

## Бүс: Сингапур, хоёр талдаа

| Юу | Бүс | Код |
|---|---|---|
| Neon Postgres | AWS Asia Pacific (Singapore) | `aws-ap-southeast-1` |
| Vercel функц | Singapore | `sin1` (`vercel.json`-д бэхлэгдсэн) |

**Хоёулаа ижил бүсэд байх нь чухал.** Vercel-ийн анхны утга нь `iad1`
(Вашингтон) — тэгвэл API хүсэлт бүрийн query нэг бүр Номхон далайг хоёр удаа
гатална. Хэрэглэгчээс функц хүртэлх зайг нэг л удаа төлдөг бол, функцээс DB
хүртэлх зайг **query бүрт** төлнө.

**Neon-д Токиогийн бүс байхгүй** (2026-08 байдлаар AWS-ийн Ази-Номхон далайн
сонголт нь Сингапур, Сидней хоёр). Сингапур нь УБ-аас хамгийн ойр нь.

> ⚠ **Neon дээр бүсийг дараа өөрчилж БОЛОХГҮЙ.** Өөрчлөх бол шинэ project
> үүсгээд өгөгдлөө нүүлгэнэ. Тиймээс эхнээсээ зөв сонгох хэрэгтэй.

Статик хуудас, зураг нь Vercel-ийн дэлхийн CDN-ээс үйлчлэгдэх тул бүсээс
хамаарахгүй — зөвхөн `/api/*` замууд л энэ шийдвэрт хамаатай.

## Алхмууд

1. **Neon** — <https://console.neon.tech> → шинэ project
   - Region: **AWS Asia Pacific (Singapore)**
   - Postgres хувилбар: анхны утга (17) тохирно
   - Connection string хуулж авах

2. **Локал**
   ```bash
   cp .env.example .env.local     # POSTGRES_URL бөглөнө
   npm run db:migrate
   npm run dev                    # /api/health → {"db":"up"}
   ```

3. **Cloudflare R2** *(Phase 2-оос)* — <https://dash.cloudflare.com> → R2
   - Bucket үүсгэнэ, API token авна
   - Bucket-ийн байршил: **APAC** сонгоно

4. **Vercel**
   - GitHub repo холбоно → Import
   - Environment Variables: `POSTGRES_URL` (болон дараа R2, `JWT_SECRET`)
   - Deploy

   `vercel.json` дахь `regions` нь функцыг `sin1`-д бэхэлнэ. Vercel-ийн
   project settings → Functions хэсэгт бүс нь Singapore гэж харагдаж байгаа
   эсэхийг эхний deploy-ийн дараа шалгаарай. Hobby багц нэг бүс сонгохыг
   зөвшөөрдөг; хэрэв тохиргоо биелэхгүй бол settings-ээс гараар сонго.

## Хурдны бодит хүлээлт

| Зам | Ойролцоо |
|---|---|
| УБ → Vercel Singapore | ~100–180мс (Монголын гадаад транзитаас хамаарна) |
| Vercel `sin1` → Neon Singapore | ~1–5мс ✅ |
| Neon үнэгүй tier-ийн сэрэх хугацаа | ~500мс (5 мин зогссоны дараа) |

Neon-ий үнэгүй tier нь ажилгүй үед унтардаг. Талбарын ажил тасалдалтай тул
өдрийн эхний хүсэлт удаан байж магадгүй — энэ нь хэвийн.
