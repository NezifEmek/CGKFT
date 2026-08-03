// Bekleyen Konular — giriş sonrası ilk karşılaşılan ekran.
//
// Nezif'in isteği: "Genel Bakış'ın başına koyduğun uyarıyı bu şekilde
// yapmak yerine en başta bekleyen konular gibi bir sayfa yapsan. Kendisine
// atanan şikayet, franchise başvurusu gibi konuları ilgili kişi oradan
// görse. Hesabına ilk girdiğinde de bu sayfa karşılasa iyi olur."
//
// İki katman var ve bilerek ayrı duruyorlar:
//   ÜST  — kişisel: doğrudan size atanmış işler, tek tek adıyla.
//   ALT  — genel: yetki alanınızda aksiyon bekleyen sayılar (eski dikkat
//          paneli, Genel Bakış'tan buraya taşındı).
//
// Sorgular RLS'li istemciyle yapılıyor; kullanıcı zaten yalnızca görme
// yetkisi olduğu kayıtları çeker. Şikayet ve görev kişiye kimlikle bağlı
// olduğu için kendi işini görmesi her hâlükârda garanti.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import { DikkatPaneli } from "@/components/dikkat-paneli";
import { dikkatSatirlari } from "@/lib/dikkat";
import {
  bekleyenBolumler, bekleyenToplam, gecikmisToplam, gecikmeYaz, haftaBasi,
  type BekleyenGirdi, type BekleyenKayit,
} from "@/lib/bekleyen";

export const dynamic = "force-dynamic";

const kart =
  "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900";

/** Bir bölümde en fazla kaç kayıt listelenir; gerisi bağlantıyla açılır. */
const LISTE_SINIRI = 15;

/** Tablo yoksa (migration çalışmamışsa) sayfa çökmesin, boş dizi dönsün. */
async function guvenli<T>(f: () => Promise<T[]>): Promise<T[]> {
  try {
    return await f();
  } catch {
    return [];
  }
}

function tarihYaz(t: string | null): string {
  if (!t) return "";
  const [y, a, g] = t.slice(0, 10).split("-");
  return g && a && y ? `${g}.${a}.${y}` : t;
}

