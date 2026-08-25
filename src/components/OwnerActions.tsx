"use client";

/**
 * Алба хаагчийн өөрийн бүртгэл дээрх үйлдлүүд.
 *
 * Устгалт нь зөөлөн (мөр үлдэнэ) боловч алба хаагчийн хувьд эргэж
 * харагдахгүй тул баталгаажуулалт асууна — санамсаргүй дарахад ажил
 * алдагдах ёсгүй.
 */
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export function OwnerActions({
  surveyId,
  name,
}: {
  surveyId: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`"${name}" бүртгэлийг устгах уу?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "DELETED" }),
      });
      if (response.ok) router.refresh();
      else alert("Устгаж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link
        href={`/surveys/${surveyId}/edit`}
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
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
        Засах
      </Link>

      <button
        type="button"
        disabled={busy}
        onClick={() => void remove()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 active:bg-red-100 disabled:opacity-60"
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
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
        Устгах
      </button>
    </>
  );
}
