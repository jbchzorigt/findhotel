"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
      className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 transition-colors active:bg-red-100 disabled:opacity-60"
    >
      {busy ? "Гарч байна…" : "Гарах"}
    </button>
  );
}
