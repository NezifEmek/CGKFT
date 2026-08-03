// merkez-gg.ts — Merkez Şube Gelir-Gider: hesap kuralları ve Excel çözümleyici.
//
// Kurallar eski panelin analytics.js → merkezGGSubeAylik fonksiyonundan birebir
// alındı. Dikkat çeken nokta: "ayran" GELİR, "yemek" GİDER sayılır (personel
// yemeği). Aylık stok/gider kalemlerinin tamamı gidere eklenir.

import { excelTarihiCoz } from "@/lib/excel-tarih";

export const AYLAR_12 = [
  "OCAK",
  "ŞUBAT",
  "MART",
  "NİSAN",
  "MAYIS",
  "HAZİRAN",
  "TEMMUZ",
  "AĞUSTOS",
  "EYLÜL",
  "EKİM",
  "KASIM",
  "ARALIK",
] as const;

export const GELIR_ALANLARI = [
  { key: "nakit", etiket: "Nakit" },
  { key: "kredi_karti", etiket: "Kredi Kartı" },
  { key: "ticket", etiket: "Ticket" },
  { key: "yemek_sepeti", etiket: "Yemek Sepeti" },
  { key: "ayran", etiket: "Ayran" },
] as const;

export const GIDER_ALANLARI = [
  { key: "yemek", etiket: "Yemek (personel)" },
  { key: "genel_masraf", etiket: "Genel Masraf" },
] as const;

export interface GunlukKayit {
  id?: string;
  sube_id: string;
  tarih: string; // YYYY-MM-DD
  nakit: number;
  kredi_karti: number;
  ticket: number;
  yemek_sepeti: number;
  ayran: number;
  yemek: number;
  genel_masraf: number;
  kaynak?: "elle" | "excel";
}

export interface Kalem {
  id?: string;
  sube_id: string;
  yil: number;
  ay: string;
  urun: string;
  adet: number;
  tutar: number;
  kaynak?: "elle" | "excel";
}

export function gunlukGelir(g: GunlukKayit): number {
  return (
    (g.nakit || 0) +
    (g.kredi_karti || 0) +
    (g.ticket || 0) +
    (g.yemek_sepeti || 0) +
    (g.ayran || 0)
  );
}

export function gunlukGider(g: GunlukKayit): number {
  return (g.yemek || 0) + (g.genel_masraf || 0);
}

export interface GGOzet {
  gelir: number;
  gider: number;
  net: number;
  gunSayisi: number;
  kalemGideri: number;
}

/** Verilen günlük kayıt ve kalem kümesi için gelir/gider/net. */
export function ggOzetle(gunler: GunlukKayit[], kalemler: Kalem[]): GGOzet {
  let gelir = 0;
  let gider = 0;
  for (const g of gunler) {
    gelir += gunlukGelir(g);
    gider += gunlukGider(g);
  }
  const kalemGideri = kalemler.reduce((t, k) => t + (k.tutar || 0), 0);
  gider += kalemGideri;
  return { gelir, gider, net: gelir - gider, gunSayisi: gunler.length, kalemGideri };
}

export function ayAdi(tarih: string): string {
  const d = new Date(tarih + "T00:00:00");
  return AYLAR_12[d.getMonth()];
}

export function yilAl(tarih: string): number {
  return Number(tarih.slice(0, 4));
}

// ─── Excel çözümleme (tarayıcıda çalışır) ───────────────────────────────────

