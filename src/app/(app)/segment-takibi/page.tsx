import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DonemSecici, donemCoz } from "@/components/donem-secici";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import { aySirala, gunSayisiMap, aylikSegmentMatrisi, type Esik } from "@/lib/analytics";

const CARI_YIL = 2026;

const SEGMENT_RENK: Record<string, string> = {
  "★": "#f59e0b",
  "A+": "#10b981",
  A: "#22c55e",
  B: "#3b82f6",
  C: "#6366f1",
  D: "#a855f7",
  E: "#ef4444",
};

export default async function SegmentTakibiSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

  const [{ data: subeler }, satislar, { data: aylar }, { data: segmentAyar }] =
    await Promise.all([
      supabase.from("subeler").select("*").order("bolge").order("ad").returns<Sube[]>(),
      tumSatirlariGetir<AylikSatis>((from, to) =>
        supabase.from("aylik_satislar").select("*").range(from, to),
      ),
      supabase.from("aylar").select("*").returns<Ay[]>(),
      supabase.from("segment_ayarlari").select("*").eq("id", 1).single(),
    ]);

  const gunMap = gunSayisiMap(aylar ?? []);
  const donem = donemCoz(aylar ?? [], CARI_YIL, sp);
  const aktifAylar = donem.seciliAylar;
  const esikler = (segmentAyar?.esikler ?? []) as Esik[];

  const matris = aylikSegmentMatrisi(
    subeler ?? [],
    satislar,
    CARI_YIL,
    aktifAylar,
    gunMap,
    esikler,
  ).filter((r) => Object.keys(r.aySegment).length > 0);

  // Hareket raporu: ardışık ay çiftlerinde segment değiştiren şubeler
  const hareketler: { subeAd: string; bolge: string; ay1: string; ay2: string; onceki: string; sonraki: string; yon: "yukselis" | "dusus" }[] = [];
  for (let i = 1; i < aktifAylar.length; i++) {
    const onceki = aktifAylar[i - 1];
    const sonraki = aktifAylar[i];
    for (const satir of matris) {
      const a = satir.aySegment[onceki];
      const b = satir.aySegment[sonraki];
      if (!a || !b || a === b) continue;
      const siraliEsikler = [...esikler].sort((x, y) => y.min - x.min);
      const siraliA = siraliEsikler.findIndex((e) => e.ad === a);
      const siraliB = siraliEsikler.findIndex((e) => e.ad === b);
      hareketler.push({
        subeAd: satir.subeAd,
        bolge: satir.bolge,
        ay1: onceki,
        ay2: sonraki,
        onceki: a,
        sonraki: b,
        yon: siraliB < siraliA ? "yukselis" : "dusus",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Segment Takibi</h1>
        <p className="text-sm text-neutral-500">
          Her şubenin, o aya özel kg/gün ortalamasına göre aylık segment değişimi.
        </p>
      </div>

      <DonemSecici donem={donem} />

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 sticky left-0 bg-neutral-50 dark:bg-neutral-800/50">Şube</th>
              <th className="px-4 py-2">Bölge</th>
              {aktifAylar.map((ay) => (
                <th key={ay} className="px-3 py-2 text-center">
                  {ay}
                </th>
              ))}
              <th className="px-4 py-2 text-right">Net Trend</th>
            </tr>
          </thead>
          <tbody>
            {matris.map((satir) => (
              <tr
                key={satir.subeId}
                className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
              >
                <td className="px-4 py-2 font-medium sticky left-0 bg-white dark:bg-neutral-900">
                  {satir.subeAd}
                </td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{satir.bolge}</td>
                {aktifAylar.map((ay) => {
                  const seg = satir.aySegment[ay];
                  return (
                    <td key={ay} className="px-3 py-2 text-center">
                      {seg ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: SEGMENT_RENK[seg] ?? "#999" }}
                        >
                          {seg}
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right">
                  {satir.netTrend > 0 && <span className="text-emerald-600">▲ {satir.netTrend}</span>}
                  {satir.netTrend < 0 && <span className="text-red-600">▼ {Math.abs(satir.netTrend)}</span>}
                  {satir.netTrend === 0 && <span className="text-neutral-400">–</span>}
                </td>
              </tr>
            ))}
            {!matris.length && (
              <tr>
                <td colSpan={aktifAylar.length + 3} className="px-4 py-8 text-center text-neutral-400">
                  Görünür veri yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 font-medium text-sm">
          Hareket Raporu ({hareketler.length} değişim)
        </div>
        <div className="max-h-96 overflow-y-auto">
          {hareketler.map((h, i) => (
            <div
              key={i}
              className="px-4 py-2 text-sm flex items-center justify-between border-b border-neutral-50 dark:border-neutral-800/50 last:border-0"
            >
              <span>
                {h.subeAd} <span className="text-neutral-400 text-xs">({h.bolge})</span>
              </span>
              <span className="text-neutral-500 text-xs">
                {h.ay1} → {h.ay2}
              </span>
              <span className={h.yon === "yukselis" ? "text-emerald-600" : "text-red-600"}>
                {h.onceki} → {h.sonraki}
              </span>
            </div>
          ))}
          {!hareketler.length && (
            <div className="px-4 py-6 text-center text-neutral-400 text-sm">Segment değişimi yok.</div>
          )}
        </div>
      </div>
    </div>
  );
}
