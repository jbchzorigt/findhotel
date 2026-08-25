"use client";

/**
 * Өөрийн бүртгэлээ засах маягт.
 *
 * Зураг энд байхгүй — зураг бол баримт, солих боломжтой байвал бүртгэлийн
 * үнэ цэн буурна. Буруу зурагтай бол устгаад шинээр бүртгэнэ.
 *
 * Хадгалахад давхардлын шалгалт ДАХИН ажиллана: нэр эсвэл байршил
 * өөрчлөгдсөн бол шинэ утгаараа өөр бүртгэлтэй давхцаж мэднэ.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MapPicker } from "@/components/MapPicker";
import { formatDate } from "@/lib/format";

type Block = {
  code: string;
  message: string;
  acknowledgeable: boolean;
  duplicate?: {
    id: string;
    name: string;
    photo_url: string | null;
    distance_m: number;
    created_at: string;
  };
};

const PHONE_PATTERN = /^[0-9]{8}$/;

export function EditSurveyForm({
  survey,
}: {
  survey: {
    id: string;
    name: string;
    phone: string;
    addressText: string | null;
    note: string | null;
    lat: number;
    lng: number;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(survey.name);
  const [phone, setPhone] = useState(survey.phone);
  const [address, setAddress] = useState(survey.addressText ?? "");
  const [note, setNote] = useState(survey.note ?? "");
  const [position, setPosition] = useState({
    lat: survey.lat,
    lng: survey.lng,
  });
  const [moved, setMoved] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);

  const canSave =
    name.trim().length >= 2 && PHONE_PATTERN.test(phone) && !busy;

  async function save(duplicateAck: boolean) {
    setBusy(true);
    setError(null);
    setBlocks([]);
    try {
      const response = await fetch(`/api/surveys/${survey.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          address_text: address.trim() || null,
          note: note.trim() || null,
          ...(moved
            ? {
                lat: position.lat,
                lng: position.lng,
                location_source: "MAP_PIN",
                // Гараар зөөсөн цэг нь сонгосон OSM объекттой таарахаа больсон.
                osm_ref: null,
              }
            : {}),
          duplicate_ack: duplicateAck,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.status === 409 && Array.isArray(body.blocks)) {
        setBlocks(body.blocks);
        return;
      }
      if (!response.ok) {
        setError(body.error ?? "Хадгалж чадсангүй.");
        return;
      }

      router.push("/surveys");
      router.refresh();
    } catch {
      setError("Сүлжээнд холбогдож чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) void save(false);
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Нэр <span className="text-red-600">*</span>
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className={field}
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium">
          Утас <span className="text-red-600">*</span>
        </label>
        <input
          id="phone"
          value={phone}
          onChange={(event) =>
            setPhone(event.target.value.replace(/\D/g, "").slice(0, 8))
          }
          inputMode="numeric"
          required
          className={field}
        />
        {phone.length > 0 && !PHONE_PATTERN.test(phone) ? (
          <p className="mt-1 text-xs text-red-600">
            Утасны дугаар 8 оронтой байх ёстой.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium">
          Хаяг
        </label>
        <input
          id="address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          className={field}
        />
      </div>

      <div>
        <label htmlFor="note" className="block text-sm font-medium">
          Тэмдэглэл
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Хороо болон гудамжны нэр оруулна уу"
          rows={2}
          className={field}
        />
      </div>

      <div>
        <p className="text-sm font-medium">Байршил</p>
        <div className="mt-1">
          <MapPicker
            lat={position.lat}
            lng={position.lng}
            onMove={(lat, lng) => {
              setPosition({ lat, lng });
              setMoved(true);
            }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Цэгийг чирж эсвэл газрын зураг дээр дарж засна.
          {moved ? " Байршил өөрчлөгдсөн." : null} © OpenStreetMap contributors
        </p>
      </div>

      {blocks.length > 0 ? (
        <section
          role="alert"
          className="space-y-3 rounded-lg border-2 border-red-300 bg-red-50 p-3"
        >
          <h2 className="font-semibold text-red-800">Хадгалах боломжгүй</h2>
          {blocks.map((block) => (
            <div key={block.code} className="space-y-2 text-sm text-red-900">
              <p>{block.message}</p>
              {block.duplicate ? (
                <div className="flex gap-3 rounded-lg bg-white p-2">
                  {block.duplicate.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={block.duplicate.photo_url}
                      alt={block.duplicate.name}
                      className="h-20 w-20 shrink-0 rounded object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 text-slate-700">
                    <p className="font-medium">{block.duplicate.name}</p>
                    <p className="text-xs">{block.duplicate.distance_m}м зайд</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(block.duplicate.created_at)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          {blocks.every((block) => block.acknowledgeable) ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(true)}
              className="w-full rounded-lg border-2 border-red-400 bg-white py-3 font-semibold text-red-800 disabled:opacity-60"
            >
              Энэ бол өөр буудал — хадгалах
            </button>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSave}
          className="flex-1 rounded-lg bg-blue-600 py-3 font-semibold text-white disabled:bg-slate-300"
        >
          {busy ? "Хадгалж байна…" : "Хадгалах"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/surveys")}
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium"
        >
          Болих
        </button>
      </div>
    </form>
  );
}