/** "1.234,56" / "1,234.56" / sayı → sayı. Eski excel.js sayiOku karşılığı. */
export function sayiOku(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).replace(/\s|₺|TL/gi, "");

  if (s.includes(",") && s.includes(".")) {
    // İkisi birlikteyse ondalık ayırıcı sonda olandır: "1.234,56" / "1,234.56"
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  } else if (s.includes(".")) {
    // Yalnızca nokta var ve belirsiz: "1.200" Türkçe'de 1200, İngilizce'de 1,2.
    // Türkçe kaynaklı dosyalarla çalıştığımız için binlik kalıbını (her nokta
    // grubu tam 3 hane) binlik ayırıcı kabul ediyoruz; "1.20" veya "1.2345"
    // gibi kalıplar ondalık sayılır. Bu düzeltilmeden "1.200 TL" 1,2 okunuyordu.
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Excel hücresini YYYY-MM-DD'ye çevirir; olmuyorsa null.
 *
 * Çevrim @/lib/excel-tarih'e taşındı. Buradaki eski kod Date nesnelerinde
 * `toISOString()` kullanıyordu ve gg-arayuz dosyayı `cellDates: true` ile
 * okuduğu için tarihler bir gün geriye kayıyordu — üretim modülünde ortaya
 * çıkan hatanın aynısı. Ay sınırındaki günleri yanlış aya yazıyordu.
 */
export function tarihCevir(v: unknown): string | null {
  return excelTarihiCoz(v);
}

/** Sayfa adından ay tahmini (ör. "DARICA MAYIS" → MAYIS). */
export function sayfaAyBul(sayfaAdi: string): string | null {
  const u = sayfaAdi.replace(/i/g, "İ").toUpperCase();
  return AYLAR_12.find((a) => u.includes(a)) ?? null;
}

/**
 * Ünsüz iskeleti: sesli harfler atılır, Türkçe'ye özgü ünsüzler sadeleştirilir.
 * Gerçek dosyada sayfa adları kısaltma ("AKMŞ", "FRZL", "BYRMGL") ve bunlar
 * tam olarak şube adının sesli harfsiz hali oluyor:
 *   AKMEŞE → KMS = AKMŞ → KMS,  FERİZLİ → FRZL,  BAYRAMOĞLU → BYRMGL
 */
function unsuzIskeleti(s: string): string {
  return s
    .replace(/i/g, "İ")
    .toUpperCase()
    .replace(/Ğ/g, "G")
    .replace(/Ş/g, "S")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "")
    .replace(/[AEIİOÖUÜ]/g, "");
}

function sadeAd(ad: string): string {
  return ad
    .replace(/i/g, "İ")
    .toUpperCase()
    .replace(/\s*ŞUBE\s*$/, "")
    .trim();
}

/**
 * Şube tahmini. Sırasıyla:
 *   1) Sayfanın A1 hücresi — gerçek dosyada tam şube adı orada ("AKMEŞE ŞUBE")
 *   2) Sayfa adı içinde tam ad geçiyor mu
 *   3) Ünsüz iskeleti eşleşmesi — kısaltma sayfa adları için
 */
export function sayfaSubeTahmin(
  sayfaAdi: string,
  subeler: { id: string; ad: string; tip: string }[],
  a1Hucresi?: unknown,
): string | null {
  const adaylar = subeler
    .filter((s) => s.tip === "MS")
    // İskelet SADE addan hesaplanmalı; "ŞUBE" eki dahil edilirse
    // "95EVLER ŞUBE" → 95VLRSB olur ve "95 EVLER" (95VLR) ile tutmaz.
    .map((s) => {
      const sade = sadeAd(s.ad);
      return { id: s.id, sade, iskelet: unsuzIskeleti(sade) };
    })
    // Uzun ad önce: "DERİNCE2" ile "DERİNCE" karışmasın.
    .sort((a, b) => b.sade.length - a.sade.length);

  // A1 tarih hücresi olabiliyor (bir sayfada başlık kaymış); o zaman atlanır.
  const a1Ham = typeof a1Hucresi === "string" ? a1Hucresi.trim() : "";
  const a1 = a1Ham && !/^\w{3} \w{3} \d{2} \d{4}/.test(a1Ham) ? sadeAd(a1Ham) : "";

  const dene = (metin: string): string | null => {
    if (!metin) return null;
    // Sıra önemli: tam eşleşme → tam iskelet → en son parçalı eşleşme.
    // Parçalı önce denenirse "AKYAZI-3" metni "AKYAZI"ya takılıp
    // "AKYAZI3" şubesini kaçırıyordu.
    for (const s of adaylar) if (s.sade && metin === s.sade) return s.id;
    const isk = unsuzIskeleti(metin);
    if (isk.length >= 3) {
      for (const s of adaylar) if (s.iskelet && isk === s.iskelet) return s.id;
    }
    for (const s of adaylar) if (s.sade && metin.includes(s.sade)) return s.id;
    return null;
  };

  return dene(a1) ?? dene(sadeAd(sayfaAdi));
}

/** Günlük kayıtlarda en çok geçen (yıl, ay) — kalemlerin dönemi bundan türetilir. */
export function baskinDonem(
  gunluk: { tarih: string }[],
): { yil: number; ay: string } | null {
  if (!gunluk.length) return null;
  const sayim = new Map<string, number>();
  for (const g of gunluk) {
    const k = `${yilAl(g.tarih)}|${ayAdi(g.tarih)}`;
    sayim.set(k, (sayim.get(k) ?? 0) + 1);
  }
  const [enCok] = [...sayim].sort((a, b) => b[1] - a[1]);
  const [yil, ay] = enCok[0].split("|");
  return { yil: Number(yil), ay };
}

