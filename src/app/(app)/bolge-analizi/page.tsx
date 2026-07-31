import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DonemSecici, donemCoz, subeleriSuz, kapananlarGoruntulensin } from "@/components/donem-secici";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import { aySirala, gunSayisiMap, subeKgOzetleri, kirilimHesapla, kgFmt } from "@/lib/analytics";

const CARI_YIL = 2026;

function KirilimTablo({
  baslik,
  satirlar,
}: {
  baslik: string;
  satirlar: ReturnType<typeof kirilimHesapla>;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 font-medium text-sm">
        {baslik}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">Ad</th>
            <th className="px-4 py-2 text-right">Şube</th>
            <th className="px-4 py-2 text-right">MŞ / FR</th>
            <th className="px-4 py-2 text-right">Toplam Kg</th>
            <th className="px-4 py-2 text-right">Kg/Gün</th>
            <th className="px-4 py-2 text-right">Pay</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((s) => (
            <tr
              key={s.anahtar}
              className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <td className="px-4 py-2 font-medium">{s.anahtar}</td>
              <td className="px-4 py-2 text-right">{s.subeSayisi}</td>
              <td className="px-4 py-2 text-right text-neutral-600 dark:text-neutral-400">
                {s.msSayisi} / {s.frSayisi}
              </td>
              <td className="px-4 py-2 text-right">{kgFmt(s.toplamKg)}</td>
              <td className="px-4 py-2 text-right">{s.kgGunluk.toFixed(1)}</td>
              <td className="px-4 py-2 text-right">%{s.yuzdePay.toFixed(1)}</td>
            </tr>
          ))}
          {!satirlar.length && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                Görünür veri yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function BolgeAnaliziSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

  const [{ data: subeler }, satislar, { data: aylar }] = await Promise.all([
    supabase.from("subeler").select("*").returns<Sube[]>(),
    tumSatirlariGetir<AylikSatis>((from, to) =>
      supabase.from("aylik_satislar").select("*").range(from, to),
    ),
    supabase.from("aylar").select("*").returns<Ay[]>(),
  ]);

  const gunMap = gunSayisiMap(aylar ?? []);
  const donem = donemCoz(aylar ?? [], CARI_YIL, sp);
  const aktifAylar = donem.seciliAylar;
  // Kapanan şubeler raporlarda varsayılan gizli; anahtarla açılabiliyor.
  const tumSubeler = subeler ?? [];
  const aktifSubeler = subeleriSuz(tumSubeler, sp);
  const kapananSayisi = tumSubeler.length - aktifSubeler.length;
  const ozet = subeKgOzetleri(aktifSubeler, satislar, CARI_YIL, aktifAylar, gunMap);

  const bolgeSatirlari = kirilimHesapla(aktifSubeler, ozet, (s) => s.bolge);
  const ilSatirlari = kirilimHesapla(aktifSubeler, ozet, (s) => s.il).slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Bölge Analizi</h1>
        <p className="text-sm text-neutral-500">
          {aktifAylar[0]} – {aktifAylar[aktifAylar.length - 1]} kümülatif kg&apos;a göre bölge ve il
          kırılımı.
        </p>
      </div>

      <DonemSecici
        donem={donem}
        kapananGoster={kapananlarGoruntulensin(sp)}
        kapananSayisi={kapananSayisi}
      />

      <KirilimTablo baslik="Bölgeler" satirlar={bolgeSatirlari} />
      <KirilimTablo baslik="İller (İlk 20)" satirlar={ilSatirlari} />
    </div>
  );
}
