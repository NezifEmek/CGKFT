// satis-aktarim.ts — Şube satış Excel'lerini okuyup satırlara çevirir.
//
// ── Neden iki ayrı düzen ─────────────────────────────────────────────────
// 2026-08-04: Nezif "TEMMUZ 2026 ŞUBELERE SATIŞLAR" dosyasını yükleyemedi.
// Dosya bozuk değildi; yazılım tek bir düzeni tanıyordu.
//
//   GENİŞ düzen (panelin ürettiği şablon)
//     Kod | Şube | OCAK | ŞUBAT | ... | ARALIK
//     Her şube TEK satır, aylar sütun başlıklarında.
//
//   UZUN düzen (şirketin kendi raporu)
//     ... | ŞUBE KODU | ... | AY      | 46204
//     ...   F77-001AR | ... | TEMMUZ  |  1230
//     Her şube-ay AYRI satır; ay bir sütunun içinde, değer başka sütunda.
//     Değer sütununun başlığı Excel'in tarih kodu (46204 = 2026-07-01).
//
// Ayrıca başlıklarda satır sonu var ("ŞUBE\r\nKODU"). Eski kod başlığı
// "KOD" ile birebir karşılaştırdığı için şube sütununu da bulamıyordu.
//
// Buradaki çözüm ikisini de kabul ediyor ve hangi düzeni tanıdığını
// söylüyor; kullanıcı önizlemede görüp onaylıyor.

import { AYLAR_12 } from "@/types/database";
import { excelTarihiCoz } from "@/lib/excel-tarih";

export type Bicim = "genis" | "uzun";

export interface AktarSube {
  id: string;
  kod: string | null;
  ad: string;
}

export interface CozulmusSatir {
  subeId: string;
  yil: number;
  ay: string;
  kg: number;
}

export interface CozumSonucu {
  bicim: Bicim;
  satirlar: CozulmusSatir[];
  /** Hiçbir şubeye denk gelmeyen ad/kodlar */
  eslesmeyen: string[];
  /** Dosyada bulunan ay adları */
  aylar: string[];
  /** Dosyada geçen yıllar (uzun düzende tarihten okunabiliyor) */
  yillar: number[];
  /** Kullanıcıya gösterilecek bilgi notları */
  notlar: string[];
}

export function normalizeBaslik(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr");
}

/** Türkçe harfleri katlar — "ŞUBE KODU" ↔ "SUBE KODU" eşleşsin. */
function katla(s: unknown): string {
  return normalizeBaslik(s)
    .replace(/[İIı]/g, "I")
    .replace(/Ö/g, "O").replace(/Ü/g, "U").replace(/Ş/g, "S")
    .replace(/Ç/g, "C").replace(/Ğ/g, "G");
}

const KOD_BASLIKLARI = ["KOD", "SUBE KODU", "SUBEKODU", "SUBE KOD", "KODU"];
const AD_BASLIKLARI = ["SUBE", "SUBE ADI", "AD", "SUBE ISMI", "ISIM"];
const AY_BASLIKLARI = ["AY", "DONEM", "AY ADI"];
const DEGER_BASLIKLARI = ["KG", "MIKTAR", "SATIS", "TUTAR", "DEGER", "TOPLAM", "SATIS KG"];

