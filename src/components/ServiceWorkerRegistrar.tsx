"use client";

/**
 * Service worker-ийг бүртгэнэ — утсан дээр "апп болгож суулгах" боломж
 * олгохын тулд.
 *
 * Зөвхөн production-д ажиллана: хөгжүүлэлтийн үед SW нь HMR-тэй зөрчилдөж,
 * "яагаад миний засвар харагдахгүй байна вэ" гэсэн төөрөгдөл үүсгэдэг.
 */
import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Хуудас ачаалж дуустал хүлээнэ — эхний зурагдалттай өрсөлдөхгүй.
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        // Суулгах боломж алдагдана, гэхдээ апп өөрөө хэвийн ажиллана.
        console.error("[sw] бүртгэж чадсангүй:", error);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
