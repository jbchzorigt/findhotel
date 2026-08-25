import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { SplashScreen } from "@/components/SplashScreen";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Зочид буудлын бүртгэл",
  description: "Талбарын зочид буудлын бүртгэлийн систем",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Гар утсанд зориулсан: томруулахыг хориглохгүй (хүртээмж), гэхдээ
  // анхны хэмжээ нь төхөөрөмжийн өргөнтэй таарна.
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="mn"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Ачаалалтын дэлгэц — хуудас шинээр ачаалагдах үед НЭГ удаа.
            App Router-ийн дотоод шилжилтэд layout задардаггүй тул
            товч дарах бүрт давтагдахгүй. */}
        <SplashScreen />
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
