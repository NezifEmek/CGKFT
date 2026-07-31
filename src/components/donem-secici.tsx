// donem-secici.tsx — Ekranların ortak dönem (ay aralığı) seçicisi.
//
// Sorun: Top 30, Segmentasyon, Bölge Analizi, Ciro & Kârlılık, Düşüş
// Uyarıları, Segment Takibi ve KPI Takibi dönem seçimi olmadan yazılmıştı;
// hepsi cari yılın BÜTÜN aylarını topluyordu. Kullanıcı "sadece Haziran'a
// bakayım" diyemiyor, Genel Bakış'a gidip geri dönmek zorunda kalıyordu —
// orada da değişmiyordu çünkü her ekran kendi aralığını sabit hesaplıyordu.
//
// Çözüm: seçim URL'de (?baslangic=&bitis=) taşınıyor. Sunucu bileşeni
// searchParams'tan okuyor, bu form da GET ile aynı adrese gönderiyor.

import { aySirala } from "@/lib/analytics";

export interface DonemSecimi {
  tumAylar: string[];
  seciliAylar: string[];
  baslangic: string;
  bitis: string;
  tumDonemMi: boolean;
}

/** searchParams + ay listesinden seçili aralığı çözer. Varsayılan: tüm yıl. */
export function donemCoz(
  aylar: { yil: number; ay: string }[],
  yil: number,
  sp: Record<string, string | undefined>,
): DonemSecimi {
  const tumAylar = aySirala(aylar.filter((a) => a.yil === yil).map((a) => a.ay));
  if (!tumAylar.length) {
    return { tumAylar: [], seciliAylar: [], baslangic: "", bitis: "", tumDonemMi: true };
  }

  const baslangic =
    sp.baslangic && tumAylar.includes(sp.baslangic) ? sp.baslangic : tumAylar[0];
  const bitis =
    sp.bitis && tumAylar.includes(sp.bitis) ? sp.bitis : tumAylar[tumAylar.length - 1];

  const b = Math.max(0, tumAylar.indexOf(baslangic));
  const s = Math.max(b, tumAylar.indexOf(bitis)); // bitiş başlangıçtan önce olamaz
  const seciliAylar = tumAylar.slice(b, s + 1);

  return {
    tumAylar,
    seciliAylar,
    baslangic,
    bitis: tumAylar[s],
    tumDonemMi: seciliAylar.length === tumAylar.length,
  };
}

const gir =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm";

/**
 * Dönem seçim çubuğu. `ekstra` ile ekranın kendi gizli alanları korunur
 * (ör. kapsam/değer filtreleri), yoksa GET gönderiminde kaybolurlar.
 */
export function DonemSecici({
  donem,
  ekstra,
  aciklama,
}: {
  donem: DonemSecimi;
  ekstra?: Record<string, string | undefined>;
  aciklama?: string;
}) {
  if (!donem.tumAylar.length) return null;

  return (
    <form
      method="get"
      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 flex flex-wrap items-end gap-3"
    >
      {Object.entries(ekstra ?? {}).map(([k, v]) =>
        v === undefined ? null : <input key={k} type="hidden" name={k} value={v} />,
      )}

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Başlangıç ayı</label>
        <select name="baslangic" defaultValue={donem.baslangic} className={gir}>
          {donem.tumAylar.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500 mb-1">Bitiş ayı</label>
        <select name="bitis" defaultValue={donem.bitis} className={gir}>
          {donem.tumAylar.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium"
      >
        Uygula
      </button>

      <span className="text-xs text-neutral-500 pb-2">
        {donem.seciliAylar.length === 1
          ? `Yalnızca ${donem.baslangic}`
          : `${donem.baslangic} – ${donem.bitis} (${donem.seciliAylar.length} ay)`}
        {donem.tumDonemMi ? " · tüm yıl" : ""}
        {aciklama ? ` · ${aciklama}` : ""}
      </span>
    </form>
  );
}
