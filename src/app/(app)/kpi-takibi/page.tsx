import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DonemSecici, donemCoz, subeleriSuz, kapananlarGoruntulensin } from "@/components/donem-secici";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import { gunSayisiMap, type Esik } from "@/lib/analytics";
import {
  kpiKartlariHesapla, kpiAdAnahtari, type KpiHucre, type KpiKarti, type KpiSikayetKaynak,
} from "@/lib/kpi";

/** KPI'nın şikayet sütunu için gereken alanlar. */
type SikayetKpi = KpiSikayetKaynak["sikayetler"][number];
import { pozisyonlariNormalize } from "@/lib/dokuman";
import { gorunurPozisyonlar } from "@/lib/organizasyon";

const CARI_YIL = 2026;

const AY_KISA: Record<string, string> = {
  OCAK: "OCA", ŞUBAT: "ŞUB", MART: "MAR", NİSAN: "NİS", MAYIS: "MAY", HAZİRAN: "HAZ",
  TEMMUZ: "TEM", AĞUSTOS: "AĞU", EYLÜL: "EYL", EKİM: "EKİ", KASIM: "KAS", ARALIK: "ARA",
};

function Hucre({ hucre }: { hucre: KpiHucre | null }) {
  if (!hucre) {
    return <td className="text-center text-neutral-400 text-[13px] py-2 px-1">—</td>;
  }
  if (hucre.na) {
    return (
      <td className="text-center py-2 px-1">
        <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap">
          ★ Tamam
        </span>
      </td>
    );
  }
  return (
    <td
      title={`${hucre.deger} / Hedef: ${hucre.hedef}`}
      className={`text-center py-2 px-1 ${hucre.ok ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"}`}
    >
      <div className="text-base leading-none">{hucre.ok ? "✅" : "❌"}</div>
      <div
        className={`text-[10px] mt-0.5 leading-tight whitespace-nowrap ${hucre.ok ? "text-emerald-600" : "text-red-500"}`}
      >
        {hucre.deger}
      </div>
    </td>
  );
}