export default async function BekleyenlerSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const bugun = new Date().toISOString().slice(0, 10);
  const yonetimMi = profile.rol === "admin" || profile.rol === "genel_mudur";

  const hepsi = <T,>(tablo: string, secim: string) =>
    guvenli<T>(() =>
      tumSatirlariGetir<T>((f, t) =>
        supabase.from(tablo).select(secim).range(f, t).returns<T[]>(),
      ),
    );

  const [
    sikayetler, sikayetAtamalari, gorevler, franchiseler, planlar,
    ertelemeler, oneriler, sozlesmeler, denetimler, subeler,
  ] = await Promise.all([
    hepsi<BekleyenGirdi["sikayetler"][number]>(
      "sikayetler", "id, sikayet_no, kategori, aciklama, durum, oncelik, son_cozum_tarihi"),
    hepsi<BekleyenGirdi["sikayetAtamalari"][number]>(
      "sikayet_atamalari", "sikayet_id, profil_id"),
    hepsi<BekleyenGirdi["gorevler"][number]>(
      "toplanti_gorevleri", "id, baslik, aciklama, atanan_id, termin, durum"),
    hepsi<BekleyenGirdi["franchiseler"][number]>(
      "franchise_basvurulari",
      "id, basvuru_no, isim, il, ilce, son_durum, sirket_sorumlusu, sorumlu_arama_tarihi, tarih"),
    // Haftalık plan yalnızca bu hafta lazım — tamamını çekmeye gerek yok.
    guvenli<BekleyenGirdi["planlar"][number] & { subeler?: { ad: string } | null }>(() =>
      tumSatirlariGetir((f, t) =>
        supabase
          .from("haftalik_plan")
          .select("id, profil_id, hafta, gun, tur, baslik, durum, subeler(ad)")
          .eq("hafta", haftaBasi(bugun))
          .range(f, t)
          .returns<(BekleyenGirdi["planlar"][number] & { subeler?: { ad: string } | null })[]>(),
      ),
    ),
    hepsi<{ id: string; onay_durumu: string; toplanti_gorevleri?: { baslik: string } | null }>(
      "gorev_ertelemeleri", "id, onay_durumu, toplanti_gorevleri(baslik)"),
    hepsi<{ id: string; baslik: string; durum: string }>("oneriler", "id, baslik, durum"),
    hepsi<{ id: string; bitis: string | null; uyari_gun: number }>(
      "sozlesmeler", "id, bitis, uyari_gun"),
    hepsi<{ sube_id: string; tarih: string }>("denetimler", "sube_id, tarih"),
    hepsi<{ id: string; aktif: boolean | null }>("subeler", "id, aktif"),
  ]);

  // ── Kişisel bölümler ──────────────────────────────────────────────────
  const bolumler = bekleyenBolumler({
    bugun,
    benimId: profile.id,
    benimAdim: profile.ad_soyad ?? "",
    yonetimMi,
    sikayetler,
    sikayetAtamalari,
    gorevler,
    franchiseler,
    planlar: planlar.map((p) => ({ ...p, sube_adi: p.subeler?.ad })),
    ertelemeler: ertelemeler.map((e) => ({
      id: e.id,
      onay_durumu: e.onay_durumu,
      gorev_basligi: e.toplanti_gorevleri?.baslik,
    })),
    oneriler,
  });

  const toplam = bekleyenToplam(bolumler);
  const gecikmis = gecikmisToplam(bolumler);

  // ── Genel dikkat satırları (Genel Bakış'tan taşındı) ──────────────────
  const sonDenetim = new Map<string, string>();
  for (const d of denetimler) {
    const onceki = sonDenetim.get(d.sube_id);
    if (!onceki || d.tarih > onceki) sonDenetim.set(d.sube_id, d.tarih);
  }
  const dikkat = dikkatSatirlari({
    bugun,
    sikayetler,
    sikayetAtamalari,
    sozlesmeler,
    gorevler,
    ertelemeler,
    oneriler,
    subeDenetimleri: subeler
      .filter((s) => s.aktif !== false)
      .map((s) => ({ subeId: s.id, sonDenetim: sonDenetim.get(s.id) ?? null })),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold mb-1">Bekleyen Konular</h1>
        <p className="text-sm text-neutral-500">
          {profile.ad_soyad ? `Merhaba ${profile.ad_soyad}. ` : ""}
          {toplam === 0
            ? "Üzerinize atanmış bekleyen bir iş görünmüyor."
            : `Üzerinizde ${toplam} bekleyen iş var${
                gecikmis ? `, bunların ${gecikmis} tanesinin süresi geçmiş` : ""
              }.`}
        </p>
      </div>

      {toplam === 0 ? (
        <div className={kart + " p-8 text-center"}>
          <div className="text-3xl mb-2">✅</div>
          <p className="text-sm font-medium">Üzerinize atanmış bekleyen iş yok.</p>
          <p className="text-xs text-neutral-500 mt-1">
            Size bir şikayet, görev veya franchise başvurusu atandığında burada görünür.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bolumler.map((b) => (
            <section key={b.anahtar} className={kart + " overflow-hidden"}>
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-baseline gap-2 flex-wrap">
                <h2 className="text-sm font-semibold">
                  {b.simge} {b.baslik}
                </h2>
                <span className="text-xs text-neutral-400">({b.kayitlar.length})</span>
                <Link
                  href={b.href}
                  className="ml-auto text-xs text-neutral-500 hover:underline"
                >
                  tümünü aç →
                </Link>
                <p className="w-full text-[11px] text-neutral-500">{b.aciklama}</p>
              </div>
              <ul>
                {b.kayitlar.slice(0, LISTE_SINIRI).map((k) => (
                  <Satir key={k.id} k={k} />
                ))}
              </ul>
              {/* Umut Can Doğan'ın 42 açık franchise başvurusu var; hepsini
                  alt alta basmak sayfayı kullanılmaz hâle getirirdi. En acil
                  olanlar üstte olduğu için ilk 15 yeterli. */}
              {b.kayitlar.length > LISTE_SINIRI && (
                <Link
                  href={b.href}
                  className="block border-t border-neutral-100 dark:border-neutral-800 px-4 py-2.5 text-xs text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                >
                  … ve {b.kayitlar.length - LISTE_SINIRI} kayıt daha — tümünü görmek için
                  tıklayın
                </Link>
              )}
            </section>
          ))}
        </div>
      )}

      {/* ── Genel: yetki alanımdaki durum ───────────────────────────── */}
      {dikkat.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            Yetki alanımda dikkat gerektirenler
          </h2>
          <p className="text-xs text-neutral-500">
            Bunlar size atanmış işler değil — görme yetkiniz olan kayıtlar arasında
            aksiyon bekleyenlerin sayısı.
          </p>
          <DikkatPaneli satirlar={dikkat} />
        </div>
      )}
    </div>
  );
}

function Satir({ k }: { k: BekleyenKayit }) {
  const gecikti = (k.gecikme ?? -1) > 0;
  const bugunSon = k.gecikme === 0;

  return (
    <li className="border-t border-neutral-100 dark:border-neutral-800 first:border-t-0">
      <Link
        href={k.href}
        className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
      >
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            gecikti
              ? "bg-red-500"
              : bugunSon
              ? "bg-amber-500"
              : k.acil
              ? "bg-amber-400"
              : "bg-neutral-300 dark:bg-neutral-600"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-tight">{k.baslik}</span>
          {k.aciklama && (
            <span className="block text-xs text-neutral-500 leading-snug mt-0.5">
              {k.aciklama}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[10px] uppercase tracking-wide text-neutral-400">
            {k.rozet}
          </span>
          {k.termin && (
            <span
              className={`block text-xs ${
                gecikti
                  ? "text-red-600 font-medium"
                  : bugunSon
                  ? "text-amber-600 font-medium"
                  : "text-neutral-500"
              }`}
            >
              {tarihYaz(k.termin)}
              {k.gecikme != null && ` · ${gecikmeYaz(k.gecikme)}`}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
