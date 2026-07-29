import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import {
  aySirala,
  gunSayisiMap,
  subeKgOzetleri,
  segmentBul,
  kgFmt,
  yuzdeFmt,
  type Esik,
} from "@/lib/analytics";

const CARI_YIL = 2026;
const ONCEKI_YIL = 2025;

export default async function Top30Sayfasi() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: subeler }, satislar, { data: aylar }, { data: segmentAyar }] =
    await Promise.all([
      supabase.from("subeler").select("*").returns<Sube[]>(),
      tumSatirlariGetir<AylikSatis>((from, to) =>
        supabase.from("aylik_satislar").select("*").range(from, to),
      ),
      supabase.from("aylar").select("*").returns<Ay[]>(),
      supabase.from("segment_ayarlari").select("*").eq("id", 1).single(),
    ]);

  const gunMap = gunSayisiMap(aylar ?? []);
  const aktifAylar = aySirala((aylar ?? []).filter((a) => a.yil === CARI_YIL).map((a) => a.ay));
  const esikler = (segmentAyar?.esikler ?? []) as Esik[];

  const ozetCari = subeKgOzetleri(subeler ?? [], satislar, CARI_YIL, aktifAylar, gunMap);
  const ozetOnceki = subeKgOzetleri(subeler ?? [], satislar, ONCEKI_YIL, aktifAylar, gunMap);

  const sonAy = aktifAylar[aktifAylar.length - 1];
  const oncekiAy = aktifAylar[aktifAylar.length - 2];

  const satirlar = (subeler ?? [])
    .map((sube) => {
      const ozet = ozetCari.get(sube.id);
      const oncekiYilOzet = ozetOnceki.get(sube.id);
      const toplamKg = ozet?.toplamKg ?? 0;
      if (toplamKg <= 0) return null;

      const sonAyKg = sonAy ? ozet?.aylikKg[sonAy] ?? null : null;
      const oncekiAyKg = oncekiAy ? ozet?.aylikKg[oncekiAy] ?? null : null;
      const momYuzde =
        sonAyKg != null && oncekiAyKg != null && oncekiAyKg > 0
          ? ((sonAyKg - oncekiAyKg) / oncekiAyKg) * 100
          : null;

      const yoyToplam = oncekiYilOzet?.toplamKg ?? 0;
      const yoyYuzde = yoyToplam > 0 ? ((toplamKg - yoyToplam) / yoyToplam) * 100 : null;

      const segment = segmentBul(ozet?.kgGunluk ?? 0, esikler);

      return {
        sube,
        toplamKg,
        kgGunluk: ozet?.kgGunluk ?? 0,
        momYuzde,
        yoyYuzde,
        segment,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.toplamKg - a.toplamKg)
    .slice(0, 30);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Top 30 Şube</h1>
      <p className="text-sm text-neutral-500 mb-6">
        {aktifAylar[0]} – {sonAy} kümülatif kg&apos;a göre en yüksek satış yapan 30 şube.
      </p>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Şube</th>
              <th className="px-4 py-2">Bölge</th>
              <th className="px-4 py-2 text-right">Toplam Kg</th>
              <th className="px-4 py-2 text-right">Kg/Gün</th>
              <th className="px-4 py-2 text-right">Segment</th>
              <th className="px-4 py-2 text-right">{oncekiAy ?? "-"}→{sonAy ?? "-"}</th>
              <th className="px-4 py-2 text-right">YoY ({ONCEKI_YIL})</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((row, i) => (
              <tr
                key={row.sube.id}
                className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
              >
                <td className="px-4 py-2 text-neutral-400">{i + 1}</td>
                <td className="px-4 py-2 font-medium">{row.sube.ad}</td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{row.sube.bolge}</td>
                <td className="px-4 py-2 text-right">{kgFmt(row.toplamKg)}</td>
                <td className="px-4 py-2 text-right">{row.kgGunluk.toFixed(1)}</td>
                <td className="px-4 py-2 text-right">
                  {row.segment && (
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: row.segment.renk }}
                    >
                      {row.segment.ad}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {row.momYuzde != null ? (
                    <span className={row.momYuzde >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {yuzdeFmt(row.momYuzde)}
                    </span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {row.yoyYuzde != null ? (
                    <span className={row.yoyYuzde >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {yuzdeFmt(row.yoyYuzde)}
                    </span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!satirlar.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-400">
                  Görünür veri yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
