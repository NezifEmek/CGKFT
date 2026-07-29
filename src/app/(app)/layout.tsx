import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { ROL_ETIKET } from "@/types/database";
import { cikisYap } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const adminMi = profile.rol === "admin";

  const menu = [
    { href: "/", etiket: "📊 Genel Bakış" },
    { href: "/subeler", etiket: "🏪 Şubeler" },
    ...(adminMi ? [{ href: "/kullanicilar", etiket: "👥 Kullanıcılar" }] : []),
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col">
        <div className="px-5 py-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="font-semibold text-sm">Çiğköfte Satış Paneli</div>
          <div className="text-xs text-neutral-500 mt-1">{profile.ad_soyad || "Kullanıcı"}</div>
          <div className="text-[11px] mt-0.5 inline-block px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            {ROL_ETIKET[profile.rol]}
            {profile.bolge ? ` · ${profile.bolge}` : ""}
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {menu.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="block rounded-md px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {m.etiket}
            </Link>
          ))}
        </nav>
        <form action={cikisYap} className="px-2 pb-4">
          <button
            type="submit"
            className="w-full text-left rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            ⏻ Çıkış Yap
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6 md:p-8 max-w-6xl">{children}</main>
    </div>
  );
}
