"use client";

/**
 * Талбарын бүртгэлийн маягт — аппын гол дэлгэц.
 *
 * Дараалал нь §5-ийн урсгалыг дагана: зураг → [📍] байршил → нэр/утас →
 * илгээх. Алба хаагч буудлын өмнө зогсож, нэг гараар, нарны дор ашиглана
 * гэдгийг тооцсон: товч том, алхам цөөн, алдааны мессеж тодорхой.
 */
import { useCallback, useRef, useState } from "react";

import { MapPicker } from "@/components/MapPicker";
import { MAX_PHOTOS } from "@/lib/photos/constants";
import { preparePhoto, uploadPhoto, type PreparedPhoto } from "@/lib/photos/prepare";

type LocationSource = "OSM_POI" | "GPS" | "MAP_PIN" | "MAPS_LINK";

type Candidate = {
  source: "SURVEY" | "OSM";
  name: string;
  lat: number;
  lng: number;
  distance_m: number;
  osm_ref: string | null;
  already_registered: boolean;
  kind: string | null;
};

type PhotoItem = { prepared: PreparedPhoto; previewUrl: string };

const PHONE_PATTERN = /^[7-9][0-9]{7}$/;

export function SurveyForm({ surveyorName }: { surveyorName: string }) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [position, setPosition] = useState<{
    lat: number;
    lng: number;
    accuracyM: number | null;
    source: LocationSource;
  } | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [osmRef, setOsmRef] = useState<string | null>(null);
  const [osmRawName, setOsmRawName] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [nearby, setNearby] = useState<Candidate[] | null>(null);
  const [degraded, setDegraded] = useState(false);

  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Дахин илгээхэд шинэ мөр үүсэхээс сэргийлнэ — сервер энэ түлхүүрээр
  // давхардлыг таньдаг.
  const clientUuid = useRef<string>(crypto.randomUUID());

  // -------------------------------------------------------------------------
  // Зураг
  // -------------------------------------------------------------------------
  const addPhotos = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setError(null);
      const room = MAX_PHOTOS - photos.length;
      if (room <= 0) {
        setError(`Хамгийн ихдээ ${MAX_PHOTOS} зураг.`);
        return;
      }

      setBusy("Зураг боловсруулж байна…");
      try {
        const picked = Array.from(files).slice(0, room);
        const prepared = await Promise.all(picked.map(preparePhoto));
        setPhotos((current) => [
          ...current,
          ...prepared.map((item) => ({
            prepared: item,
            previewUrl: URL.createObjectURL(item.blob),
          })),
        ]);
        setCapturedAt((current) => current ?? new Date().toISOString());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Зураг уншиж чадсангүй.");
      } finally {
        setBusy(null);
      }
    },
    [photos.length],
  );

  function removePhoto(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index]!.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  // -------------------------------------------------------------------------
  // [📍] Байршил
  // -------------------------------------------------------------------------
  async function findLocation() {
    setLocating(true);
    setError(null);
    try {
      const fix = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20_000,
          maximumAge: 0,
        });
      });

      const lat = fix.coords.latitude;
      const lng = fix.coords.longitude;
      const accuracyM = Math.round(fix.coords.accuracy);
      setPosition({ lat, lng, accuracyM, source: "GPS" });
      setCapturedAt((current) => current ?? new Date().toISOString());

      const response = await fetch("/api/geo/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      const body = await response.json();
      setAddress((current) => body.address_text ?? current);
      setNearby(body.nearby ?? []);
      setDegraded(Boolean(body.degraded));
    } catch (cause) {
      const message =
        cause instanceof GeolocationPositionError && cause.code === 1
          ? "Байршлын зөвшөөрөл олгоно уу (тохиргоо → байршил)."
          : "Байршил тогтоож чадсангүй. Тэнгэр харагдах газар очиж дахин оролдоно уу.";
      setError(message);
    } finally {
      setLocating(false);
    }
  }

  function chooseCandidate(candidate: Candidate) {
    setName(candidate.name);
    setOsmRef(candidate.osm_ref);
    setOsmRawName(candidate.name);
    setPosition((current) => ({
      lat: candidate.lat,
      lng: candidate.lng,
      accuracyM: current?.accuracyM ?? null,
      source: "OSM_POI",
    }));
  }

  function chooseManual() {
    setOsmRef(null);
    setOsmRawName(null);
    setName("");
  }

  function moveMarker(lat: number, lng: number) {
    setPosition((current) => ({
      lat,
      lng,
      accuracyM: current?.accuracyM ?? null,
      // Гараар зөөсөн бол GPS-ийн нарийвчлал утгагүй болно.
      source: "MAP_PIN",
    }));
    // Гараар зөөсөн цэг нь сонгосон POI-той таарахаа больсон.
    setOsmRef(null);
  }

  // -------------------------------------------------------------------------
  // Илгээх
  // -------------------------------------------------------------------------
  const canSubmit =
    photos.length >= 1 &&
    position !== null &&
    name.trim().length >= 2 &&
    PHONE_PATTERN.test(phone) &&
    !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !position) return;

    setError(null);
    setBusy("Зураг хуулж байна…");
    try {
      const uploaded = [];
      for (const [index, item] of photos.entries()) {
        setBusy(`Зураг хуулж байна… (${index + 1}/${photos.length})`);
        const { r2Key, publicUrl } = await uploadPhoto(item.prepared);
        uploaded.push({
          r2_key: r2Key,
          public_url: publicUrl,
          sha256: item.prepared.sha256,
          bytes: item.prepared.bytes,
          width: item.prepared.width,
          height: item.prepared.height,
          exif_lat: item.prepared.exif.lat,
          exif_lng: item.prepared.exif.lng,
          exif_taken_at: item.prepared.exif.takenAt?.toISOString() ?? null,
        });
      }

      setBusy("Бүртгэл илгээж байна…");
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_uuid: clientUuid.current,
          name: name.trim(),
          phone,
          address_text: address.trim() || null,
          lat: position.lat,
          lng: position.lng,
          location_source: position.source,
          location_accuracy_m: position.accuracyM,
          osm_ref: osmRef,
          osm_raw_name: osmRawName,
          note: note.trim() || null,
          captured_at: capturedAt ?? new Date().toISOString(),
          photos: uploaded,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Бүртгэл илгээж чадсангүй.");
        return;
      }

      setDone(name.trim());
      // Дараагийн буудалд бэлдэнэ — байршил, зураг бүгд шинэчлэгдэнэ.
      photos.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPhotos([]);
      setPosition(null);
      setCapturedAt(null);
      setAddress("");
      setName("");
      setPhone("");
      setNote("");
      setNearby(null);
      setOsmRef(null);
      setOsmRawName(null);
      clientUuid.current = crypto.randomUUID();
    } catch {
      setError("Сүлжээнд холбогдож чадсангүй. Дахин оролдоно уу.");
    } finally {
      setBusy(null);
    }
  }

  // -------------------------------------------------------------------------
  return (
    <form onSubmit={submit} className="space-y-5 pb-24">
      <p className="text-sm text-slate-600">{surveyorName}</p>

      {done ? (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          ✓ &ldquo;{done}&rdquo; бүртгэгдлээ. Дараагийн буудлыг бүртгэж болно.
        </div>
      ) : null}

      {/* 1. Зураг --------------------------------------------------------- */}
      <section>
        <h2 className="font-semibold">1. Гаднах зураг</h2>
        <p className="mb-2 text-xs text-slate-500">
          Барилгын гаднах талыг дарна уу. Хүн зураглахгүй.
        </p>

        <div className="flex flex-wrap gap-2">
          {photos.map((item, index) => (
            <div key={item.previewUrl} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={`Зураг ${index + 1}`}
                className="h-20 w-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                aria-label={`Зураг ${index + 1} устгах`}
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-slate-900 text-sm text-white"
              >
                ×
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS ? (
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-400 text-3xl text-slate-500">
              +
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(event) => {
                  void addPhotos(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </section>

      {/* 2. Байршил ------------------------------------------------------- */}
      <section>
        <h2 className="font-semibold">2. Байршил</h2>

        <button
          type="button"
          onClick={findLocation}
          disabled={locating}
          className="mt-2 w-full rounded-lg bg-slate-900 py-3 font-semibold text-white disabled:opacity-60"
        >
          {locating ? "Хайж байна…" : "📍 Байршлаас олох"}
        </button>

        {position ? (
          <div className="mt-3 space-y-3">
            <MapPicker
              lat={position.lat}
              lng={position.lng}
              onMove={moveMarker}
              markers={(nearby ?? [])
                .filter((item) => item.already_registered)
                .map((item) => ({ lat: item.lat, lng: item.lng, name: item.name }))}
            />
            <p className="text-xs text-slate-500">
              Цэгийг чирж эсвэл газрын зураг дээр дарж засна.
              {position.accuracyM !== null
                ? ` GPS нарийвчлал ≈ ${position.accuracyM}м.`
                : null}
              {" "}© OpenStreetMap contributors
            </p>

            {nearby && nearby.length > 0 ? (
              <div className="rounded-lg border border-slate-300 bg-white">
                <p className="border-b border-slate-200 px-3 py-2 text-sm font-medium">
                  Ойролцоох буудлууд
                </p>
                <ul>
                  {nearby.map((candidate) => (
                    <li key={`${candidate.source}-${candidate.osm_ref ?? candidate.name}`}>
                      <button
                        type="button"
                        onClick={() => chooseCandidate(candidate)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        {candidate.already_registered ? "⚠ " : "○ "}
                        {candidate.name}
                        <span className="text-slate-500">
                          {" · "}
                          {candidate.distance_m}м
                          {candidate.already_registered ? " · БҮРТГЭГДСЭН" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={chooseManual}
                  className="w-full border-t border-slate-200 px-3 py-2 text-left text-sm font-medium"
                >
                  ● Жагсаалтад алга — нэрийг гараар бичих
                </button>
              </div>
            ) : (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                {degraded
                  ? "Байршлын үйлчилгээ хариу өгсөнгүй. Нэр, хаягаа гараар бичнэ үү."
                  : "Ойролцоо бүртгэлтэй буудал олдсонгүй — нэрийг гараар бичнэ үү."}
              </p>
            )}
          </div>
        ) : null}
      </section>

      {/* 3. Мэдээлэл ------------------------------------------------------ */}
      <section className="space-y-3">
        <h2 className="font-semibold">3. Буудлын мэдээлэл</h2>

        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Нэр <span className="text-red-600">*</span>
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Хаалганы самбар дээрхээр яг бичнэ"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3"
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
            placeholder="99112233"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3"
          />
          {phone.length > 0 && !PHONE_PATTERN.test(phone) ? (
            <p className="mt-1 text-xs text-red-600">
              8 оронтой, 7/8/9-өөр эхэлсэн дугаар байх ёстой.
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
            placeholder="📍 дарахад автоматаар бөглөгдөнө"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3"
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
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="mx-auto block w-full max-w-md rounded-lg bg-blue-600 py-4 text-lg font-semibold text-white disabled:bg-slate-300"
        >
          {busy ?? "Илгээх"}
        </button>
      </div>
    </form>
  );
}