export interface SayfaSonucu {
  sayfaAdi: string;
  ay: string | null;
  subeIdTahmin: string | null;
  gunluk: Omit<GunlukKayit, "sube_id">[];
  kalemler: Omit<Kalem, "sube_id" | "yil" | "ay">[];
}

type Izgara = unknown[][];

/**
 * Bir sayfayı çözümler. Eski excel.js → merkezGGSayfaAyristir'ın portu:
 * ilk 3 satırda "NAKİT" + "GENEL TOPLAM" içeren başlık aranır; bulunamazsa
 * ve 1. hücre tarihse standart kolon sırası (0..8) varsayılır.
 */
export function sayfaAyristir(grid: Izgara): {
  gunluk: Omit<GunlukKayit, "sube_id">[];
  kalemler: Omit<Kalem, "sube_id" | "yil" | "ay">[];
} | null {
  let hRow = -1;
  let col: Record<string, number> = {};

  for (let r = 0; r < Math.min(grid.length, 3); r++) {
    const row = (grid[r] ?? []).map((c) => String(c ?? "").replace(/i/g, "İ").toUpperCase().trim());
    const iNakit = row.findIndex((t) => t.includes("NAKİT") || t.includes("NAKIT"));
    const iGenel = row.findIndex((t) => t.includes("GENEL TOPLAM"));
    if (iNakit >= 0 && iGenel >= 0) {
      hRow = r;
      col = {
        nakit: iNakit,
        kredi_karti: row.findIndex((t) => t.includes("KREDİ") || t.includes("KREDI")),
        ticket: row.findIndex((t) => t.includes("TICKET") || t.includes("TİCKET")),
        yemek_sepeti: row.findIndex((t) => t.includes("YEMEK SEPET")),
        ayran: row.findIndex((t) => t === "AYRAN"),
        yemek: row.findIndex((t) => t === "YEMEK"),
        genel_masraf: row.findIndex((t) => t.includes("MASRAF")),
        genelToplam: iGenel,
      };
      break;
    }
  }

  if (hRow < 0) {
    if (tarihCevir(grid[0]?.[0]) !== null) {
      col = {
        nakit: 1,
        kredi_karti: 2,
        ticket: 3,
        yemek_sepeti: 4,
        ayran: 5,
        yemek: 6,
        genel_masraf: 7,
        genelToplam: 8,
      };
    } else {
      return null;
    }
  }

  const al = (row: unknown[], c: number) => (c >= 0 ? sayiOku(row[c]) : 0);

  const gunluk: Omit<GunlukKayit, "sube_id">[] = [];
  for (let r = hRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const tarih = tarihCevir(row[0]);
    if (tarih === null) break; // TOPLAM satırı vb. → tablo bitti
    gunluk.push({
      tarih,
      nakit: al(row, col.nakit),
      kredi_karti: al(row, col.kredi_karti),
      ticket: al(row, col.ticket),
      yemek_sepeti: al(row, col.yemek_sepeti),
      ayran: al(row, col.ayran),
      yemek: al(row, col.yemek),
      genel_masraf: al(row, col.genel_masraf),
    });
  }

  // Kalem listesi: "STOK HAREKETLERİ" etiketi, genel toplam kolonundan sonra.
  let kalemBas: { row: number; col: number } | null = null;
  for (let r = 0; r < grid.length && !kalemBas; r++) {
    const row = grid[r] ?? [];
    for (let c = (col.genelToplam ?? 0) + 1; c < row.length; c++) {
      const t = String(row[c] ?? "").replace(/i/g, "İ").toUpperCase();
      if (t.includes("STOK HAREKETLERİ") || t.includes("STOK HAREKETLERI")) {
        kalemBas = { row: r + 1, col: c };
        break;
      }
    }
  }

  const kalemler: Omit<Kalem, "sube_id" | "yil" | "ay">[] = [];
  if (kalemBas) {
    for (let r = kalemBas.row; r < grid.length; r++) {
      const row = grid[r] ?? [];
      const urun = row[kalemBas.col];
      if (urun === null || urun === undefined || String(urun).trim() === "") break;
      kalemler.push({
        urun: String(urun).trim(),
        adet: sayiOku(row[kalemBas.col + 1]),
        tutar: sayiOku(row[kalemBas.col + 2]),
      });
    }
  }

  return { gunluk, kalemler };
}
