import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay, Denetim } from "@/types/database";
import {
  aySirala,
  gunSayisiMap,
  subeKgOzetleri,
  segmentBul,
  aylikSegmentMatrisi,
  aylikTrendHesapla,
  kumulatifOzetHesapla,
  kgFmt,
  yuzdeFmt,
  type Esik,
} from "@/lib/analytics";
import { CokluCizgiGrafik } from "@/components/grafikler";

const CARI_YIL = 2026;

/** Eski paneldeki YT_PALET'in karşılığı — bilinmeyen yetkililer için yedek renk. */
const PALET: Record<string, string> = {
  "İZZET ALTUĞ": "#c0392b",
  "UMUT CAN DOĞAN": "#2563eb",
  "METİN BAŞOK": "#16a34a",
};
const YEDEK_RENKLER = ["#7c3aed", "#f59e0b", "#0891b2", "#db2777"];

const fmt2 = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function siraSembol(sira: number) {
  return ["🥇", "🥈", "🥉"][sira] ?? `${sira + 1}.`;
}

export default async function YetkiliAnaliziSayfasi() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: subeler }, satislar, { data: aylar }, { data: segmentAyar }, { data: denetimler }] =
    await Promise.all([
      supabase.from("subeler").select("*").returns<Sube[]>(),
      tumSatirlariGetir<AylikSatis>((from, to) =>
        supabase.from("aylik_satislar").select("*").range(from, to),
      ),
      supabase.from("aylar").select("*").returns<Ay[]>(),
      supabase.from("segment_ayarlari").select("*").eq("id", 1).single(),
      supabase.from("denetimler").select("*").returns<Denetim[]>(),
    ]);

  const subelerListe = subeler ?? [];
  const gunMap = gunSayisiMap(aylar ?? []);
  const aktifAylar = aySirala((aylar ?? []).filter((a) => a.yil === CARI_YIL).map((a) => a.ay));
  const esikler = (segmentAyar?.esikler ?? []) as Esik[];

  const yetkililer = [...new Set(subelerListe.map((s) => s.merkez_yetkilisi).filter(Boolean))].sort();

  if (!yetkililer.length || !aktifAylar.length) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">Yetkili Analizi</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          {!aktifAylar.length
            ? "Henüz ay verisi yok."
            : "Şubelerde merkez yetkilisi tanımlanmamış. Şube Yönetimi ekranından atayabilirsiniz."}
        </div>
      </div>
    );
  }

  // Kümülatif segment için tüm şubelerin kg/gün ortalaması
  const kgOzet = subeKgOzetleri(subelerListe, satislar, CARI_YIL, aktifAylar, gunMap);
  const siraliEsikler = [...esikler].sort((a, b) => b.min - a.min);
  const ustSegmentler = new Set(siraliEsikler.slice(0, 3).map((e) => e.ad)); // ★, A+, A

  const denetimOrt = new Map<string, { ort: number | null; sayi: number }>();

  const veri = yetkililer.map((yt, i) => {
    const kapsam = subelerListe.filter((s) => s.merkez_yetkilisi === yt);
    const trend = aylikTrendHesapla(kapsam, satislar, CARI_YIL, aktifAylar, gunMap);
    const kum = kumulatifOzetHesapla(kapsam, trend);

    // Son ay büyümesi (MoM)
    const n = trend.length;
    const son = n >= 1 ? trend[n - 1].kg : 0;
    const onceki = n >= 2 ? trend[n - 2].kg : 0;
    const sonAyDeg = n >= 2 && son !== 0 && onceki > 0 ? (son - onceki) / onceki : null;

    // Kalite oranı: üst 3 segmentteki şube / aktif şube
    const iyiSube = kapsam.filter((s) => {
      const seg = segmentBul(kgOzet.get(s.id)?.kgGunluk ?? 0, esikler);
      return seg ? ustSegmentler.has(seg.ad) : false;
    }).length;
    const iyiOran = kum.aktifSube ? iyiSube / kum.aktifSube : 0;

    // Net segment trendi
    const matris = aylikSegmentMatrisi(kapsam, satislar, CARI_YIL, aktifAylar, gunMap, esikler);
    const netYukselen = matris.filter((x) => x.netTrend > 0).length;
    const netDusen = matris.filter((x) => x.netTrend < 0).length;

    // Denetim ortalaması
    const idSet = new Set(kapsam.map((s) => s.id));
    const puanlar = (denetimler ?? [])
      .filter((d) => idSet.has(d.sube_id) && d.puan != null)
      .map((d) => Number(d.puan));
    const ort = puanlar.length
      ? Math.round(puanlar.reduce((t, p) => t + p, 0) / puanlar.length)
      : null;
    denetimOrt.set(yt, { ort, sayi: puanlar.length });

    return {
      yt,
      renk: PALET[yt] ?? YEDEK_RENKLER[i % YEDEK_RENKLER.length],
      kapsam,
      trend,
      kum,
      sonAyKg: son,
      sonAyDeg,
      iyiSube,
      iyiOran,
      netYukselen,
      netDusen,
      denetimOrt: ort,
      denetimSayi: puanlar.length,
    };
  });

  // ── Sıralama: her metrikte 1. (N puan) → sonuncu (1 puan) ────────────────
  const metrikler = [
    { ad: "Kümülatif kg", val: (d: (typeof veri)[number]) => d.kum.kg, goster: (d: (typeof veri)[number]) => kgFmt(d.kum.kg) },
    { ad: "Son ay büyüme", val: (d: (typeof veri)[number]) => d.sonAyDeg ?? -Infinity, goster: (d: (typeof veri)[number]) => (d.sonAyDeg == null ? "—" : yuzdeFmt(d.sonAyDeg * 100)) },
    { ad: "Ort. kg/gün", val: (d: (typeof veri)[number]) => d.kum.ort, goster: (d: (typeof veri)[number]) => fmt2(d.kum.ort) },
    { ad: "Kalite şube %", val: (d: (typeof veri)[number]) => d.iyiOran, goster: (d: (typeof veri)[number]) => `%${Math.round(d.iyiOran * 100)}` },
    { ad: "Net segment ↑", val: (d: (typeof veri)[number]) => d.netYukselen, goster: (d: (typeof veri)[number]) => String(d.netYukselen) },
    { ad: "Denetim ort. /100", val: (d: (typeof veri)[number]) => d.denetimOrt ?? -1, goster: (d: (typeof veri)[number]) => (d.denetimOrt == null ? "—" : `${d.denetimOrt}/100`) },
  ];

  // Eşit değerler eşit sıra ve eşit puan alır (spor sıralaması). Aksi halde
  // aynı sayıya sahip iki yetkili farklı puan alır ve hiç denetim kaydı yokken
  // bile birine avantaj doğardı.
  const puanlar = new Map<string, number>(veri.map((d) => [d.yt, 0]));
  const metrikSiralari = metrikler.map((m) => {
    const sirali = [...veri].sort((a, b) => m.val(b) - m.val(a));
    const siraMap = new Map<string, number>();
    sirali.forEach((d, i) => {
      const oncekiAyni = i > 0 && m.val(sirali[i - 1]) === m.val(d);
      const sira = oncekiAyni ? (siraMap.get(sirali[i - 1].yt) ?? i) : i;
      siraMap.set(d.yt, sira);
      puanlar.set(d.yt, (puanlar.get(d.yt) ?? 0) + (veri.length - sira));
    });
    return { metrik: m, siraMap };
  });

  const genelSira = new Map<string, number>();
  const puanSirali = [...puanlar.entries()].sort((a, b) => b[1] - a[1]);
  puanSirali.forEach(([yt, p], i) => {
    const oncekiAyni = i > 0 && puanSirali[i - 1][1] === p;
    genelSira.set(yt, oncekiAyni ? (genelSira.get(puanSirali[i - 1][0]) ?? i) : i);
  });

  const maksPuan = metrikler.length * veri.length;
  const sonAy = aktifAylar[aktifAylar.length - 1];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Yetkili Analizi</h1>
        <p className="text-sm text-neutral-500">
          Her merkez yetkilisi, sorumluluğundaki şubelerin kümülatif satışına, segment hareketlerine
          ve denetim performansına göre değerlendirilir. Son ay: <b>{sonAy}</b>.
        </p>
      </div>

      {/* Yetkili kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {veri.map((d) => {
          const sira = genelSira.get(d.yt) ?? 0;
          const ms = d.kapsam.filter((s) => s.tip === "MS").length;
          const fr = d.kapsam.filter((s) => s.tip === "FR").length;
          return (
            <div
              key={d.yt}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 border-t-4 relative"
              style={{ borderTopColor: d.renk }}
            >
              <div className="absolute top-3 right-4 text-xl" title="Genel sıralama">
                {siraSembol(sira)}
              </div>
              <h3 className="font-semibold text-sm">{d.yt}</h3>
              <div className="text-xs text-neutral-500 mb-3">
                {d.kapsam.length} şube · {ms} MŞ / {fr} FR
              </div>

              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Kümülatif</dt>
                  <dd className="font-semibold">{kgFmt(d.kum.kg)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Ort. kg/gün</dt>
                  <dd>{fmt2(d.kum.ort)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">{sonAy}</dt>
                  <dd>
                    {kgFmt(d.sonAyKg)}{" "}
                    {d.sonAyDeg != null && (
                      <span className={d.sonAyDeg >= 0 ? "text-emerald-600" : "text-red-500"}>
                        ({yuzdeFmt(d.sonAyDeg * 100)})
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Kalite şube</dt>
                  <dd>
                    {d.iyiSube} / {d.kum.aktifSube} (%{Math.round(d.iyiOran * 100)})
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Segment trendi</dt>
                  <dd>
                    <span className="text-emerald-600">▲ {d.netYukselen}</span>{" "}
                    <span className="text-red-500">▼ {d.netDusen}</span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Denetim ort.</dt>
                  <dd>
                    {d.denetimOrt == null ? (
                      <span className="text-neutral-400">— (kayıt yok)</span>
                    ) : (
                      `${d.denetimOrt}/100 (${d.denetimSayi})`
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-between text-sm">
                <span className="text-neutral-500">Toplam puan</span>
                <span className="font-bold">
                  {puanlar.get(d.yt)} / {maksPuan}
                  <span className="text-neutral-400 font-normal ml-1.5">
                    (%{maksPuan ? Math.round(((puanlar.get(d.yt) ?? 0) / maksPuan) * 100) : 0})
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sıralama tablosu */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 font-medium text-sm">
          Metrik Bazlı Sıralama
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left">Metrik</th>
                {veri.map((d) => (
                  <th key={d.yt} className="px-4 py-2 text-right whitespace-nowrap">
                    {d.yt}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrikSiralari.map(({ metrik, siraMap }) => (
                <tr key={metrik.ad} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 font-medium text-xs">{metrik.ad}</td>
                  {veri.map((d) => {
                    const sira = siraMap.get(d.yt) ?? 0;
                    return (
                      <td key={d.yt} className="px-4 py-2 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs font-bold whitespace-nowrap">
                            {siraSembol(sira)} {veri.length - sira}p
                          </span>
                          <span className="text-[10px] text-neutral-500">{metrik.goster(d)}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                <td className="px-4 py-2 text-xs font-bold">TOPLAM</td>
                {veri.map((d) => (
                  <td key={d.yt} className="px-4 py-2 text-right font-bold text-sm whitespace-nowrap">
                    {siraSembol(genelSira.get(d.yt) ?? 0)} {puanlar.get(d.yt)} / {maksPuan}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Aylık trend */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 font-medium text-sm">
          Yetkili Bazlı Aylık Satış (kg)
        </div>
        <div className="p-4">
          <CokluCizgiGrafik
            etiketler={aktifAylar}
            seriler={veri.map((d) => ({
              ad: d.yt,
              degerler: d.trend.map((t) => t.kg),
              renk: d.renk,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