/** Sayıya çevirir: "1.230,5" → 1230.5. Çevrilemezse null. */
export function sayiCoz(ham: unknown): number | null {
  if (ham == null || ham === "") return null;
  if (typeof ham === "number") return Number.isFinite(ham) ? ham : null;

  let s = String(ham).trim();
  if (!s) return null;
  // Binlik ayıracı nokta, ondalık virgül (Türkçe Excel çıktısı).
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Hücreden ay adı çıkarır: "TEMMUZ", "07", tarih ya da Excel seri no. */
function ayCoz(ham: unknown): { ay: string; yil: number | null } | null {
  if (ham == null || ham === "") return null;

  const metin = normalizeBaslik(ham);
  const dogrudan = AYLAR_12.find((a) => katla(a) === katla(metin));
  if (dogrudan) return { ay: dogrudan, yil: null };

  // Tarih olabilir (seri no, metin ya da Date)
  const tarih = excelTarihiCoz(ham);
  if (tarih) {
    const ayNo = Number(tarih.slice(5, 7));
    if (ayNo >= 1 && ayNo <= 12) {
      return { ay: AYLAR_12[ayNo - 1], yil: Number(tarih.slice(0, 4)) };
    }
  }
  return null;
}

/**
 * Başlık satırını bulur.
 *
 * Dosyanın başında logo/başlık satırları olabiliyor; ilk satırı körlemesine
 * başlık saymak yerine, şube sütununu içeren ilk satır aranıyor.
 */
function baslikSatiriniBul(grid: unknown[][]): number {
  const sinir = Math.min(grid.length, 15);
  for (let i = 0; i < sinir; i++) {
    const satir = grid[i] ?? [];
    const basliklar = satir.map(katla);
    const kodVar = basliklar.some((b) => KOD_BASLIKLARI.includes(b));
    const adVar = basliklar.some((b) => AD_BASLIKLARI.includes(b));
    if (kodVar || adVar) return i;
  }
  return 0;
}

/**
 * Excel gridini satırlara çevirir.
 *
 * @param varsayilanYil Dosyada yıl bilgisi yoksa kullanılacak yıl.
 *   Uzun düzende ay hücresi tam tarihse dosyadaki yıl kazanır.
 */
export function satislariCoz(
  grid: unknown[][],
  subeler: AktarSube[],
  varsayilanYil: number,
): CozumSonucu {
  if (!grid.length) throw new Error("Sayfa boş görünüyor.");

  const baslikIdx = baslikSatiriniBul(grid);
  const basliklar = (grid[baslikIdx] ?? []).map((b) => katla(b));
  const veriSatirlari = grid.slice(baslikIdx + 1);

  const kodSutun = basliklar.findIndex((b) => KOD_BASLIKLARI.includes(b));
  const adSutun = basliklar.findIndex((b) => AD_BASLIKLARI.includes(b));
  if (kodSutun < 0 && adSutun < 0) {
    throw new Error(
      "Şube sütunu bulunamadı. Başlık satırında 'Şube Kodu' ya da 'Şube' olmalı.",
    );
  }

  // Şube dizini — kod ve ad üzerinden, Türkçe harf katlamalı.
  const koda = new Map<string, AktarSube>();
  const ada = new Map<string, AktarSube>();
  for (const s of subeler) {
    if (s.kod) koda.set(katla(s.kod), s);
    ada.set(katla(s.ad), s);
  }
  const subeBul = (kod: string, ad: string) =>
    (kod && koda.get(kod)) || (ad && ada.get(ad)) || null;

  // ── Düzeni belirle ────────────────────────────────────────────────────
  const aySutunlari = basliklar
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => AYLAR_12.some((a) => katla(a) === b));

  const aySutun = basliklar.findIndex((b) => AY_BASLIKLARI.includes(b));

  const notlar: string[] = [];
  const eslesmeyen = new Set<string>();
  const aylar = new Set<string>();
  const yillar = new Set<number>();
  const satirlar: CozulmusSatir[] = [];

  const hucre = (satir: unknown[], i: number) => (i >= 0 ? satir[i] : "");

  if (aySutunlari.length) {
    // ── GENİŞ düzen ─────────────────────────────────────────────────────
    for (const satir of veriSatirlari) {
      if (!satir?.length) continue;
      const kod = katla(hucre(satir, kodSutun));
      const ad = katla(hucre(satir, adSutun));
      const sube = subeBul(kod, ad);
      if (!sube) {
        if (kod || ad) eslesmeyen.add(String(hucre(satir, adSutun) || hucre(satir, kodSutun)));
        continue;
      }
      for (const { i } of aySutunlari) {
        const kg = sayiCoz(satir[i]);
        // Boş hücre "veri yok" demek; 0 ile karıştırılmamalı.
        if (kg == null || kg < 0) continue;
        const ay = AYLAR_12.find((a) => katla(a) === basliklar[i])!;
        aylar.add(ay);
        yillar.add(varsayilanYil);
        satirlar.push({ subeId: sube.id, yil: varsayilanYil, ay, kg });
      }
    }
    notlar.push(`Geniş düzen tanındı: aylar sütun başlıklarında (${aySutunlari.length} ay).`);
    return { bicim: "genis", satirlar, eslesmeyen: [...eslesmeyen], aylar: [...aylar], yillar: [...yillar], notlar };
  }

  if (aySutun >= 0) {
    // ── UZUN düzen ──────────────────────────────────────────────────────
    const degerSutun = degerSutunuBul(basliklar, veriSatirlari, aySutun, [kodSutun, adSutun]);
    if (degerSutun < 0) {
      throw new Error(
        "'Ay' sütunu bulundu ama miktar sütunu bulunamadı. " +
          "Miktarın olduğu sütunun başlığına 'KG' ya da 'Miktar' yazın.",
      );
    }

    for (const satir of veriSatirlari) {
      if (!satir?.length) continue;
      const kod = katla(hucre(satir, kodSutun));
      const ad = katla(hucre(satir, adSutun));
      const sube = subeBul(kod, ad);
      if (!sube) {
        if (kod || ad) eslesmeyen.add(String(hucre(satir, adSutun) || hucre(satir, kodSutun)));
        continue;
      }
      const ayBilgi = ayCoz(satir[aySutun]);
      if (!ayBilgi) continue;
      const kg = sayiCoz(satir[degerSutun]);
      if (kg == null || kg < 0) continue;

      const yil = ayBilgi.yil ?? varsayilanYil;
      aylar.add(ayBilgi.ay);
      yillar.add(yil);
      satirlar.push({ subeId: sube.id, yil, ay: ayBilgi.ay, kg });
    }

    notlar.push(
      `Uzun düzen tanındı: ay "${String(grid[baslikIdx]?.[aySutun] ?? "AY").trim()}" ` +
        `sütununda, miktar "${String(grid[baslikIdx]?.[degerSutun] ?? "").trim() || "(başlıksız)"}" sütununda.`,
    );
    if (!yillar.size || [...yillar].every((y) => y === varsayilanYil)) {
      notlar.push(`Dosyada yıl bilgisi yok; seçili yıl (${varsayilanYil}) kullanıldı.`);
    }
    return { bicim: "uzun", satirlar, eslesmeyen: [...eslesmeyen], aylar: [...aylar], yillar: [...yillar], notlar };
  }

  throw new Error(
    "Ay bilgisi bulunamadı. Ya başlık satırında OCAK, ŞUBAT… sütunları olmalı, " +
      "ya da bir 'Ay' sütunu bulunmalı.",
  );
}

