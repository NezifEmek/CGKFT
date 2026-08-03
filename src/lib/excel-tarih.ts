// excel-tarih.ts — Excel hücresinden tarih okumanın TEK doğru yolu.
//
// ── Neden ayrı bir dosya ─────────────────────────────────────────────────
// 2026-08-03'te Nezif şunu bildirdi: 1–31 Temmuz üretim verisini
// yüklüyorum, 1 Temmuz kayboluyor, 2 Temmuz 1 Temmuz'a yazılıyor, 30 günlük
// veri giriyor. Sebep saat dilimiydi ve aynı hata iki ayrı yerde vardı
// (üretim ve merkez gelir-gider). Üçüncü kez yazılmasın diye ortak modül.
//
// ── Hata neydi ───────────────────────────────────────────────────────────
// xlsx kütüphanesi `cellDates: true` ile tarihleri JS Date nesnesine
// çevirir ve bunu YEREL saate göre kurar. İstanbul'da 1 Temmuz 00:00 için
// ürettiği değer 2026-06-30T20:59:04Z olur — üstelik 56 saniye de eksiktir
// (epoch'taki +02:00:56 LMT artığı). Ardından `toISOString().slice(0,10)`
// UTC'ye döndüğü için gün "2026-06-30" çıkar. Tam bir gün geriye kayma.
//
// ── Doğru yol ────────────────────────────────────────────────────────────
// Date nesnesine hiç uğramamak. Excel'de tarih zaten saat dilimi taşımayan
// bir SAYIdır (1899-12-30'dan itibaren gün sayısı); doğrudan o sayıdan gün
// hesaplanır. Bunun için dosyayı `cellDates` OLMADAN okuyun:
//
//     XLSX.read(veri, { type: "array" })                    // cellDates YOK
//     XLSX.utils.sheet_to_json(sayfa, { defval: "", raw: true })
//
// Formül 61–59999 aralığında (1900-03-01 … 2064-03-27) SheetJS'in kendi
// SSF.parse_date_code çıktısıyla birebir doğrulandı.

/**
 * Excel hücresini "YYYY-AA-GG" biçimine çevirir. Çözemezse null.
 *
 * Sayı, Date ve metin hücrelerini kabul eder. Date yolu yalnızca geriye
 * dönük uyumluluk için var (cellDates açık bırakılmış eski çağrılar ve
 * CSV) — yeni kodda dosyayı cellDates olmadan okuyun.
 */
export function excelTarihiCoz(deger: unknown): string | null {
  if (deger == null || deger === "") return null;

  // 1) Excel seri numarası — asıl yol. Saat dilimi işin içine hiç girmez.
  if (typeof deger === "number" && Number.isFinite(deger)) {
    // 61'in altı 1900 artık yıl hatasının bulunduğu bölge (Excel var
    // olmayan 1900-02-29'u takvimde sayar). Bu veriler için anlamsız.
    if (deger < 61 || deger > 400000) return null;
    const gun = Math.floor(deger);
    return new Date(Date.UTC(1899, 11, 30) + gun * 86400000)
      .toISOString()
      .slice(0, 10);
  }

  // 2) Date nesnesi. toISOString KULLANILMAZ — hatanın kaynağı oydu.
  // Yerel bileşenler okunur ve 12 saat eklenerek en yakın güne yuvarlanır;
  // böylece "23:59:04" gibi saniyelik kaymalar doğru güne düşer.
  if (deger instanceof Date) {
    if (Number.isNaN(deger.getTime())) return null;
    const y = new Date(deger.getTime() + 12 * 3600 * 1000);
    return (
      `${y.getFullYear()}-` +
      `${String(y.getMonth() + 1).padStart(2, "0")}-` +
      `${String(y.getDate()).padStart(2, "0")}`
    );
  }

  // 3) Metin — CSV'den ya da elle yazılmış hücrelerden.
  const s = String(deger).trim();
  if (!s) return null;

  // 2026-07-01 / 2026.07.01 / 2026/07/01
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (iso) return gunYaz(+iso[1], +iso[2], +iso[3]);

  // 01.07.2026 / 1-7-2026 / 01/07/26 — Türkiye'de standart yazım
  const tr = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (tr) {
    let yil = +tr[3];
    if (yil < 100) yil += 2000;
    return gunYaz(yil, +tr[2], +tr[1]);
  }

  return null;
}

function gunYaz(y: number, a: number, g: number): string | null {
  if (a < 1 || a > 12 || g < 1 || g > 31) return null;
  return `${y}-${String(a).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
}