function Kart({ kart }: { kart: KpiKarti }) {
  const yuzde = kart.skorToplam ? Math.round((kart.skorTam / kart.skorToplam) * 100) : 0;
  const renk = yuzde >= 75 ? "text-emerald-600" : yuzde >= 50 ? "text-amber-600" : "text-red-500";

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm">{kart.baslik}</h3>
          <div className="text-xs text-neutral-500">{kart.altBaslik}</div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${renk}`}>%{yuzde}</div>
          <div className="text-[11px] text-neutral-500">
            {kart.skorTam}/{kart.skorToplam} hedef
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-xs text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Ay</th>
              {kart.sutunlar.map((s) => (
                <th key={s.anahtar} className="px-2 py-2 text-center whitespace-nowrap">
                  {s.etiket}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kart.satirlar.map((satir) => (
              <tr key={satir.ay} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-3 py-2 font-semibold text-xs whitespace-nowrap">
                  {AY_KISA[satir.ay] ?? satir.ay}
                </td>
                {kart.sutunlar.map((s) => (
                  <Hucre key={s.anahtar} hucre={satir.hucreler[s.anahtar]} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function KpiTakibiSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

  const [
    { data: subeler }, satislar, { data: aylar }, { data: segmentAyar },
    sikayetler, sikayetAtamalari, { data: profiller },
  ] = await Promise.all([
    supabase.from("subeler").select("*").returns<Sube[]>(),
    tumSatirlariGetir<AylikSatis>((from, to) =>
      supabase.from("aylik_satislar").select("*").range(from, to),
    ),
    supabase.from("aylar").select("*").returns<Ay[]>(),
    supabase.from("segment_ayarlari").select("*").eq("id", 1).single(),
    // Şikayet SLA sütunu için (Nezif: "KPI'ı etkilemeli").
    tumSatirlariGetir<SikayetKpi>((f, t) =>
      supabase
        .from("sikayetler")
        .select("id, son_cozum_tarihi, cozuldu_at, kapatildi_at")
        .range(f, t)
        .returns<SikayetKpi[]>(),
    ).catch(() => [] as SikayetKpi[]),
    tumSatirlariGetir<{ sikayet_id: string; profil_id: string }>((f, t) =>
      supabase
        .from("sikayet_atamalari")
        .select("sikayet_id, profil_id")
        .range(f, t)
        .returns<{ sikayet_id: string; profil_id: string }[]>(),
    ).catch(() => [] as { sikayet_id: string; profil_id: string }[]),
    supabase.from("profil_dizini").select("id, ad_soyad").returns<{ id: string; ad_soyad: string }[]>(),
  ]);

  const gunMap = gunSayisiMap(aylar ?? []);
  const donem = donemCoz(aylar ?? [], CARI_YIL, sp);
  const aktifAylar = donem.seciliAylar;
  // Kapanan şubeler raporlarda varsayılan gizli; anahtarla açılabiliyor.
  const tumSubeler = subeler ?? [];
  const aktifSubeler = subeleriSuz(tumSubeler, sp);
  const kapananSayisi = tumSubeler.length - aktifSubeler.length;
  const esikler = (segmentAyar?.esikler ?? []) as Esik[];

  if (!aktifAylar.length) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">KPI Takibi</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Henüz ay verisi yok. <b>Aylar &amp; Veri</b> ekranından ay ekleyin.
        </div>
      </div>
    );
  }

  // Şikayet → görevli eşlemesi. Ad eşleştirmesi kütüphanede yapılıyor;
  // burada yalnızca ham haritalar kuruluyor.
  const gorevliler = new Map<string, string[]>();
  for (const a of sikayetAtamalari) {
    const liste = gorevliler.get(a.sikayet_id);
    if (liste) liste.push(a.profil_id);
    else gorevliler.set(a.sikayet_id, [a.profil_id]);
  }
  const adDanProfil = new Map<string, string>();
  for (const p of profiller ?? []) {
    const a = kpiAdAnahtari(p.ad_soyad || "");
    if (a) adDanProfil.set(a, p.id);
  }

  const tumKartlar = kpiKartlariHesapla(
    aktifSubeler,
    satislar,
    CARI_YIL,
    aktifAylar,
    gunMap,
    esikler,
    { sikayetler, gorevliler, adDanProfil },
  );

  // Admin dışındaki kullanıcı yalnızca kendi kartını ve astlarınınkini görür.
  // ŞİRKET GENELİ herkese açık kalır: şirket hedefinin tutup tutmadığı
  // herkesi ilgilendiriyor ve kişisel bir bilgi değil.
  const { data: dokData } = await supabase
    .from("dokuman_ayarlari")
    .select("pozisyonlar")
    .eq("id", 1)
    .maybeSingle<{ pozisyonlar: unknown }>();
  const pozisyonlar = pozisyonlariNormalize(dokData?.pozisyonlar);
  const gorunurPoz = gorunurPozisyonlar(profile.rol, profile.pozisyon_id, pozisyonlar);

  const trU = (s: string) => s.replace(/i/g, "İ").toLocaleUpperCase("tr").trim();
  const kisiAdlari = gorunurPoz
    ? new Set(
        pozisyonlar
          .filter((p) => gorunurPoz.has(p.id))
          .map((p) => trU(p.adSoyad || ""))
          .filter(Boolean),
      )
    : null;

  const kartlar = kisiAdlari
    ? tumKartlar.filter(
        (k) => trU(k.baslik) === "ŞİRKET GENELİ" || kisiAdlari.has(trU(k.baslik)),
      )
    : tumKartlar;
  const gizlenen = tumKartlar.length - kartlar.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">KPI Takibi</h1>
        <p className="text-sm text-neutral-500">
          Yetkili bazlı aylık hedef tutturma karnesi. Bir hücrenin üzerine gelince gerçekleşen değer
          ve hedef görünür. &quot;—&quot; hedefin hesaplanamadığı ayları gösterir (ör. miktar hedefi
          için önceki 3 ay gerekir).
        </p>
      </div>

      <DonemSecici
        donem={donem}
        kapananGoster={kapananlarGoruntulensin(sp)}
        kapananSayisi={kapananSayisi}
      />

      {gizlenen > 0 && (
        <p className="text-xs text-neutral-500">
          Kendinize ve astlarınıza ait kartlar ile şirket geneli gösteriliyor; {gizlenen} kart
          gizlendi.
        </p>
      )}

      {kartlar.map((k) => (
        <Kart key={k.baslik} kart={k} />
      ))}

      {!kartlar.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Size ait bir KPI kartı yok. Hesabınıza organizasyondaki pozisyon atanmamış olabilir —
          Kullanıcılar ekranından atanabilir.
        </div>
      )}
    </div>
  );
}
