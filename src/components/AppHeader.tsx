import Link from "next/link";

import { LogoutButton } from "./LogoutButton";

type Tab = "new" | "list" | "admin" | "surveyors";

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
      className={
        active === key
          ? "border-b-2 border-blue-600 pb-1 font-semibold"
          : "pb-1 text-slate-500"
      }
    >
      {label}
    </Link>
  );

  return (
    <header className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
      <nav className="flex flex-wrap gap-4 text-sm">
        {tab("/", "Шинэ бүртгэл", "new")}
        {tab("/surveys", "Миний бүртгэл", "list")}
        {role === "ADMIN" ? tab("/admin", "Бүх бүртгэл", "admin") : null}
        {role === "ADMIN" ? tab("/admin/surveyors", "Алба хаагчид", "surveyors") : null}
      </nav>
      <LogoutButton />
    </header>
  );
}
