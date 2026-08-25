import Link from "next/link";

import { LogoutButton } from "./LogoutButton";

export function AppHeader({ active }: { active: "new" | "list" }) {
  const tab = (href: string, label: string, key: "new" | "list") => (
    <Link
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
    <header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-2">
      <nav className="flex gap-4 text-sm">
        {tab("/", "Шинэ бүртгэл", "new")}
        {tab("/surveys", "Миний бүртгэл", "list")}
      </nav>
      <LogoutButton />
    </header>
  );
}
