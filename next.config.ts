import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          /*
           * Энэ бол цагдаагийн дотоод систем боловч нийтэд нээлттэй домэйн
           * дээр байрлана. Хайлтын системд индексжвэл алба хаагчийн
           * нэвтрэх хуудас, бүртгэлийн бүтэц гадуур харагдана.
           * `robots.txt` нь зөвлөмж, харин энэ header нь илүү хүчтэй.
           */
          { key: "X-Robots-Tag", value: "noindex, nofollow" },

          // Браузер content-type-ыг таамаглаж өөрчлөхийг хориглоно.
          { key: "X-Content-Type-Options", value: "nosniff" },

          // Өөр сайт iframe дотор шигтгэж, дарааллын халдлага хийхээс сэргийлнэ.
          { key: "X-Frame-Options", value: "DENY" },

          // Гадаад сайт руу бүтэн зам илгээхгүй.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          // Хэрэггүй төхөөрөмжийн эрхийг хаана. Байршил, камер хоёр
          // ӨӨРИЙН гарал үүсэлд нээлттэй байх ёстой — апп тэднийг ашиглана.
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(self), microphone=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
