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

/**
 * Sütun BAŞLIĞINDAN ay çıkarır.
 *
 * "ŞUBE DATABASE-V5.xlsx" dosyasında aylar başlıkta ay adı olarak değil,
 * Excel TARİH KODU olarak duruyor: 45658 = 2025-01-01 … 46204 = 2026-07-01.
 * Arada bir de "2025 TOPLAM" sütunu var; o metin olduğu için tarih
 * çözümüne takılmıyor ve kendiliğinden dışarıda kalıyor.
 *
 * Sayıya tarih derken dar davranılıyor: yıl 2015–2100 aralığında olmalı.
 * Yoksa "2025" gibi düz bir başlık 1905'e çözülüp ay sütunu sanılırdı.
 */
function basliktanAy(ham: unknown): { ay: string; yil: number | null } | null {
  const b = katla(ham);
  if (!b) return null;

  const adla = AYLAR_12.find((a) => katla(a) === b);
  if (adla) return { ay: adla, yil: null };

  // "TOPLAM", "2025 TOPLAM" gibi özet sütunları asla ay sayılmamalı.
  if (b.includes("TOPLAM") || b.includes("ORTALAMA") || b.includes("GENEL")) return null;

  const tarih = excelTarihiCoz(ham);
  if (!tarih) return null;
  const yil = Number(tarih.slice(0, 4));
  const ayNo = Number(tarih.slice(5, 7));
  if (yil < 2015 || yil > 2100 || ayNo < 1 || ayNo > 12) return null;
  return { ay: AYLAR_12[ayNo - 1], yil };
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
  // Ham başlık kullanılıyor (katlanmış değil): tarih kodu sayı olarak
  // gelmeli ki 45658 → 2025-01 çözülebilsin.
  const hamBasliklar = grid[baslikIdx] ?? [];
  const aySutunlari = hamBasliklar
    .map((h, i) => ({ bilgi: basliktanAy(h), i }))
    .filter((x): x is { bilgi: { ay: string; yil: number | null }; i: number } =>
      Boolean(x.bilgi),
    );

  const aySutun = basliklar.findIndex((b) => AY_BASLIKLARI.includes(b));

  const notlar: string[] = [];
  const eslesmeyen = new Set<string>();
  const aylar = new Set<string>();
  const yillar = new Set<number>();
  const satirlar: CozulmusSatir[] = [];

  const hucre = (satir: unknown[], i: number) => (i >= 0 ? satir[i] : "");

  // ── Düzen seçimi: "AY" SÜTUNU VARSA UZUN DÜZEN KAZANIR ────────────────
  //
  // Sıra önemli. Şirketin uzun düzen raporunda değer sütununun başlığı bir
  // tarih ("46204"); yeni eklenen tarih tanıma yüzünden o sütun "geniş
  // düzen ay sütunu" sanılabiliyor. Tek aylı dosyada sonuç aynı çıkıyor
  // ama ÇOK AYLI bir uzun dosyada bütün satırlar başlıktaki tek aya
  // yazılırdı — sessiz ve büyük bir hata.
  //
  // Satır başına ay bilgisi taşıyan bir "AY" sütunu varsa doğru okuma
  // her zaman uzun düzendir; geniş düzenin böyle bir sütuna ihtiyacı yok.
  if (aySutun >= 0) {
    // ── UZUN düzen ──────────────────────────────────────────────────────
    const degerSutun = degerSutunuBul(basliklar, veriSatirlari, aySutun, [kodSutun, adSutun]);
    if (degerSutun < 0) {
      throw new Error(
        "'Ay' sütunu bulundu ama miktar sütunu bulunamadı. " +
          "Miktarın olduğu sütunun başlığına 'KG' ya da 'Miktar' yazın.",
      );
    }

    // Değer sütununun başlığı tarihse (ör. 46204), yıl oradan alınıyor —
    // AY sütununda yalnızca "TEMMUZ" yazsa bile yıl doğru çıksın.
    const basliktanYil = basliktanAy(hamBasliklar[degerSutun])?.yil ?? null;

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

      const yil = ayBilgi.yil ?? basliktanYil ?? varsayilanYil;
      aylar.add(ayBilgi.ay);
      yillar.add(yil);
      satirlar.push({ subeId: sube.id, yil, ay: ayBilgi.ay, kg });
    }

    notlar.push(
      `Uzun düzen tanındı: ay "${String(hamBasliklar[aySutun] ?? "AY").trim()}" sütununda, ` +
        `miktar "${String(hamBasliklar[degerSutun] ?? "").trim() || "(başlıksız)"}" sütununda.`,
    );
    notlar.push(
      basliktanYil
        ? `Yıl, miktar sütununun başlığındaki tarihten okundu: ${basliktanYil}.`
        : `Dosyada yıl bilgisi yok; seçili yıl (${varsayilanYil}) kullanıldı.`,
    );
    return { bicim: "uzun", satirlar, eslesmeyen: [...eslesmeyen], aylar: [...aylar], yillar: [...yillar], notlar };
  }

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
      for (const { bilgi, i } of aySutunlari) {
        const kg = sayiCoz(satir[i]);
        // Boş hücre "veri yok" demek; 0 ile karıştırılmamalı.
        if (kg == null || kg < 0) continue;
        // Başlık tarihse yıl ORADAN gelir — tek dosyada birden çok yıl
        // olabiliyor (2025 ve 2026 aynı sayfada).
        const yil = bilgi.yil ?? varsayilanYil;
        aylar.add(bilgi.ay);
        yillar.add(yil);
        satirlar.push({ subeId: sube.id, yil, ay: bilgi.ay, kg });
      }
    }
    const tarihliAy = aySutunlari.filter((x) => x.bilgi.yil != null).length;
    notlar.push(
      `Geniş düzen tanındı: ${aySutunlari.length} ay sütunu` +
        (tarihliAy
          ? ` (başlıklar tarih olarak yazılmış, yıl dosyadan okundu: ${[...yillar].sort().join(", ")})`
          : ` — yıl seçili yıldan alındı (${varsayilanYil})`) +
        ".",
    );
    return { bicim: "genis", satirlar, eslesmeyen: [...eslesmeyen], aylar: [...aylar], yillar: [...yillar], notlar };
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
