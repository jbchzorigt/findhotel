"use client";

/**
 * Админы үндсэн дэлгэц — бүх бүртгэлийг хараад цэгцлэх.
 *
 * Ахлагчийн урьдчилсан хяналт байхгүй тул админы ажил бол ЭРГЭЖ ХАРАХ.
 * Хамгийн чухал шүүлт нь "давхардлын тугтай" — алба хаагч анхааруулгыг
 * давсан мөрүүд. Тэдгээр нь буруу байх магадлал хамгийн өндөр.
 */
import { useCallback, useEffect, useState } from "react";

import { SurveyCard } from "@/components/SurveyCard";

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
          <SurveyCard
            key={survey.id}
            survey={{
              id: survey.id,
              name: survey.name,
              phone: survey.phone,
              addressText: survey.address_text,
              lat: survey.lat,
              lng: survey.lng,
              status: survey.status,
              locationSource: survey.location_source,
              accuracyM: survey.accuracy_m,
              osmRef: survey.osm_ref,
              duplicateAck: survey.duplicate_ack,
              note: survey.note,
              createdAt: survey.created_at,
              photos: survey.photos,
              surveyorBadge: survey.surveyor.badge,
            }}
            actions={
              survey.status === "DELETED" ? (
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
              )
            }
          />
        ))}
      </ul>
    </div>
  );
}
