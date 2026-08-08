import { profilVeGoruntuleme } from "@/lib/auth";
import { ROL_ETIKET } from "@/types/database";
import { SAYFALAR, BOLUM_SIRASI, gorunurSayfalar } from "@/lib/yetkiler";
import { cikisYap } from "./actions";
import { YanMenuLinkleri, type MenuOgesi } from "./yan-menu";
import { Kabuk } from "./kabuk";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, goruntuleme } = await profilVeGoruntuleme();

  // Menü artık tek kaynaktan üretiliyor: kullanıcının sayfa yetkileri
  // (tanımlı değilse rolün varsayılanı) SAYFALAR listesini süzüyor.
  const izinli = gorunurSayfalar(profile.rol, profile.sayfa_yetkileri);
  const menu: MenuOgesi[] = SAYFALAR.filter((s) => izinli.has(s.anahtar)).map((s) => ({
    href: s.href,
    etiket: s.etiket,
    bolum: s.bolum,
  }));

  // Menünün içeriği sunucuda hazırlanıp Kabuk'a veriliyor; açık/kapalı
  // durumu istemcide tutuluyor (bkz. kabuk.tsx).
  const yanMenu = (
    <>
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

      <YanMenuLinkleri ogeler={menu} bolumler={BOLUM_SIRASI} />

      <form action={cikisYap} className="px-2 pb-4 pt-2 border-t border-white/10">
        <button
          type="submit"
          className="w-full text-left rounded-lg px-3 py-2 text-[13px] hover:bg-white/5"
          style={{ color: "#e57373" }}
        >
          ⏻ Çıkış Yap
        </button>
      </form>
    </>
  );

  return (
    <Kabuk yanMenu={yanMenu}>
      {goruntuleme && (
        <div
          className="yazdirma-gizle sticky top-0 z-30 -mt-4 sm:-mt-5 md:-mt-7 -mx-4 sm:-mx-5 md:-mx-7 mb-4 px-4 sm:px-5 md:px-7 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white shadow"
          style={{ background: "#c0392b" }}
        >
          <span>👁️</span>
          <span>
            <b>{goruntuleme.hedefAd}</b> olarak görüntülüyorsunuz — ekranlar, yetkiler ve prim
            onun gördüğü gibi. Bu moddayken <b>hiçbir değişiklik yapılamaz</b>.
          </span>
          <a
            href="/goruntuleme?cik=1"
            className="ml-auto rounded-md bg-white/20 hover:bg-white/30 px-3 py-1 font-medium"
          >
            Moddan çık
          </a>
        </div>
      )}
      {children}
    </Kabuk>
  );
}
