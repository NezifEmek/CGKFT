import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DonemSecici, donemCoz, subeleriSuz, kapananlarGoruntulensin } from "@/components/donem-secici";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay, FiyatModeli } from "@/types/database";
import {
  aySirala,
  gunSayisiMap,
  subeKgOzetleri,
  segmentBul,
  subeCiroHesapla,
  aylikCiroHesapla,
  kumulatifCiroOzet,
  paraFmt,
  type Esik,
  type SubeCiro,
} from "@/lib/analytics";
import { GrupluCubukGrafik, YatayCubukGrafik } from "@/components/grafikler";
import { FiyatForm } from "./fiyat-form";

const CARI_YIL = 2026;

const yuzde1 = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

function Kart({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
        <h3 className="font-medium text-sm">{baslik}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default async function CiroKarlilikSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

  const [{ data: subeler }, satislar, { data: aylar }, { data: fiyatModeli }, { data: segmentAyar }] =
    await Promise.all([
      supabase.from("subeler").select("*").returns<Sube[]>(),
      tumSatirlariGetir<AylikSatis>((from, to) =>
        supabase.from("aylik_satislar").select("*").range(from, to),
      ),
      supabase.from("aylar").select("*").returns<Ay[]>(),
      supabase.from("fiyat_modeli").select("*").eq("id", 1).single<FiyatModeli>(),
      supabase.from("segment_ayarlari").select("*").eq("id", 1).single(),
    ]);

  const gunMap = gunSayisiMap(aylar ?? []);
  const donem = donemCoz(aylar ?? [], CARI_YIL, sp);
  const aktifAylar = donem.seciliAylar;
  // Kapanan şubeler raporlarda varsayılan gizli; anahtarla açılabiliyor.
  const tumSubeler = subeler ?? [];
  const aktifSubeler = subeleriSuz(tumSubeler, sp);
  const kapananSayisi = tumSubeler.length - aktifSubeler.length;
  const subelerListe = aktifSubeler;
  const esikler = (segmentAyar?.esikler ?? []) as Esik[];

  if (!fiyatModeli) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">Ciro & Kârlılık</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-sm text-red-800 dark:text-red-300">
          Fiyat modeli okunamadı. Veritabanı bağlantısını kontrol edin.
        </div>
      </div>
    );
  }

  const birim = fiyatModeli.para_birimi || "TL";
  const trend = aylikCiroHesapla(subelerListe, satislar, CARI_YIL, aktifAylar, fiyatModeli);
  const ozet = kumulatifCiroOzet(trend, fiyatModeli, aktifAylar.length);
  const subeCirolar = subeCiroHesapla(subelerListe, satislar, CARI_YIL, aktifAylar, fiyatModeli);
  const kgOzet = subeKgOzetleri(subelerListe, satislar, CARI_YIL, aktifAylar, gunMap);

  // Bölge ve segment kırılımları
  const bolgeMap = new Map<string, { ciro: number; kar: number }>();
  const segmentMap = new Map<string, { ciro: number; kar: number; renk: string }>();
  for (const sube of subelerListe) {
    const c = subeCirolar.get(sube.id);
    if (!c || c.kg <= 0) continue;

    const b = bolgeMap.get(sube.bolge) ?? { ciro: 0, kar: 0 };
    b.ciro += c.ciro;
    b.kar += c.kar;
    bolgeMap.set(sube.bolge, b);

    const seg = segmentBul(kgOzet.get(sube.id)?.kgGunluk ?? 0, esikler);
    if (seg) {
      const s = segmentMap.get(seg.ad) ?? { ciro: 0, kar: 0, renk: seg.renk };
      s.ciro += c.ciro;
      s.kar += c.kar;
      segmentMap.set(seg.ad, s);
    }
  }

  const bolgeler = [...bolgeMap.entries()].sort((a, b) => b[1].kar - a[1].kar);
  const segmentler = [...segmentMap.entries()].sort(
    (a, b) => (esikler.find((e) => e.ad === b[0])?.min ?? 0) - (esikler.find((e) => e.ad === a[0])?.min ?? 0),
  );

  const subeSatirlari = subelerListe
    .map((s) => ({ sube: s, ciro: subeCirolar.get(s.id) as SubeCiro }))
    .filter((r) => r.ciro && r.ciro.kg > 0)
    .sort((a, b) => b.ciro.kar - a.ciro.kar);

  const duzenleyebilir = profile.rol === "admin" || profile.rol === "genel_mudur";

  const kartlar = [
    { etiket: "Toplam Ciro", deger: paraFmt(ozet.ciro, birim), renk: "#2563eb" },
    { etiket: "Toplam Maliyet", deger: paraFmt(ozet.maliyet, birim), renk: "#f59e0b" },
    { etiket: "Brüt Kâr", deger: paraFmt(ozet.brutKar, birim), renk: "#16a34a" },
    {
      etiket: "Net Kâr",
      deger: paraFmt(ozet.netKar, birim),
      renk: "#7c3aed",
      alt: ozet.sabit > 0 ? `sabit gider: ${paraFmt(ozet.sabit, birim)}` : undefined,
    },
    { etiket: "Brüt Marj", deger: `%${yuzde1(ozet.marj * 100)}`, renk: "#c0392b" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Ciro & Kârlılık</h1>
        <p className="text-sm text-neutral-500">
          {aktifAylar[0]} – {aktifAylar[aktifAylar.length - 1]} · kg × birim fiyat üzerinden
          hesaplanan <b>varsayımsal</b> ciro modeli (gerçek fatura verisi değildir).
        </p>
      </div>

      <DonemSecici
        donem={donem}
        kapananGoster={kapananlarGoruntulensin(sp)}
        kapananSayisi={kapananSayisi}
      />

      {duzenleyebilir && <FiyatForm model={fiyatModeli} />}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kartlar.map((k) => (
          <div
            key={k.etiket}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 border-l-4"
            style={{ borderLeftColor: k.renk }}
          >
            <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">
              {k.etiket}
            </div>
            <div className="text-lg font-bold">{k.deger}</div>
            {k.alt && <div className="text-[11px] text-neutral-400 mt-0.5">{k.alt}</div>}
          </div>
        ))}
      </div>

      <Kart baslik="Aylık Ciro / Maliyet / Kâr">
        <GrupluCubukGrafik
          etiketler={aktifAylar}
          paraBirimi={birim}
          seriler={[
            { ad: "Ciro", degerler: trend.map((t) => t.ciro), renk: "#2563eb" },
            { ad: "Maliyet", degerler: trend.map((t) => t.maliyet), renk: "#f59e0b" },
            { ad: "Brüt Kâr", degerler: trend.map((t) => t.brutKar), renk: "#16a34a" },
          ]}
        />
      </Kart>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Kart baslik="Bölgelere Göre Kâr">
          <YatayCubukGrafik
            etiketler={bolgeler.map(([ad]) => ad)}
            degerler={bolgeler.map(([, v]) => v.kar)}
            renk="#16a34a"
            yukseklik={Math.max(240, bolgeler.length * 34)}
          />
        </Kart>
        <Kart baslik="Segmentlere Göre Kâr">
          <YatayCubukGrafik
            etiketler={segmentler.map(([ad]) => ad)}
            degerler={segmentler.map(([, v]) => v.kar)}
            renk="#7c3aed"
            yukseklik={Math.max(240, segmentler.length * 34)}
          />
        </Kart>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 font-medium text-sm">
          Şube Kârlılığı ({subeSatirlari.length} şube)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-2">Şube</th>
                <th className="px-4 py-2">Bölge</th>
                <th className="px-4 py-2">Tip</th>
                <th className="px-4 py-2 text-right">Fiyat</th>
                <th className="px-4 py-2 text-right">Kg</th>
                <th className="px-4 py-2 text-right">Ciro</th>
                <th className="px-4 py-2 text-right">Maliyet</th>
                <th className="px-4 py-2 text-right">Kâr</th>
                <th className="px-4 py-2 text-right">Marj</th>
              </tr>
            </thead>
            <tbody>
              {subeSatirlari.map(({ sube, ciro }) => (
                <tr
                  key={sube.id}
                  className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                >
                  <td className="px-4 py-2 font-medium">{sube.ad}</td>
                  <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{sube.bolge}</td>
                  <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                    {sube.tip === "MS" ? "MŞ" : `FR·${sube.fiyat_grubu === "lojistik" ? "loj" : "dağ"}`}
                  </td>
                  <td className="px-4 py-2 text-right text-neutral-500">{ciro.fiyat}</td>
                  <td className="px-4 py-2 text-right">
                    {new Intl.NumberFormat("tr-TR").format(Math.round(ciro.kg))}
                  </td>
                  <td className="px-4 py-2 text-right">{paraFmt(ciro.ciro, birim)}</td>
                  <td className="px-4 py-2 text-right text-neutral-500">
                    {paraFmt(ciro.maliyet, birim)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${ciro.kar >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {paraFmt(ciro.kar, birim)}
                  </td>
                  <td className="px-4 py-2 text-right">%{yuzde1(ciro.marj * 100)}</td>
                </tr>
              ))}
              {!subeSatirlari.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-neutral-400">
                    Görünür veri yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
