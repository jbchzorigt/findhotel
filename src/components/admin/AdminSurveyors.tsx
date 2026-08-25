"use client";

/**
 * Алба хаагчийн удирдлага.
 *
 * Нууц үгийг АДМИН өөрөө тогтооно — систем үүсгэхгүй. Ингэснээр админ
 * алба хаагчид шууд амаар хэлж өгөх боломжтой, "нэг л удаа харагдах"
 * утгыг хуулж авахаа мартах эрсдэлгүй.
 *
 * Нууц үг DB-д зөвхөн hash хэлбэрээр очно — энд ч, серверийн хариуд ч
 * задгайгаар хадгалагдахгүй.
 */
import { useState } from "react";

type Surveyor = {
  id: string;
  badge_number: string;
  full_name: string;
  unit: string | null;
  role: "SURVEYOR" | "ADMIN";
  is_active: boolean;
};

const MIN_PASSWORD = 8;

function KeyIcon() {
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
      <circle cx="8" cy="15" r="4" />
      <path d="M10.9 12.1 21 2M17 6l3 3M15 8l2 2" />
    </svg>
  );
}

/**
 * Идэвхтэй эсэхийг сэлгэх унтраалга.
 *
 * Товчны оронд унтраалга сонгосон шалтгаан: төлөв нь ӨӨРӨӨ удирдлага байх нь
 * ойлгомжтой. "Идэвхгүй болгох" гэсэн товч нь одоогийн төлөвийг биш, дарвал
 * юу болохыг заадаг — тэр хоёрыг хүн агшин зуур андуурдаг.
 *
 * `role="switch"` + `aria-checked` нь дэлгэц уншигчид төлөвийг хэлнэ; өнгө
 * ганцаараа хангалтгүй.
 */
function ActiveToggle({
  active,
  disabled,
  title,
  onToggle,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      title={title}
      onClick={onToggle}
      className="inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          active ? "bg-green-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            active ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </span>
      <span
        className={`text-sm font-medium ${
          active ? "text-green-700" : "text-slate-500"
        }`}
      >
        {active ? "Идэвхтэй" : "Идэвхгүй"}
      </span>
    </button>
  );
}

export function AdminSurveyors({
  initial,
  currentUserId,
}: {
  initial: Surveyor[];
  /** Админ өөрийгөө унтраавал системд орох хүнгүй үлдэж мэднэ. */
  currentUserId: string;
}) {
  const [people, setPeople] = useState<Surveyor[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Шинэ алба хаагчийн маягт
  const [badge, setBadge] = useState("");
  const [fullName, setFullName] = useState("");
  const [unit, setUnit] = useState("");
  const [role, setRole] = useState<"SURVEYOR" | "ADMIN">("SURVEYOR");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [busy, setBusy] = useState(false);

  // Нууц үг солих мөр нээгдсэн хэрэглэгч
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");

  async function reload() {
    const response = await fetch("/api/admin/surveyors");
    const body = await response.json();
    if (response.ok) setPeople(body.surveyors);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (password !== passwordAgain) {
      setError("Нууц үг таарахгүй байна.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/surveyors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          badge_number: badge.trim(),
          full_name: fullName.trim(),
          unit: unit.trim() || null,
          role,
          password,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Үүсгэж чадсангүй.");
        return;
      }
      setNotice(`"${badge.trim()}" нэмэгдлээ.`);
      setBadge("");
      setFullName("");
      setUnit("");
      setPassword("");
      setPasswordAgain("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/admin/surveyors/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Өөрчилж чадсангүй.");
      return false;
    }
    await reload();
    return true;
  }

  async function savePassword(person: Surveyor) {
    if (newPassword !== newPasswordAgain) {
      setError("Нууц үг таарахгүй байна.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD) {
      setError(`Нууц үг доод тал нь ${MIN_PASSWORD} тэмдэгт байх ёстой.`);
      return;
    }
    const ok = await patch(person.id, { password: newPassword });
    if (ok) {
      setNotice(`"${person.badge_number}" — нууц үг солигдлоо.`);
      setEditingId(null);
      setNewPassword("");
      setNewPasswordAgain("");
    }
  }

  const canCreate =
    badge.trim().length >= 2 &&
    fullName.trim().length >= 2 &&
    password.length >= MIN_PASSWORD &&
    password === passwordAgain &&
    !busy;

  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";

  return (
    <div className="space-y-5">
      {/* --- Шинэ алба хаагч ---------------------------------------------- */}
      <form
        onSubmit={create}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <h2 className="font-semibold">Шинэ алба хаагч</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={badge}
            onChange={(event) => setBadge(event.target.value)}
            placeholder="Badge дугаар"
            autoComplete="off"
            required
            className={field}
          />
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Овог нэр"
            autoComplete="off"
            required
            className={field}
          />
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="Харьяа хэлтэс"
            autoComplete="off"
            className={field}
          />
          <select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "SURVEYOR" | "ADMIN")
            }
            className={field}
          >
            <option value="SURVEYOR">Алба хаагч</option>
            <option value="ADMIN">Админ</option>
          </select>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={`Нууц үг (доод тал нь ${MIN_PASSWORD})`}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            className={field}
          />
          <input
            type="password"
            value={passwordAgain}
            onChange={(event) => setPasswordAgain(event.target.value)}
            placeholder="Нууц үгээ давтах"
            autoComplete="new-password"
            required
            className={field}
          />
        </div>

        {passwordAgain.length > 0 && password !== passwordAgain ? (
          <p className="text-sm text-red-600">Нууц үг таарахгүй байна.</p>
        ) : null}

        <button
          type="submit"
          disabled={!canCreate}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:bg-slate-300"
        >
          {busy ? "Нэмж байна…" : "Нэмэх"}
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </p>
      ) : null}

      {/* --- Жагсаалт ------------------------------------------------------ */}
      <ul className="space-y-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-sm">{person.badge_number}</span>
              <span className="font-medium">{person.full_name}</span>
              {person.unit ? (
                <span className="text-sm text-slate-500">{person.unit}</span>
              ) : null}
              {person.role === "ADMIN" ? (
                <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium">
                  админ
                </span>
              ) : null}
              <div className="ml-auto">
                <ActiveToggle
                  active={person.is_active}
                  disabled={person.id === currentUserId}
                  title={
                    person.id === currentUserId
                      ? "Өөрийгөө идэвхгүй болгох боломжгүй"
                      : undefined
                  }
                  onToggle={() =>
                    void patch(person.id, { is_active: !person.is_active })
                  }
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingId(editingId === person.id ? null : person.id);
                  setNewPassword("");
                  setNewPasswordAgain("");
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-100"
              >
                <KeyIcon />
                Нууц үг солих
              </button>
            </div>

            {/* --- Нууц үг солих мөр --------------------------------------- */}
            {editingId === person.id ? (
              <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder={`Шинэ нууц үг (${MIN_PASSWORD}+)`}
                    autoComplete="new-password"
                    className={field}
                  />
                  <input
                    type="password"
                    value={newPasswordAgain}
                    onChange={(event) =>
                      setNewPasswordAgain(event.target.value)
                    }
                    placeholder="Давтах"
                    autoComplete="new-password"
                    className={field}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void savePassword(person)}
                    disabled={
                      newPassword.length < MIN_PASSWORD ||
                      newPassword !== newPasswordAgain
                    }
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                  >
                    Хадгалах
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
                  >
                    Болих
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
