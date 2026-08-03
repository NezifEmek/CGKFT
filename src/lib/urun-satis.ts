// urun-satis.ts — Ürün bazında aylık satış.
//
// Üretim tarafındaki `uretim_kayitlari` ile aynı mantık: girilen miktar ve
// ölçü birimi saklanır, raporlama birimine okuma anında çevrilir. Ürünün
// rapor birimi değiştiğinde geçmiş satışlar da yeni birimde görünür.
//
// ── Toplam mı şube mi ────────────────────────────────────────────────────
// sube_id NULL olan satır "bütün şubelerin toplamı" demek. Şu an girişler
// böyle yapılıyor; ileride şube bazına geçilecek (Nezif: "sonraki aylarda
// şube bazında da girilmesi durumu oluşacak").
//
// Aynı ürün/ayda ikisi birden bulunursa toplamak rakamı ikiye katlar.
// KURAL: şube satırları önceliklidir. O ayda en az bir şube satırı varsa
// toplam satırı hesaba katılmaz; ekran bunu ayrıca uyarı olarak gösterir —
// sessizce görmezden gelmek, kullanıcının girdiği veriyi kaybetmiş gibi
// hissettirirdi.

import { AYLAR_12 } from "@/types/database";
import {
  adedeCevir, raporBirimi, raporBolen, urunHaritasi,
  type Urun, type RaporBirimi,
} from "@/lib/uretim";

export const SATIS_OLCU_BIRIMLERI = ["Adet", "Kg", "Koli", "Kutu", "Paket"] as const;

export interface UrunSatis {
  id: string;
  urun_id: string;
  yil: number;
  ay: string;
  sube_id: string | null;
  miktar: number | string;
  olcu_birimi: string;
  aciklama: string;
  updated_at: string;
}

