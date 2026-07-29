import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import {
  aySirala,
  gunSayisiMap,
  subeKgOzetleri,
  kirilimHesapla,
  segmentBul,
  kgFmt,
  yuzdeFmt,
  type Esik,
} from "@/lib/analytics";

const CARI_YIL = 2026;
const ONCEKI_YIL = 2025;

export default async function GenelBakisSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS sayesinde bu sorgular otomatik olarak kullanıcının rolüne göre scoplanır
  // (denetmen: atandığı şube; bölge müdürü: kendi bölgesi; admin/GM: hepsi).
  const [{ data: subeler }, satislar, { data: aylar }, { data: segmentAyar }] = await Promise.all([
    supabase.from("subeler").select("*").returns<Sube[]>(),
    tumSatirlariGetir<AylikSatis>((from, to) =>
      supabase.from("aylik_satislar").select("*").range(from, to),
    ),
    supabase.from("aylar").select("*").returns<Ay[]>(),
    supabase.from("segment_ayarlari").select("*").eq("id", 1).single(),
  ]);

  const subelerListe = subeler ?? [];
  const gunMap = gunSayisiMap(aylar ?? []);
  const aktifAylar = aySirala((aylar ?? []).filter((a) => a.yil === CARI_YIL).map((a) => a.ay));
  const esikler = (segmentAyar?.esikler ?? []) as Esik[];

  const ozetCari = subeKgOzetleri(subelerListe, satislar, CARI_YIL, aktifAylar, gunMap);
  const ozetOnceki = subeKgOzetleri(subelerListe, satislar, ONCEKI_YIL, aktifAylar, gunMap);

  const toplamKg = [...ozetCari.values()].reduce((t, o) => t + o.toplamKg, 0);
  const toplamKgOnceki = [...ozetOnceki.values()].reduce((t, o) => t + o.toplamKg, 0);
  const toplamGun = [...ozetCari.values()].reduce((t, o) => t + o.toplamGun, 0);
  const gunlukOrtalama = toplamGun > 0 ? toplamKg / toplamGun : 0;
  const yoyYuzde = toplamKgOnceki > 0 ? ((toplamKg - toplamKgOnceki) / toplamKgOnceki) * 100 : null;

  const aktifSube = subelerListe.filter((s) => s.aktif).length;
  const msSube = subelerListe.filter((s) => s.tip === "MS").length;
  const frSube = subelerListe.filter((s) => s.tip === "FR").length;

  const kartlar = [
    { etiket: "Görünür Şube", deger: String(subelerListe.length) },
    { etiket: "Aktif Şube", deger: String(aktifSube) },
    { etiket: "MŞ / FR", deger: `${msSube} / ${frSube}` },
    {
      etiket: "Toplam Satış",
      deger: kgFmt(toplamKg),
      altSatir: yoyYuzde != null ? `${ONCEKI_YIL}'e göre ${yuzdeFmt(yoyYuzde)}` : undefined,
    },
    { etiket: "Günlük Ortalama", deger: `${gunlukOrtalama.toFixed(1)} kg/gün` },
  ];

  // ── Aylık trend (2026 vs 2025) ──────────────────────────────────────────
  const aylikTrend = aktifAylar.map((ay) => {
    let cari = 0;
    let onceki = 0;
    for (const o of ozetCari.values()) cari += o.aylikKg[ay] ?? 0;
    for (const o of ozetOnceki.values()) onceki += o.aylikKg[ay] ?? 0;
    return { ay, cari, onceki };
  });
  const trendMax = Math.max(1, ...aylikTrend.flatMap((t) => [t.cari, t.onceki]));

  // ── Bölge dağılımı (ilk 5) ───────────────────────────────────────────────
  const bolgeler = kirilimHesapla(subelerListe, ozetCari, (s) => s.bolge).slice(0, 5);

  // ── Segment dağılımı ─────────────────────────────────────────────────────
  const segmentSayim = new Map<string, { esik: Esik; adet: number; kg: number }>();
  for (const e of esikler) segmentSayim.set(e.ad, { esik: e, adet: 0, kg: 0 });
  for (const sube of subelerListe) {
    const o = ozetCari.get(sube.id);
    if (!o || o.toplamKg <= 0) continue;
    const eslesen = segmentBul(o.kgGunluk, esikler);
    if (!eslesen) continue;
    const s = segmentSayim.get(eslesen.ad);
    if (s) {
      s.adet++;
      s.kg += o.toplamKg;
    }
  }
  const segmentListe = [...segmentSayim.values()]
    .filter((s) => s.adet > 0)
    .sort((a, b) => b.esik.min - a.esik.min);
  const segmentToplam = segmentListe.reduce((t, s) => t + s.adet, 0) || 1;

  // ── Top 10 şube ───────────────────────────────────────────────────────────
  const top10 = subelerListe
    .map((s) => ({ sube: s, kg: ozetCari.get(s.id)?.toplamKg ?? 0 }))
    .filter((r) => r.kg > 0)
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Genel Bakış</h1>
        <p className="text-sm text-neutral-500">
          {profile.ad_soyad ? `Hoş geldin, ${profile.ad_soyad}.` : "Hoş geldin."} Aşağıdaki rakamlar
          yalnızca yetkili olduğun şubeleri, {aktifAylar[0]} – {aktifAylar[aktifAylar.length - 1]}{" "}
          dönemini kapsar.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kartlar.map((k) => (
          <div
            key={k.etiket}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
          >
            <div className="text-xs text-neutral-500 mb-1">{k.etiket}</div>
            <div className="text-lg font-semibold">{k.deger}</div>
            {k.altSatir && (
              <div
                className={`text-xs mt-0.5 ${yoyYuzde != null && yoyYuzde >= 0 ? "text-emerald-600" : "text-red-600"}`}
              >
                {k.altSatir}
              </div>
            )}
          </div>
        ))}
      </div>

      {!subelerListe.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Henüz görünür bir şube yok. Admin/Genel Müdür şube ekleyebilir; Denetmen için atanmış şube
          olması gerekir.
        </div>
      )}

      {subelerListe.length > 0 && (
        <>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-medium text-sm">Aylık Satış Trendi</div>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-neutral-900 dark:bg-neutral-100 inline-block" />
                  {CARI_YIL}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-neutral-300 dark:bg-neutral-700 inline-block" />
                  {ONCEKI_YIL}
                </span>
              </div>
            </div>
            <div className="flex items-end gap-4 h-40">
              {aylikTrend.map((t) => (
                <div key={t.ay} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex items-end gap-1 h-32 w-full justify-center">
                    <div
                      className="w-3 md:w-4 bg-neutral-900 dark:bg-neutral-100 rounded-t"
                      style={{ height: `${(t.cari / trendMax) * 100}%` }}
                      title={`${t.ay} ${CARI_YIL}: ${kgFmt(t.cari)}`}
                    />
                    <div
                      className="w-3 md:w-4 bg-neutral-300 dark:bg-neutral-700 rounded-t"
                      style={{ height: `${(t.onceki / trendMax) * 100}%` }}
                      title={`${t.ay} ${ONCEKI_YIL}: ${kgFmt(t.onceki)}`}
                    />
                  </div>
                  <div className="text-[11px] text-neutral-500">{t.ay.slice(0, 3)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-sm">Bölge Dağılımı</div>
                <Link href="/bolge-analizi" className="text-xs text-neutral-500 hover:underline">
                  tümünü gör →
                </Link>
              </div>
              <div className="space-y-2.5">
                {bolgeler.map((b) => (
                  <div key={b.anahtar} className="flex items-center gap-3 text-sm">
                    <div className="w-20 shrink-0 text-neutral-600 dark:text-neutral-400">{b.anahtar}</div>
                    <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-neutral-900 dark:bg-neutral-100 rounded-full"
                        style={{ width: `${b.yuzdePay}%` }}
                      />
                    </div>
                    <div className="w-24 shrink-0 text-right text-neutral-500">{kgFmt(b.toplamKg)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-sm">Segment Dağılımı</div>
                <Link href="/segmentasyon" className="text-xs text-neutral-500 hover:underline">
                  tümünü gör →
                </Link>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden mb-3">
                {segmentListe.map((s) => (
                  <div
                    key={s.esik.ad}
                    style={{ width: `${(s.adet / segmentToplam) * 100}%`, backgroundColor: s.esik.renk }}
                    title={`${s.esik.ad}: ${s.adet} şube`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {segmentListe.map((s) => (
                  <div key={s.esik.ad} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: s.esik.renk }}
                    />
                    <span className="text-neutral-600 dark:text-neutral-400">{s.esik.ad}</span>
                    <span className="ml-auto text-neutral-500">{s.adet}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <div className="font-medium text-sm">En Yüksek Satış (İlk 10)</div>
                <Link href="/top30" className="text-xs text-neutral-500 hover:underline">
                  top 30 →
                </Link>
              </div>
              {top10.map((r, i) => (
                <div
                  key={r.sube.id}
                  className="px-4 py-2 text-sm flex items-center justify-between border-b border-neutral-50 dark:border-neutral-800/50 last:border-0"
                >
                  <span>
                    <span className="text-neutral-400 mr-2">{i + 1}</span>
                    {r.sube.ad} <span className="text-neutral-400 text-xs">({r.sube.bolge})</span>
                  </span>
                  <span className="text-neutral-600 dark:text-neutral-400">{kgFmt(r.kg)}</span>
                </div>
              ))}
              {!top10.length && <div className="px-4 py-6 text-sm text-neutral-400">Veri yok.</div>}
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <div className="font-medium text-sm">
                  {CARI_YIL} vs {ONCEKI_YIL}
                </div>
                <Link href="/yoy-karsilastirma" className="text-xs text-neutral-500 hover:underline">
                  detay →
                </Link>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-neutral-500">
                  <tr>
                    <th className="px-4 py-1.5">Ay</th>
                    <th className="px-4 py-1.5 text-right">{CARI_YIL}</th>
                    <th className="px-4 py-1.5 text-right">{ONCEKI_YIL}</th>
                    <th className="px-4 py-1.5 text-right">Fark</th>
                  </tr>
                </thead>
                <tbody>
                  {aylikTrend.map((t) => {
                    const fark = t.cari - t.onceki;
                    return (
                      <tr key={t.ay} className="border-t border-neutral-50 dark:border-neutral-800/50">
                        <td className="px-4 py-1.5 font-medium">{t.ay}</td>
                        <td className="px-4 py-1.5 text-right">{kgFmt(t.cari)}</td>
                        <td className="px-4 py-1.5 text-right text-neutral-500">{kgFmt(t.onceki)}</td>
                        <td
                          className={`px-4 py-1.5 text-right ${fark >= 0 ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {kgFmt(fark)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
