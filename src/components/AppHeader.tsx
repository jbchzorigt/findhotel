import Link from "next/link";

import { LogoutButton } from "./LogoutButton";

type Tab = "new" | "list" | "admin" | "surveyors";

/**
 * Товч хэлбэрийн шилжүүлэгч.
 *
 * Текст холбоос биш товч болгосон шалтгаан: талбарын ажилд утсыг нэг гараар,
 * заримдаа бээлийтэй ашиглана. Дарах талбай том байх ёстой. Тиймээс өндөр нь
 * хүрэлтийн доод хэмжээнээс (44px) багагүй.
 */
export function AppHeader({
  active,
  role = "SURVEYOR",
}: {
  active: Tab;
  role?: "SURVEYOR" | "ADMIN";
}) {
  const tab = (href: string, label: string, key: Tab) => (
    <Link
      key={key}
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={[
        "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active === key
          ? "bg-blue-600 text-white"
          : "border border-slate-300 bg-white text-slate-700 active:bg-slate-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );

  return (
    <header className="mb-4 border-b border-slate-200 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        {tab("/", "Шинэ бүртгэл", "new")}
        {tab("/surveys", "Миний бүртгэл", "list")}
        {role === "ADMIN" ? tab("/admin", "Бүх бүртгэл", "admin") : null}
        {role === "ADMIN"
          ? tab("/admin/surveyors", "Алба хаагчид", "surveyors")
          : null}

        {/* Гарах нь шилжүүлэгч биш — сешн дуусгах өөр төрлийн үйлдэл тул
            өнгө, байрлалаараа ялгарна. Улаан хүрээ нь "болгоомжтой" гэсэн
            дохио өгөх ба дүүргэсэн улаан шиг сандаргахгүй. */}
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