/**
 * Uzun düzende miktar sütununu bulur.
 *
 * Sıra: (1) başlığı KG/Miktar/Satış olan sütun, (2) ay sütununun hemen
 * sağındaki sayısal sütun, (3) en çok sayısal hücre içeren sütun.
 *
 * Şirketin raporunda değer sütununun başlığı bir tarih ("46204") olduğu
 * için ada göre bulmak yetmiyor; (2) bu yüzden var.
 */
function degerSutunuBul(
  basliklar: string[],
  veriSatirlari: unknown[][],
  aySutun: number,
  disla: number[],
): number {
  const adla = basliklar.findIndex((b) => DEGER_BASLIKLARI.includes(b));
  if (adla >= 0) return adla;

  const sayisalMi = (i: number) => {
    let sayi = 0;
    let dolu = 0;
    for (const satir of veriSatirlari.slice(0, 200)) {
      const v = satir?.[i];
      if (v == null || v === "") continue;
      dolu++;
      if (sayiCoz(v) != null) sayi++;
    }
    return dolu > 0 && sayi / dolu >= 0.8 ? sayi : 0;
  };

  const gecerli = (i: number) => i !== aySutun && !disla.includes(i) && i >= 0;

  // Ay sütununun sağındaki ilk sayısal sütun.
  for (let i = aySutun + 1; i < basliklar.length; i++) {
    if (gecerli(i) && sayisalMi(i)) return i;
  }
  // Olmazsa en çok sayısal hücre içeren sütun.
  let enIyi = -1;
  let enIyiSkor = 0;
  for (let i = 0; i < basliklar.length; i++) {
    if (!gecerli(i)) continue;
    const skor = sayisalMi(i);
    if (skor > enIyiSkor) {
      enIyiSkor = skor;
      enIyi = i;
    }
  }
  return enIyi;
}
