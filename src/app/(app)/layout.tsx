import { requireProfile } from "@/lib/auth";
import { ROL_ETIKET } from "@/types/database";
import { cikisYap } from "./actions";
import { YanMenuLinkleri, type MenuOgesi } from "./yan-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const adminMi = profile.rol === "admin";

  const menu: MenuOgesi[] = [
    { href: "/", etiket: "📊 Genel Bakış" },
    { href: "/subeler", etiket: "🏪 Şubeler" },
    ...(profile.rol !== "denetmen"
      ? [{ href: "/sube-yonetimi", etiket: "⚙️ Şube Yönetimi" }]
      : []),
    { href: "/top30", etiket: "🏆 Top 30 Şube" },
    { href: "/yoy-karsilastirma", etiket: "📈 2026 vs 2025" },
    { href: "/aylik-degisim", etiket: "🔀 Aylık Değişim Analizi" },
    { href: "/kpi-takibi", etiket: "🎯 KPI Takibi" },
    { href: "/yetkili-analizi", etiket: "🧑‍💼 Yetkili Analizi" },
    { href: "/aylar-veri", etiket: "🗓️ Aylar & Veri" },
    { href: "/segmentasyon", etiket: "⭐ Segmentasyon" },
    { href: "/segment-takibi", etiket: "🧭 Segment Takibi" },
    { href: "/dusus-uyarilari", etiket: "🚨 Düşüş Uyarıları" },
    { href: "/sube-denetimi", etiket: "📋 Şube Denetimi" },
    { href: "/hizli-skor", etiket: "⚡ Hızlı Skor Girişi" },
    { href: "/bolge-analizi", etiket: "🗺️ Bölge Analizi" },
    { href: "/ciro-karlilik", etiket: "💰 Ciro & Kârlılık" },
    { href: "/ice-disa-aktar", etiket: "📥 İçe / Dışa Aktar" },
    { href: "/dokuman", etiket: "📄 Doküman Yönetimi" },
    ...(profile.rol !== "denetmen" ? [{ href: "/prim-hakedis", etiket: "💵 Prim Hakediş" }] : []),
    ...(adminMi ? [{ href: "/kullanicilar", etiket: "👥 Kullanıcılar" }] : []),
  ];

  return (
    <div className="min-h-screen flex bg-neutral-100 dark:bg-neutral-950">
      <aside
        className="w-60 shrink-0 flex flex-col sticky top-0 h-screen"
        style={{ background: "#1b2030" }}
      >
        <div className="px-4 pt-5 pb-4 border-b border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Adıyaman Çiğköfte" className="h-11 w-auto" />
          <div className="text-[11px] mt-2" style={{ color: "#8b93a5" }}>
            Satış Rapor Paneli
          </div>
        </div>

        <div className="px-4 py-3 border-b border-white/10">
          <div className="text-[13px] font-medium" style={{ color: "#e6e8ec" }}>
            {profile.ad_soyad || "Kullanıcı"}
          </div>
          <div
            className="text-[11px] mt-1 inline-block px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)", color: "#c7ccd6" }}
          >
            {ROL_ETIKET[profile.rol]}
            {profile.bolge ? ` · ${profile.bolge}` : ""}
          </div>
        </div>

        <YanMenuLinkleri ogeler={menu} />

        <form action={cikisYap} className="px-2 pb-4 pt-2 border-t border-white/10">
          <button
            type="submit"
            className="w-full text-left rounded-lg px-3 py-2 text-[13px] hover:bg-white/5"
            style={{ color: "#e57373" }}
          >
            ⏻ Çıkış Yap
          </button>
        </form>
      </aside>

      <main className="flex-1 min-w-0 p-5 md:p-7">{children}</main>
    </div>
  );
}
