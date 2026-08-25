"use client";

/**
 * Админы үндсэн дэлгэц — бүх бүртгэлийг хараад цэгцлэх.
 *
 * Ахлагчийн урьдчилсан хяналт байхгүй тул админы ажил бол ЭРГЭЖ ХАРАХ.
 * Хамгийн чухал шүүлт нь "давхардлын тугтай" — алба хаагч анхааруулгыг
 * давсан мөрүүд. Тэдгээр нь буруу байх магадлал хамгийн өндөр.
 */
import { useCallback, useEffect, useState } from "react";

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
      <ul className="space-y-3">
        {surveys.map((survey) => (
          <li
            key={survey.id}
            className={`rounded-lg border bg-white p-3 ${
              survey.duplicate_ack ? "border-amber-400" : "border-slate-200"
            }`}
          >
            <div className="flex gap-3">
              <div className="flex shrink-0 gap-1">
                {survey.photos.slice(0, 2).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={survey.name}
                    className="h-20 w-20 rounded object-cover"
                  />
                ))}
                {survey.photos.length === 0 ? (
                  <div className="flex h-20 w-20 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                    зураггүй
                  </div>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {survey.name}
                  {survey.duplicate_ack ? (
                    <span
                      className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
                      title="Алба хаагч давхардлын анхааруулгыг давсан"
                    >
                      давхардлын туг
                    </span>
                  ) : null}
                  {survey.status === "DELETED" ? (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">
                      устгасан
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-slate-600">{survey.phone}</p>
                {survey.address_text ? (
                  <p className="text-sm text-slate-500">{survey.address_text}</p>
                ) : null}
                {survey.note ? (
                  <p className="text-sm text-slate-500">✎ {survey.note}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-400">
                  {survey.surveyor.badge} · {survey.location_source}
                  {survey.accuracy_m !== null ? ` ±${survey.accuracy_m}м` : ""}
                  {survey.osm_ref ? ` · ${survey.osm_ref}` : ""} ·{" "}
                  {new Date(survey.created_at).toLocaleString("mn-MN")}
                </p>
              </div>
            </div>

            <div className="mt-2 flex gap-3 text-sm">
              <a
                href={`https://www.openstreetmap.org/?mlat=${survey.lat}&mlon=${survey.lng}#map=19/${survey.lat}/${survey.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                газрын зураг
              </a>
              {survey.status === "DELETED" ? (
                <button
                  type="button"
                  onClick={() => void setStatus(survey.id, "SUBMITTED")}
                  className="text-green-700 underline"
                >
                  сэргээх
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void setStatus(survey.id, "DELETED")}
                  className="text-red-600 underline"
                >
                  устгах
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
