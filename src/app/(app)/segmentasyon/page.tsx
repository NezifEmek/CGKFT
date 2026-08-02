import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DonemSecici, donemCoz, subeleriSuz, kapananlarGoruntulensin } from "@/components/donem-secici";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import { gunSayisiMap, subeKgOzetleri, segmentBul, kgFmt, type Esik } from "@/lib/analytics";
import { EsikForm } from "./esik-form";

const CARI_YIL = 2026;

export default async function SegmentasyonSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

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
  const donem = donemCoz(aylar ?? [], CARI_YIL, sp);
  const aktifAylar = donem.seciliAylar;
  // Kapanan şubeler raporlarda varsayılan gizli; anahtarla açılabiliyor.
  const tumSubeler = subeler ?? [];
  const aktifSubeler = subeleriSuz(tumSubeler, sp);
  const kapananSayisi = tumSubeler.length - aktifSubeler.length;
  const esikler = (segmentAyar?.esikler ?? []) as Esik[];
  const ozet = subeKgOzetleri(aktifSubeler, satislar, CARI_YIL, aktifAylar, gunMap);

  const gruplar = new Map<string, { esik: Esik; subeler: { id: string; ad: string; bolge: string; kg: number; kgGunluk: number }[] }>();
  for (const e of [...esikler].sort((a, b) => b.min - a.min)) {
    gruplar.set(e.ad, { esik: e, subeler: [] });
  }

  for (const sube of aktifSubeler) {
    const o = ozet.get(sube.id);
    if (!o || o.toplamKg <= 0) continue;
    const eslesen = segmentBul(o.kgGunluk, esikler);
    if (!eslesen) continue;
    gruplar
      .get(eslesen.ad)
      ?.subeler.push({ id: sube.id, ad: sube.ad, bolge: sube.bolge, kg: o.toplamKg, kgGunluk: o.kgGunluk });
  }

  const duzenleyebilir = profile.rol === "admin" || profile.rol === "genel_mudur";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Segmentasyon</h1>
        <p className="text-sm text-neutral-500">
          Kg/gün ortalamasına göre şubeler segmentlere ayrılır ({aktifAylar[0]} –{" "}
          {aktifAylar[aktifAylar.length - 1]} kümülatif).
        </p>
      </div>

      <DonemSecici
        donem={donem}
        kapananGoster={kapananlarGoruntulensin(sp)}
        kapananSayisi={kapananSayisi}
      />

      {duzenleyebilir && <EsikForm esikler={esikler} baz={segmentAyar?.baz ?? "KÜMÜLATİF"} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...gruplar.values()].map(({ esik, subeler: liste }) => {
          const toplamKg = liste.reduce((t, s) => t + s.kg, 0);
          return (
            <details
              key={esik.ad}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden"
            >
              <summary className="cursor-pointer px-4 py-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: esik.renk }}
                  />
                  <span className="font-medium text-sm">
                    {esik.ad} <span className="text-neutral-400 font-normal">(≥{esik.min} kg/gün)</span>
                  </span>
                </span>
                <span className="text-sm text-neutral-500">
                  {liste.length} şube · {kgFmt(toplamKg)}
                </span>
              </summary>
              <div className="border-t border-neutral-100 dark:border-neutral-800 max-h-64 overflow-y-auto">
                {liste
                  .sort((a, b) => b.kg - a.kg)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="px-4 py-1.5 text-sm flex items-center justify-between border-b border-neutral-50 dark:border-neutral-800/50 last:border-0"
                    >
                      <span>
                        {s.ad} <span className="text-neutral-400 text-xs">({s.bolge})</span>
                      </span>
                      <span className="text-neutral-500">{s.kgGunluk.toFixed(1)} kg/gün</span>
                    </div>
                  ))}
                {!liste.length && (
                  <div className="px-4 py-3 text-sm text-neutral-400">Bu segmentte şube yok.</div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
