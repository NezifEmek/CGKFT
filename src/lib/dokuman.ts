// dokuman.ts — Doküman Yönetimi ve Prim ekranlarının paylaştığı yapılandırma erişimi.
//
// Eski panelde bu veri localStorage'daydı ve "kaydedilmiş yoksa varsayılanı kullan,
// eksik alanı varsayılanla tamamla" mantığı vardı (docs_store.js → getDocs).
// Aynı davranışı dokuman_ayarlari tablosu üzerinden yürütüyoruz.

import {
  VARSAYILAN_POZISYONLAR,
  VARSAYILAN_PRIM_AYARLARI,
  type Pozisyon,
  type PrimAyarlari,
} from "./dokuman-varsayilan";

export const POZISYON_ALANLARI = [
  { key: "adSoyad", etiket: "Ad Soyad", cokSatir: false },
  { key: "bagliKisi", etiket: "Bağlı Olduğu Kişi", cokSatir: false },
  { key: "yedek", etiket: "Yedek Sorumlusu", cokSatir: false },
  { key: "amac", etiket: "Amaç", cokSatir: true, satir: 3 },
  { key: "gorevlerGunluk", etiket: "Görevler — Günlük", cokSatir: true, satir: 5 },
  { key: "gorevlerHaftalik", etiket: "Görevler — Haftalık", cokSatir: true, satir: 5 },
  { key: "gorevlerAylik", etiket: "Görevler — Aylık / Dönemsel", cokSatir: true, satir: 5 },
  { key: "sorumluluklar", etiket: "Sorumluluklar", cokSatir: true, satir: 4 },
  { key: "yetkiler", etiket: "Yetkiler", cokSatir: true, satir: 3 },
  { key: "ozellikler", etiket: "Özellikler / Yeterlilikler", cokSatir: true, satir: 4 },
  { key: "kpiSeti", etiket: "KPI Seti", cokSatir: true, satir: 7 },
  { key: "raporlama", etiket: "Raporlama", cokSatir: true, satir: 4 },
  { key: "primBaglantisi", etiket: "Prim Sistemi Bağlantısı", cokSatir: true, satir: 3 },
] as const satisfies readonly {
  key: keyof Pozisyon;
  etiket: string;
  cokSatir: boolean;
  satir?: number;
}[];

/** Dışa aktarımda ve yazdırmada kullanılan bölüm sırası (eski docexport.js ile aynı). */
export const DISA_AKTARIM_SIRASI: (keyof Pozisyon)[] = [
  "amac",
  "gorevlerGunluk",
  "gorevlerHaftalik",
  "gorevlerAylik",
  "sorumluluklar",
  "yetkiler",
  "ozellikler",
  "kpiSeti",
  "raporlama",
  "primBaglantisi",
];

export const ALAN_BASLIK: Partial<Record<keyof Pozisyon, string>> = Object.fromEntries(
  POZISYON_ALANLARI.map((a) => [a.key, a.etiket]),
);

/** Boş/eksik kayıtta varsayılana düşer — eski getDocs() davranışı. */
export function pozisyonlariNormalize(ham: unknown): Pozisyon[] {
  if (!Array.isArray(ham) || ham.length === 0) {
    return VARSAYILAN_POZISYONLAR.map((p) => ({ ...p }));
  }
  return (ham as Pozisyon[]).map((p) => ({
    ...VARSAYILAN_POZISYONLAR.find((v) => v.id === p.id),
    ...p,
  })) as Pozisyon[];
}

/** Kaydedilmiş prim ayarlarındaki eksik alanları varsayılanla tamamlar. */
export function primAyarlariNormalize(ham: unknown): PrimAyarlari {
  if (!ham || typeof ham !== "object" || Array.isArray(ham)) {
    return { ...VARSAYILAN_PRIM_AYARLARI };
  }
  return { ...VARSAYILAN_PRIM_AYARLARI, ...(ham as Partial<PrimAyarlari>) };
}

export { VARSAYILAN_POZISYONLAR, VARSAYILAN_PRIM_AYARLARI };
export type { Pozisyon, PrimAyarlari };
