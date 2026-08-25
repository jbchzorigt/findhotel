# Hotel Field Survey

Цагдаагийн алба хаагч талбар дээр гар утсаараа зочид буудлын гаднах зургийг
дарж, нэр, утас, байршлыг тэмдэглэдэг PWA. Цуглуулсан бүртгэл Hotel SaaS руу
шууд `INSERT` хийхэд бэлэн SQL болж экспортлогдоно.

📄 **Бүрэн тодорхойлолт: [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)**

## Одоогийн байдал

| Фаз | Агуулга | Төлөв |
|---|---|---|
| 0 | Репо, Drizzle схем, Neon холболт, `/api/health` | ✅ дууссан |
| 1 | Нэвтрэлт (badge + нууц үг), seed script | ✅ дууссан |
| 2 | Зураг: R2 upload, клиент шахалт, EXIF | ✅ дууссан |
| 3 | Маягт: камер, GPS, `[📍]` хаяг олох, Leaflet | ⏳ дараагийнх |
| 4 | Давхардал + чанарын шалгалт | — |
| 5 | Админ дэлгэц | — |
| 6 | Экспорт (`.sql`) + Hotel SaaS талын миграци | — |

## Эхлүүлэх

```bash
npm install
cp .env.example .env.local     # POSTGRES_URL-ээ бөглөнө
npm run db:migrate             # хүснэгтүүдийг үүсгэнэ
npm run dev
```

Шалгах: <http://localhost:3000/api/health> →

```json
{ "ok": true, "db": "up", "latencyMs": 42, "time": "..." }
```

`POSTGRES_URL` бөглөөгүй бол `"db": "not_configured"` гэж буцаана — апп ажиллана.

## Скриптүүд

| Команд | Үйлдэл |
|---|---|
| `npm run dev` | Хөгжүүлэлтийн сервер |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript шалгалт |
| `npm run lint` | ESLint |
| `npm run db:generate` | Схемийн өөрчлөлтөөс SQL миграци үүсгэх |
| `npm run db:migrate` | Миграцийг DB рүү тавих |
| `npm run db:studio` | Drizzle Studio — өгөгдлийг нүдээр харах |
| `npm run seed` | Алба хаагч үүсгэх / нууц үг сэргээх |
| `npm run storage:init` | Локал MinIO дээр bucket бэлдэх |

> `db:push`-ыг зөвхөн туршилтын DB дээр хэрэглэ. Production-д үргэлж
> `db:generate` → файлыг нь хянаж уншаад → `db:migrate`.

## Алба хаагч үүсгэх

```bash
npm run seed -- --badge A-1001 --name "Батын Болд" --unit "СБД" --role ADMIN
```

Нууц үгийг тушаалын мөрөнд бичихгүй — далдаар асууна (shell-ийн түүх, `ps`
дээр харагдахаас сэргийлнэ). Нууц үг сэргээх:

```bash
npm run seed -- --badge A-1001 --reset-password
```

## Зургийн хадгалалтыг локал дээр турших

Cloudflare данс байхгүй ч зургийн урсгалыг бүрэн туршиж болно — R2 нь
S3-нийцтэй тул MinIO яг ижил кодоор ажиллана:

```bash
docker compose up -d && npm run storage:init
```

Дараа нь `.env.local` дотор `R2_ENDPOINT=http://localhost:9100` болон
`docker-compose.yml`-д бичсэн түлхүүрүүдийг тавина.

## Гадаад үйлчилгээ — бүгд үнэгүй

| Юу | Хаана | Үнэгүй хязгаар |
|---|---|---|
| Postgres | [Neon](https://neon.tech) | 0.5 GB |
| Зураг | [Cloudflare R2](https://developers.cloudflare.com/r2/) | 10 GB + egress үнэгүй |
| Хаяг олох | [Nominatim](https://nominatim.org) | 1 дуудлага/сек, User-Agent заавал |
| Ойролцоох буудал | [Overpass](https://overpass-api.de) | боломжийн хэрэглээ |
| Газрын зураг | OSM tile + Leaflet | боломжийн хэрэглээ |

**API түлхүүр огт хэрэггүй** — OSM үйлчилгээнүүд бүртгэлгүй ажилладаг.
Neon болон R2 хоёрт данс хэрэгтэй ч карт шаардахгүй.

## Өгөгдлийн санг үүсгэх заавар

1. <https://console.neon.tech> дээр данс нээж, шинэ project үүсгэнэ
2. Connection string-ийг хуулж `.env.local`-ийн `POSTGRES_URL`-д тавина
3. `npm run db:migrate`

Миграци нь `pg_trgm` өргөтгөлийг өөрөө үүсгэнэ (нэрний ижилсэл хайхад
шаардлагатай) — Neon дээр энэ өргөтгөл боломжтой.
