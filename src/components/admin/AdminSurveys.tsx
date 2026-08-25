"use client";

/**
 * Админы үндсэн дэлгэц — бүх бүртгэлийг хараад цэгцлэх.
 *
 * Ахлагчийн урьдчилсан хяналт байхгүй тул админы ажил бол ЭРГЭЖ ХАРАХ.
 * Хамгийн чухал шүүлт нь "давхардлын тугтай" — алба хаагч анхааруулгыг
 * давсан мөрүүд. Тэдгээр нь буруу байх магадлал хамгийн өндөр.
 */
import { useCallback, useEffect, useState } from "react";

import { formatDateTime } from "@/lib/format";

type Survey = {
  id: string;
  name: string;
  phone: string;
  address_text: string | null;
  lat: number;
  lng: number;
  status: "SUBMITTED" | "EXPORTED" | "DELETED";
  location_source: string;
  accuracy_m: number | null;
  duplicate_ack: boolean;
  osm_ref: string | null;
  note: string | null;
  created_at: string;
  surveyor: { badge: string; name: string };
  photos: string[];
};

type Surveyor = { id: string; badge_number: string; full_name: string };

/**
 * Дүрсүүдийг inline SVG-ээр — зөвхөн хоёр дүрсний төлөө сан нэмэх нь
 * bundle-д илүүц жин. `currentColor` ашигласан тул товчны өнгийг дагана.
 */
function MapIcon() {
  return (
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
  );
}

function TrashIcon() {
  return (
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
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function RestoreIcon() {
  return (
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
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

/**
 * Байршил хэрхэн тогтоогдсоныг хүн уншихаар илэрхийлнэ.
 *
 * Түүхий enum (`OSM_POI`, `MAP_PIN`) нь схемийн нэр — админд юу ч хэлэхгүй.
 * Харин "автоматаар орсон уу, гараар бичсэн үү" гэдэг нь чанарын шууд
 * дохио: автоматаар орсон нэр, координат нь албан ёсны эх сурвалжаас ирсэн
 * тул алдах магадлал бага.
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

/** Шошготой жижиг мэдээлэл — "утга" нь тайлбаргүй бол уншигдахгүй. */
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-slate-400">{label}:</span>{" "}
      <span className="text-slate-600">{value}</span>
    </span>
  );
}

export function AdminSurveys({ surveyors }: { surveyors: Surveyor[] }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [surveyorId, setSurveyorId] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (surveyorId) params.set("surveyor_id", surveyorId);
      if (flagged) params.set("flagged", "1");
      if (showDeleted) params.set("status", "DELETED");

      const response = await fetch(`/api/admin/surveys?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Уншиж чадсангүй.");
      setSurveys(body.surveys);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [q, surveyorId, flagged, showDeleted]);

  useEffect(() => {
    // Бичиж байхад query бүрт хандахгүй — бичиж дуусахыг хүлээнэ.
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  async function setStatus(id: string, status: "DELETED" | "SUBMITTED") {
    const reason =
      status === "DELETED"
        ? (prompt("Устгах шалтгаан (заавал биш):") ?? undefined)
        : undefined;
    const response = await fetch(`/api/admin/surveys/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, reason }),
    });
    if (response.ok) void load();
    else setError("Төлөв өөрчилж чадсангүй.");
  }

  return (
    <div className="space-y-4">
      {/* Шүүлтүүд ------------------------------------------------------- */}
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Нэрээр хайх…"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <select
          value={surveyorId}
          onChange={(event) => setSurveyorId(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2"
        >
          <option value="">Бүх алба хаагч</option>
          {surveyors.map((person) => (
            <option key={person.id} value={person.id}>
              {person.badge_number} — {person.full_name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={flagged}
            onChange={(event) => setFlagged(event.target.checked)}
          />
          Зөвхөн давхардлын тугтай
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(event) => setShowDeleted(event.target.checked)}
          />
          Устгасныг харах
        </label>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      <p className="text-sm text-slate-500">
        {loading ? "Ачаалж байна…" : `${surveys.length} бүртгэл`}
      </p>

      {/* Жагсаалт -------------------------------------------------------- */}
      <ul className="space-y-4">
        {surveys.map((survey) => (
          <li
            key={survey.id}
            className={`overflow-hidden rounded-xl border bg-white ${
              survey.duplicate_ack ? "border-amber-400" : "border-slate-200"
            }`}
          >
            {/* --- Зургууд: хэвтээ гүйлгэх ---------------------------------
                Бүх зургийг харуулна (өмнө нь 2-оор таслаж байсан). Утсан
                дээр хуруугаараа шудрахад `snap` нь зураг бүрийг цэгцтэй
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
              {/* --- Нэр ба үндсэн мэдээлэл ---------------------------- */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{survey.name}</h3>
                  {survey.duplicate_ack ? (
                    <span
                      className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                      title="Алба хаагч давхардлын анхааруулгыг давсан"
                    >
                      давхардлын туг
                    </span>
                  ) : null}
                  {survey.status === "DELETED" ? (
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium">
                      устгасан
                    </span>
                  ) : null}
                  <SourceBadge
                    source={survey.location_source}
                    osmRef={survey.osm_ref}
                  />
                </div>

                <p className="mt-0.5 text-slate-700">{survey.phone}</p>
                {survey.note ? (
                  <p className="mt-1 text-sm text-slate-500">✎ {survey.note}</p>
                ) : null}
              </div>

              {/* --- Техникийн мэдээлэл --------------------------------
                  Өмнө нь бүгд нэг мөрөнд цэгээр тусгаарлагдаж, ямар тоо
                  юуг илэрхийлж байгаа нь ойлгомжгүй байсан. Шошготой
                  болгосон. */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs">
                {/* Хаяг байхгүй бол координатыг харуулна — хоосон
                    үлдээвэл админ энэ мөрийг алдаа гэж эндүүрнэ. */}
                <Meta
                  label="Байршил"
                  value={
                    survey.address_text ??
                    `${survey.lat.toFixed(5)}, ${survey.lng.toFixed(5)}`
                  }
                />
                {survey.accuracy_m !== null ? (
                  <Meta label="Нарийвчлал" value={`±${survey.accuracy_m}м`} />
                ) : null}
                <Meta label="Алба хаагч" value={survey.surveyor.badge} />
                <Meta
                  label="Бүртгэсэн"
                  value={formatDateTime(survey.created_at)}
                />
              </div>

              {/* --- Үйлдлүүд ------------------------------------------ */}
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://www.openstreetmap.org/?mlat=${survey.lat}&mlon=${survey.lng}#map=19/${survey.lat}/${survey.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-100"
                >
                  <MapIcon />
                  Газрын зураг
                </a>

                {survey.status === "DELETED" ? (
                  <button
                    type="button"
                    onClick={() => void setStatus(survey.id, "SUBMITTED")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 active:bg-green-100"
                  >
                    <RestoreIcon />
                    Сэргээх
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void setStatus(survey.id, "DELETED")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 active:bg-red-100"
                  >
                    <TrashIcon />
                    Устгах
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
