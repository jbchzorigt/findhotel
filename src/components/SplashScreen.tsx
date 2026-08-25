"use client";

/**
 * Ачаалалтын дэлгэц — газрын зүү зурагдаж, байршлын дохио тархана.
 *
 * Албан ёсны цагдаагийн сүлдийг ашиглаагүй: түүнийг дахин зурвал нарийвчлал
 * алдагдана, мөн албан ёсны тэмдгийг ойролцоогоор дүрслэх нь зохисгүй. Зүү нь
 * аппын үйлдлийг шууд илэрхийлнэ — байршил тэмдэглэх.
 *
 * Эффект нь гурван давхаргатай:
 *   1. Доод талын дугуй давалгаа — GPS дохио тархаж буй мэт (ping)
 *   2. Зүүний контур — `stroke-dashoffset`-оор зурагдана
 *   3. Дүүргэлт — контур дуусмагц бүдэг гарч ирнэ
 *
 * `pathLength="1"` нь замын жинхэнэ уртыг 1 болгож нормчилдог — тиймээс
 * `stroke-dasharray`-д хэдэн пиксел болохыг тооцох шаардлагагүй, зам
 * өөрчлөгдсөн ч анимаци эвдрэхгүй.
 */
import { useEffect, useState } from "react";

const DRAW_MS = 1150;
const HOLD_MS = 300;
const FADE_MS = 350;

/** Зүүний контур — дуслын хэлбэр. */
const PIN_PATH =
  "M100 26 C132 26 158 52 158 84 C158 126 100 178 100 178 C100 178 42 126 42 84 C42 52 68 26 100 26 Z";

export function SplashScreen() {
  const [phase, setPhase] = useState<"drawing" | "fading" | "gone">("drawing");

  useEffect(() => {
    const toFade = setTimeout(() => setPhase("fading"), DRAW_MS + HOLD_MS);
    const toGone = setTimeout(
      () => setPhase("gone"),
      DRAW_MS + HOLD_MS + FADE_MS,
    );
    return () => {
      clearTimeout(toFade);
      clearTimeout(toGone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      className="hfs-splash"
      data-fading={phase === "fading" ? "true" : undefined}
    >
      <svg viewBox="0 0 200 200" className="hfs-splash-mark">
        {/* 1. Байршлын дохио — доод талаас тархана */}
        <g className="hfs-ping">
          <ellipse cx="100" cy="180" rx="46" ry="14" />
          <ellipse cx="100" cy="180" rx="46" ry="14" />
        </g>

        {/* 3. Дүүргэлт — контурын ард, сүүлд гарч ирнэ */}
        <path d={PIN_PATH} className="hfs-pin-fill" />

        {/* 2. Контур — тойрч зурагдана */}
        <path
          d={PIN_PATH}
          pathLength="1"
          className="hfs-pin-stroke"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="100"
          cy="82"
          r="23"
          pathLength="1"
          className="hfs-pin-dot"
          fill="none"
          strokeWidth="9"
        />
      </svg>

      <p className="hfs-splash-title">Зочид буудлын бүртгэл</p>
    </div>
  );
}
