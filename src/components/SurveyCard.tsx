/**
 * Бүртгэлийн карт — "Бүх бүртгэл" болон "Миний бүртгэл" ХОЁУЛАА үүнийг
 * ашиглана.
 *
 * Хоёр хуудас тус тусдаа зохион байгуулалттай байвал хэзээ нэгэн цагт
 * зөрдөг: нэг нь зураг харуулж, нөгөө нь харуулахгүй; нэг нь огноог нэг
 * хэлбэрээр, нөгөө нь өөрөөр. Нэг эх сурвалж байвал тэр зөрүү үүсэхгүй.
 *
 * Клиент талын JS шаардахгүй — зураг гүйлгэх нь CSS, холбоосууд нь энгийн
 * `<a>`. Тиймээс серверийн компонентоос ч, клиентийн компонентоос ч
 * дуудагдана. Админы үйлдлүүд (устгах/сэргээх) нь `actions`-оор гаднаас
 * орж ирнэ.
 */
import type { ReactNode } from "react";

import { formatDateTime } from "@/lib/format";

export type SurveyCardData = {
  id: string;
  name: string;
  phone: string;
  addressText: string | null;
  lat: number;
  lng: number;
  status: "SUBMITTED" | "EXPORTED" | "DELETED";
  locationSource: string;
  accuracyM: number | null;
  osmRef: string | null;
  duplicateAck: boolean;
  note: string | null;
  createdAt: string;
  photos: string[];
  /** Зөвхөн админы жагсаалтад — өөрийн бүртгэл дээр илүүц. */
  surveyorBadge?: string;
};

/**
 * Байршил хэрхэн тогтоогдсоныг хүн уншихаар илэрхийлнэ.
 *
 * Түүхий enum (`OSM_POI`, `MAP_PIN`) нь схемийн нэр — хэрэглэгчид юу ч
 * хэлэхгүй. Харин "автоматаар орсон уу, гараар бичсэн үү" гэдэг нь чанарын
 * шууд дохио: автоматаар орсон нэр, координат нь албан ёсны эх сурвалжаас
 * ирсэн тул алдах магадлал бага.
 */
const LOCATION_SOURCE: Record<string, { label: string; auto: boolean }> = {
  OSM_POI: { label: "OSM-ээс автоматаар", auto: true },
  GPS: { label: "GPS-ээр, нэрийг гараар", auto: false },
  MAP_PIN: { label: "Газрын зураг дээр гараар", auto: false },
  MAPS_LINK: { label: "Линкээс", auto: false },
};

function SourceBadge({
  source,
  osmRef,
}: {
  source: string;
  osmRef: string | null;
}) {
  const info = LOCATION_SOURCE[source] ?? { label: source, auto: false };
  return (
    <span
      title={osmRef ? `OSM объект: ${osmRef}` : undefined}
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        info.auto ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"
      }`}
    >
      {info.auto ? "◆ " : "✎ "}
      {info.label}
    </span>
  );
}

/** Шошготой жижиг мэдээлэл — утга нь тайлбаргүй бол уншигдахгүй. */
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-slate-400">{label}:</span>{" "}
      <span className="text-slate-600">{value}</span>
    </span>
  );
}

export function SurveyCard({
  survey,
  actions,
}: {
  survey: SurveyCardData;
  actions?: ReactNode;
}) {
  return (
    <li
      className={`overflow-hidden rounded-xl border bg-white ${
        survey.duplicateAck ? "border-amber-400" : "border-slate-200"
      }`}
    >
      {/* --- Зургууд: хэвтээ гүйлгэх ------------------------------------
          Утсан дээр хуруугаараа шудрахад `snap` нь зураг бүрийг цэгцтэй
          зогсооно. */}
      {survey.photos.length > 0 ? (
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto p-2">
          {survey.photos.map((url, index) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 snap-start"
              title="Томруулж харах"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${survey.name} — зураг ${index + 1}`}
                className="h-44 w-64 rounded-lg bg-slate-100 object-cover"
              />
            </a>
          ))}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center bg-slate-50 text-sm text-slate-400">
          зураггүй
        </div>
      )}

      <div className="space-y-3 px-3 pb-3 pt-1">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{survey.name}</h3>
            {survey.duplicateAck ? (
              <span
                className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                title="Давхардлын анхааруулгыг давсан"
              >
                давхардлын туг
              </span>
            ) : null}
            {survey.status === "DELETED" ? (
              <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium">
                устгасан
              </span>
            ) : null}
            <SourceBadge source={survey.locationSource} osmRef={survey.osmRef} />
          </div>

          <p className="mt-0.5 text-slate-700">{survey.phone}</p>
          {survey.note ? (
            <p className="mt-1 text-sm text-slate-500">✎ {survey.note}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs">
          {/* Хаяг байхгүй бол координатыг харуулна — хоосон үлдээвэл
              энэ мөрийг алдаа гэж эндүүрнэ. */}
          <Meta
            label="Байршил"
            value={
              survey.addressText ??
              `${survey.lat.toFixed(5)}, ${survey.lng.toFixed(5)}`
            }
          />
          {survey.accuracyM !== null ? (
            <Meta label="Нарийвчлал" value={`±${survey.accuracyM}м`} />
          ) : null}
          {survey.surveyorBadge ? (
            <Meta label="Алба хаагч" value={survey.surveyorBadge} />
          ) : null}
          <Meta label="Бүртгэсэн" value={formatDateTime(survey.createdAt)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`https://www.openstreetmap.org/?mlat=${survey.lat}&mlon=${survey.lng}#map=19/${survey.lat}/${survey.lng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-100"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z" />
              <path d="M9 3v15M15 6v15" />
            </svg>
            Газрын зураг
          </a>
          {actions}
        </div>
      </div>
    </li>
  );
}
