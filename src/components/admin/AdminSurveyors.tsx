"use client";

/**
 * Алба хаагчийн удирдлага.
 *
 * Нууц үг НЭГ л удаа харагдана — DB-д зөвхөн hash хадгалагдана. Тиймээс
 * админ түүнийг тэр дороо хуулж авах ёстой. Дахин харах арга байхгүй,
 * зөвхөн шинээр сэргээх.
 */
import { useCallback, useState } from "react";

type Surveyor = {
  id: string;
  badge_number: string;
  full_name: string;
  unit: string | null;
  role: "SURVEYOR" | "ADMIN";
  is_active: boolean;
};

/**
 * Эхний өгөгдлийг СЕРВЕР дамжуулна (`initial`). Ингэснээр:
 *   - ачаалалтын анивчилт байхгүй
 *   - нэг HTTP хүсэлт хэмнэгдэнэ
 *   - effect дотор setState дуудах шаардлагагүй (React 19 үүнийг
 *     "cascading render" гэж зөв шүүмжилдэг)
 * Дахин уншилт зөвхөн ХЭРЭГЛЭГЧИЙН үйлдлийн дараа хийгдэнэ.
 */
export function AdminSurveyors({ initial }: { initial: Surveyor[] }) {
  const [people, setPeople] = useState<Surveyor[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ badge: string; password: string } | null>(
    null,
  );

  const [badge, setBadge] = useState("");
  const [fullName, setFullName] = useState("");
  const [unit, setUnit] = useState("");
  const [role, setRole] = useState<"SURVEYOR" | "ADMIN">("SURVEYOR");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/surveyors");
    const body = await response.json();
    if (response.ok) setPeople(body.surveyors);
    else setError(body.error ?? "Уншиж чадсангүй.");
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/surveyors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          badge_number: badge.trim(),
          full_name: fullName.trim(),
          unit: unit.trim() || null,
          role,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Үүсгэж чадсангүй.");
        return;
      }
      setSecret({ badge: body.badge_number, password: body.temporary_password });
      setBadge("");
      setFullName("");
      setUnit("");
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/admin/surveyors/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Өөрчилж чадсангүй.");
      return;
    }
    if (body.temporary_password) {
      const person = people.find((item) => item.id === id);
      setSecret({
        badge: person?.badge_number ?? "",
        password: body.temporary_password,
      });
    }
    void load();
  }

  return (
    <div className="space-y-5">
      {/* Нэг удаа харагдах нууц үг ---------------------------------------- */}
      {secret ? (
        <div className="rounded-lg border-2 border-green-400 bg-green-50 p-3">
          <p className="text-sm font-semibold text-green-900">
            {secret.badge} — түр нууц үг
          </p>
          <p className="my-2 font-mono text-lg break-all">{secret.password}</p>
          <p className="text-xs text-green-800">
            Энэ нууц үгийг ДАХИН харах боломжгүй. Одоо хуулж авч, алба хаагчид
            дамжуулна уу.
          </p>
          <button
            type="button"
            onClick={() => setSecret(null)}
            className="mt-2 text-sm underline"
          >
            Хаах
          </button>
        </div>
      ) : null}

      {/* Шинээр нэмэх ---------------------------------------------------- */}
      <form
        onSubmit={create}
        className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
      >
        <h2 className="font-semibold">Шинэ алба хаагч</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={badge}
            onChange={(event) => setBadge(event.target.value)}
            placeholder="Badge дугаар"
            required
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Овог нэр"
            required
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="Харьяа хэлтэс"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "SURVEYOR" | "ADMIN")
            }
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="SURVEYOR">Алба хаагч</option>
            <option value="ADMIN">Админ</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          Нэмэх
        </button>
      </form>

      {error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      {/* Жагсаалт -------------------------------------------------------- */}
      <ul className="space-y-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white p-3"
          >
            <span className="font-mono text-sm">{person.badge_number}</span>
            <span className="font-medium">{person.full_name}</span>
            {person.unit ? (
              <span className="text-sm text-slate-500">{person.unit}</span>
            ) : null}
            {person.role === "ADMIN" ? (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">
                админ
              </span>
            ) : null}
            {!person.is_active ? (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                идэвхгүй
              </span>
            ) : null}

            <span className="ml-auto flex gap-3 text-sm">
              <button
                type="button"
                onClick={() => void patch(person.id, { reset_password: true })}
                className="text-blue-600 underline"
              >
                нууц үг сэргээх
              </button>
              <button
                type="button"
                onClick={() =>
                  void patch(person.id, { is_active: !person.is_active })
                }
                className={
                  person.is_active ? "text-red-600 underline" : "text-green-700 underline"
                }
              >
                {person.is_active ? "идэвхгүй болгох" : "идэвхжүүлэх"}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