function say(x: number | string | null | undefined): number | null {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function yuvarla(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** "2026-07" biçimli ay anahtarı. Tanınmayan ay adında null. */
export function ayAnahtari(yil: number, ay: string): string | null {
  const i = AYLAR_12.indexOf(ay.trim().toLocaleUpperCase("tr") as (typeof AYLAR_12)[number]);
  if (i < 0) return null;
  return `${yil}-${String(i + 1).padStart(2, "0")}`;
}

/** "2026-07" → { yil: 2026, ay: "TEMMUZ" } */
export function anahtardanDonem(anahtar: string): { yil: number; ay: string } | null {
  const [y, a] = anahtar.split("-");
  const i = Number(a) - 1;
  if (!AYLAR_12[i] || !Number.isFinite(Number(y))) return null;
  return { yil: Number(y), ay: AYLAR_12[i] };
}

export interface SatisHucresi {
  /** Ürünün raporlama birimindeki miktar */
  deger: number;
  birim: RaporBirimi;
  /** Şube satırlarından mı geldi (true) yoksa toplam satırından mı (false) */
  subeBazli: boolean;
  /** Kaç şube satırı toplandı (toplam satırında 0) */
  subeSayisi: number;
  /** Şube satırları varken göz ardı edilen bir toplam satırı da var mı */
  toplamSatiriGoardiEdildi: boolean;
  /** Raporlama birimine çevrilemeyen satır sayısı */
  cevrilemeyen: number;
}

/**
 * Satış satırlarını "ürün adı → ay → hücre" haritasına indirger.
 *
 * Anahtar olarak ürün ADI kullanılıyor; üretim özeti de ürünleri adıyla
 * grupluyor, iki taraf böyle buluşuyor.
 */
export function satisHaritasiKur(
  satislar: UrunSatis[],
  urunler: Urun[],
): Map<string, Map<string, SatisHucresi>> {
  const harita = urunHaritasi(urunler);
  const urunById = new Map(urunler.map((u) => [u.id, u]));

  // Önce ham toplama: ürün+ay için şube ve toplam ayrı biriktiriliyor.
  interface Kova {
    subeAdet: number;
    subeSayisi: number;
    toplamAdet: number | null;
    cevrilemeyen: number;
  }
  const kovalar = new Map<string, Map<string, Kova>>();

  for (const s of satislar) {
    const urun = urunById.get(s.urun_id) ?? null;
    if (!urun) continue; // ürün silinmiş — grafik zaten göstermiyor
    const ayAnahtar = ayAnahtari(s.yil, s.ay);
    if (!ayAnahtar) continue;

    const ad = urun.ad;
    let aylar = kovalar.get(ad);
    if (!aylar) {
      aylar = new Map();
      kovalar.set(ad, aylar);
    }
    let kova = aylar.get(ayAnahtar);
    if (!kova) {
      kova = { subeAdet: 0, subeSayisi: 0, toplamAdet: null, cevrilemeyen: 0 };
      aylar.set(ayAnahtar, kova);
    }

    // Her şey önce ADETE indiriliyor — girilen birim satırdan satıra
    // değişebiliyor (bir ay koli, başka ay adet girilmiş olabilir).
    const adet = adedeCevir(s.miktar, s.olcu_birimi, urun);
    if (adet == null) {
      kova.cevrilemeyen++;
      continue;
    }

    if (s.sube_id) {
      kova.subeAdet += adet;
      kova.subeSayisi++;
    } else {
      kova.toplamAdet = (kova.toplamAdet ?? 0) + adet;
    }
  }

  // Sonra kural uygulanıyor: şube satırı varsa toplam satırı yok sayılır.
  const sonuc = new Map<string, Map<string, SatisHucresi>>();
  for (const [ad, aylar] of kovalar) {
    const urun = harita.get("ad:" + ad.trim().toLocaleUpperCase("tr")) ?? null;
    const birim = raporBirimi(urun);
    const bolen = raporBolen(urun);
    const hucreler = new Map<string, SatisHucresi>();

    for (const [ayAnahtar, kova] of aylar) {
      const subeBazli = kova.subeSayisi > 0;
      const adet = subeBazli ? kova.subeAdet : kova.toplamAdet ?? 0;
      hucreler.set(ayAnahtar, {
        // kg raporlanan üründe adet→kg çevrimi birim ağırlıkla yapılır;
        // diğerlerinde adet bölene bölünür.
        deger: yuvarla(birim === "kg" ? adet * (say(urun?.birim_agirlik_kg) ?? 1) : adet / bolen),
        birim,
        subeBazli,
        subeSayisi: kova.subeSayisi,
        toplamSatiriGoardiEdildi: subeBazli && kova.toplamAdet != null,
        cevrilemeyen: kova.cevrilemeyen,
      });
    }
    sonuc.set(ad, hucreler);
  }
  return sonuc;
}

/** Girişte kullanılabilecek birimler — ürünün rapor birimi öne alınır. */
export function onerilenBirim(urun: Urun | null | undefined): string {
  const b = raporBirimi(urun);
  if (b === "kg") return "Kg";
  if (b === "koli") return "Koli";
  if (b === "paket") return "Paket";
  return "Adet";
}

/** Bir dönemde girilmiş satırları ürün kimliğine göre indeksler. */
export function donemSatirlari(
  satislar: UrunSatis[],
  yil: number,
  ay: string,
): Map<string, UrunSatis> {
  const m = new Map<string, UrunSatis>();
  for (const s of satislar) {
    // Giriş ekranı şimdilik yalnızca TOPLAM satırlarını düzenliyor.
    if (s.sube_id) continue;
    if (s.yil !== yil || s.ay !== ay) continue;
    m.set(s.urun_id, s);
  }
  return m;
}

/** Ekranda gösterilecek dönem listesi — veri olan aylar, yeniden eskiye. */
export function donemler(satislar: UrunSatis[]): { yil: number; ay: string; anahtar: string }[] {
  const set = new Map<string, { yil: number; ay: string; anahtar: string }>();
  for (const s of satislar) {
    const anahtar = ayAnahtari(s.yil, s.ay);
    if (anahtar) set.set(anahtar, { yil: s.yil, ay: s.ay, anahtar });
  }
  return [...set.values()].sort((a, b) => b.anahtar.localeCompare(a.anahtar));
}
