"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [badge, setBadge] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ badge_number: badge, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Нэвтэрч чадсангүй.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Сүлжээнд холбогдож чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="badge" className="block text-sm font-medium">
          Badge дугаар
        </label>
        <input
          id="badge"
          value={badge}
          onChange={(event) => setBadge(event.target.value)}
          autoComplete="username"
          autoCapitalize="characters"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Нууц үг
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Нэвтэрч байна…" : "Нэвтрэх"}
      </button>
    </form>
  );
}
