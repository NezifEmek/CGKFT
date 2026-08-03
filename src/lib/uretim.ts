// uretim.ts — Günlük üretim: birim çevrimi, raporlama birimi ve toplamlar.
//
// ── İki ayrı birim kavramı var, karıştırmayın ────────────────────────────
//
// 1) ÖLÇÜ BİRİMİ (olcu_birimi) — kaydı GİRERKEN kullanılan birim.
//    Aynı ürün bir gün "9.000 Adet", başka gün "470 Paket", başka gün
//    "2.114 Kg" olarak girilebiliyor. Girişte kolaylık esas.
//
// 2) RAPORLAMA BİRİMİ (urun.rapor_birimi) — raporda GÖSTERİLEN birim.
//    Ürün tanımında sabit. Lavaş paket, mini soslar 250'lik paket,
//    çiğköfte kilogram diye raporlanır.
//
// Bu ikisi bilerek ayrı: kullanıcı istediği gibi girer, rapor her zaman
// aynı birimde çıkar. Rapor birimi üründe durduğu için değiştirildiğinde
// GEÇMİŞ kayıtlar da yeni birimde görünür — istenen davranış bu.
//
// Çevrilemeyen kayıt SIFIR sayılmaz, NULL kalır. Sıfır "hiç üretilmedi"
// demek olurdu; oysa gerçek durum "üretildi ama çeviremiyoruz". Ekran bu
// kayıtları ayrıca sayıp uyarır.

import { AYLAR_12 } from "@/types/database";

export const OLCU_BIRIMLERI = ["Adet", "Kg", "Koli", "Kutu", "Paket"] as const;
export type OlcuBirimi = (typeof OLCU_BIRIMLERI)[number];

export const AMBALAJ_BIRIMLERI = ["Adet", "Koli", "Kutu", "Paket"] as const;

export const RAPOR_BIRIMLERI = ["kg", "adet", "paket", "koli"] as const;
export type RaporBirimi = (typeof RAPOR_BIRIMLERI)[number];

export interface Urun {
  id: string;
  kod: string;
  ad: string;
  grup: string;
  ambalaj_tipi: string;
  ambalaj_birimi: string;
  birim_agirlik_kg: number | string | null;
  koli_adedi: number | null;
  raf_omru_gun: number | null;
  aktif: boolean;
  /** 0021 öncesi kayıtlarda yok — okunmadığında "kg" varsayılır. */
  rapor_birimi?: string | null;
  /** Bir raporlama biriminde kaç adet var. Yoksa 1. */
  rapor_bolen?: number | string | null;
}

export interface UretimKaydi {
  id: string;
  tarih: string;
  tesis: string;
  hat: string;
  vardiya: string;
  urun_id: string | null;
  urun_kod: string;
  urun_ad: string;
  urun_grup: string;
  ambalaj_tipi: string;
  miktar: number | string;
  olcu_birimi: string;
  kg_karsiligi: number | string | null;
  parti_no: string;
  skt: string | null;
  operator: string;
  aciklama: string;
  created_at: string;
}

/** Aylık şube satışı — üretimle karşılaştırma için. */
export interface SatisSatiri {
  yil: number;
  ay: string;
  kg: number | string;
}

function say(x: number | string | null | undefined): number | null {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function yuvarla(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Girilen miktarı kilograma çevirir. Çevrilemiyorsa null.
 *
 * Kutu ve Paket, koliyle aynı mantıkta çalışır: ürün tanımındaki "bir
 * kolide kaç adet" sayısı kullanılır. Ayrı bir kutu/paket adedi tutmak
 * veri girişini ağırlaştırırdı; pratikte kolideki adet neyse kutudaki da
 * odur.
 */
export function kilogramaCevir(
  miktar: number | string,
  olcuBirimi: string,
  urun: Pick<Urun, "birim_agirlik_kg" | "koli_adedi"> | null | undefined,
): number | null {
  const m = say(miktar);
  if (m == null) return null;
  if (olcuBirimi === "Kg") return yuvarla(m);

  const birimKg = say(urun?.birim_agirlik_kg);
  if (birimKg == null || birimKg <= 0) return null;

  if (olcuBirimi === "Adet") return yuvarla(m * birimKg);

  // Koli / Kutu / Paket → adet → kg
  const koli = say(urun?.koli_adedi);
  if (koli == null || koli <= 0) return null;
  return yuvarla(m * koli * birimKg);
}

/**
 * Girilen miktarı ADETE çevirir — raporlama biriminin temel taşı.
 *
 * Neden gerekli: rapor birimi "50'lik paket" ise miktarı doğrudan 50'ye
 * bölemeyiz; çünkü miktar Adet de olabilir, Paket de, Kg de. Önce hepsi
 * ortak paydaya (adet) indirilir, sonra bölünür.
 */
export function adedeCevir(
  miktar: number | string,
  olcuBirimi: string,
  urun: Pick<Urun, "birim_agirlik_kg" | "koli_adedi"> | null | undefined,
): number | null {
  const m = say(miktar);
  if (m == null) return null;
  if (olcuBirimi === "Adet") return yuvarla(m);

  if (olcuBirimi === "Kg") {
    const birimKg = say(urun?.birim_agirlik_kg);
    if (birimKg == null || birimKg <= 0) return null;
    return yuvarla(m / birimKg);
  }

  // Koli / Kutu / Paket
  const koli = say(urun?.koli_adedi);
  if (koli == null || koli <= 0) return null;
  return yuvarla(m * koli);
}

// ─── Raporlama birimi ─────────────────────────────────────────────────────

export function raporBirimi(urun: Urun | null | undefined): RaporBirimi {
  const b = String(urun?.rapor_birimi ?? "kg").toLowerCase();
  return (RAPOR_BIRIMLERI as readonly string[]).includes(b) ? (b as RaporBirimi) : "kg";
}

export function raporBolen(urun: Urun | null | undefined): number {
  const n = say(urun?.rapor_bolen);
  return n != null && n > 0 ? n : 1;
}

/**
 * Ürünün raporlama biriminin insan diliyle açıklaması.
 * Nezif'in isteği: "açıklamalarında da böyle olduğu açıkça yazılsın."
 */
export function raporAciklama(urun: Urun | null | undefined): string {
  const b = raporBirimi(urun);
  if (b === "kg") return "kilogram olarak raporlanır";
  const bolen = raporBolen(urun);
  if (bolen === 1) return `${b} olarak raporlanır`;
  return `1 ${b} = ${adetYaz(bolen)} adet`;
}

/** Kısa etiket: "paket (50'li)" — tablo başlığında kullanılır. */
export function raporEtiketi(urun: Urun | null | undefined): string {
  const b = raporBirimi(urun);
  const bolen = raporBolen(urun);
  if (b === "kg" || bolen === 1) return b;
  return `${b} · ${adetYaz(bolen)}'li`;
}

/** Bir kaydın, ürünün kendi raporlama birimindeki miktarı. Çevrilemezse null. */
export function raporMiktari(
  kayit: Pick<UretimKaydi, "miktar" | "olcu_birimi" | "kg_karsiligi">,
  urun: Urun | null | undefined,
): number | null {
  if (raporBirimi(urun) === "kg") return say(kayit.kg_karsiligi);
  const adet = adedeCevir(kayit.miktar, kayit.olcu_birimi, urun);
  if (adet == null) return null;
  return yuvarla(adet / raporBolen(urun));
}

// ─── Kayıt → ürün eşleme ──────────────────────────────────────────────────
//
// Kayıtta ürün adı/kodu kopyalanmış olarak duruyor (ürün silinse bile
// geçmiş okunabilsin diye). Rapor birimini bulmak için asıl ürün tanımına
// dönmek gerekiyor: önce kimlikten, olmazsa koddan, olmazsa addan.

export type UrunHaritasi = Map<string, Urun>;

function anahtarla(s: string | null | undefined): string {
  return (s ?? "").trim().toLocaleUpperCase("tr");
}

export function urunHaritasi(urunler: Urun[]): UrunHaritasi {
  const m: UrunHaritasi = new Map();
  for (const u of urunler) {
    m.set("id:" + u.id, u);
    if (u.kod) m.set("kod:" + anahtarla(u.kod), u);
    if (u.ad) m.set("ad:" + anahtarla(u.ad), u);
  }
  return m;
}

export function kayitUrunu(
  k: Pick<UretimKaydi, "urun_id" | "urun_kod" | "urun_ad">,
  harita: UrunHaritasi,
): Urun | null {
  return (
    (k.urun_id ? harita.get("id:" + k.urun_id) : undefined) ??
    harita.get("kod:" + anahtarla(k.urun_kod)) ??
    harita.get("ad:" + anahtarla(k.urun_ad)) ??
    null
  );
}

/**
 * Kilogram karşılığı olmayan kayıtlar.
 *
 * Bu bir HATA DEĞİL: bazı ürünler kilogramla ölçülmüyor. Ekran bunları
 * ayrı sayar.
 */
export function kgsizKayitlar(kayitlar: UretimKaydi[]): UretimKaydi[] {
  return kayitlar.filter((k) => say(k.kg_karsiligi) == null);
}

// ─── Kırılımlar ───────────────────────────────────────────────────────────

export interface Kirilim {
  anahtar: string;
  kg: number;
  /** Kilogramı olmayan ürünlerin miktarı (kendi giriş biriminde) */
  adet: number;
  kayit: number;
}

function kir(kayitlar: UretimKaydi[], al: (k: UretimKaydi) => string): Kirilim[] {
  const m = new Map<string, { kg: number; adet: number; kayit: number }>();
  for (const k of kayitlar) {
    const a = al(k) || "(belirtilmemiş)";
    const kg = say(k.kg_karsiligi);
    const v = m.get(a) ?? { kg: 0, adet: 0, kayit: 0 };
    if (kg == null) v.adet += say(k.miktar) ?? 0;
    else v.kg += kg;
    v.kayit++;
    m.set(a, v);
  }
  return [...m.entries()]
    .map(([anahtar, v]) => ({
      anahtar,
      kg: yuvarla(v.kg),
      adet: yuvarla(v.adet),
      kayit: v.kayit,
    }))
    // Kilogramı olanlar önce, sonra adetliler — ikisi aynı sütunda
    // toplanamayacağı için sıralama da ayrı yapılıyor.
    .sort((a, b) => b.kg - a.kg || b.adet - a.adet);
}

/** Bir ürünün, kendi raporlama birimindeki toplamı. */
export interface UrunOzet {
  urunId: string | null;
  ad: string;
  birim: RaporBirimi;
  bolen: number;
  aciklama: string;
  etiket: string;
  /** Kendi raporlama birimindeki toplam */
  deger: number;
  /** Bilgi amaçlı kilogram toplamı — kg bazlı olmayan üründe de dolu olabilir */
  kg: number;
  kayit: number;
  /** Raporlama birimine çevrilemeyen kayıt sayısı */
  cevrilemeyen: number;
}

// ─── Aylık üretim + satış ─────────────────────────────────────────────────

export interface AylikSatir {
  /** "2026-07" */
  ay: string;
  /** "Temmuz 2026" */
  etiket: string;
  /** ürün adı → kendi raporlama birimindeki miktar */
  urunler: Record<string, number>;
  /** kg bazlı raporlanan ürünlerin ay toplamı (çiğköfte) */
  kgToplam: number;
  /** O ayın şube satışı (kg). Veri girilmemişse null. */
  satisKg: number | null;
  kayit: number;
}

/**
 * Şube satışlarını "2026-07" biçimli anahtara indirir.
 * Satış tablosu ayı "TEMMUZ" gibi Türkçe adla tutuyor.
 */
export function satisHaritasi(satislar: SatisSatiri[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of satislar) {
    const i = AYLAR_12.indexOf(anahtarla(s.ay) as (typeof AYLAR_12)[number]);
    if (i < 0) continue;
    const anahtar = `${s.yil}-${String(i + 1).padStart(2, "0")}`;
    m.set(anahtar, (m.get(anahtar) ?? 0) + (say(s.kg) ?? 0));
  }
  return m;
}

export function ayEtiketi(ay: string): string {
  const [y, a] = ay.split("-");
  const i = Number(a) - 1;
  const ad = AYLAR_12[i];
  if (!ad) return ay;
  return `${ad.charAt(0)}${ad.slice(1).toLocaleLowerCase("tr")} ${y}`;
}

/** Bir ürünün 12 aylık üretim (ve varsa satış) serisi — çubuk grafik için. */
export interface UrunAylikSeri {
  ad: string;
  birim: RaporBirimi;
  aciklama: string;
  yil: number;
  /** Ocak'tan Aralık'a 12 ay; veri yoksa değer null */
  aylar: {
    ay: string;        // "2026-07"
    kisa: string;      // "Tem"
    uretim: number | null;
    satis: number | null;
    /** İçinde bulunduğumuz ay — grafikte vurgulanır */
    buAy: boolean;
  }[];
  /** Bulunduğumuz ayın üretimi (yoksa null) */
  buAyUretim: number | null;
  buAySatis: number | null;
  yillikUretim: number;
  yillikSatis: number | null;
  /** Bu ürün için satış verisi tutuluyor mu */
  satisVar: boolean;
}

const AY_KISA_12 = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

/**
 * Her ürün için yıllık çubuk grafik serisi üretir.
 *
 * ── Satış neden yalnızca kilogram ürününde var ───────────────────────────
 * aylik_satislar tablosunda ÜRÜN KIRILIMI YOK: şube başına aylık tek bir kg
 * değeri tutuluyor, o da çiğköfte satışı. Lavaşın ya da sosların satışı
 * sistemde hiç kayıtlı değil. Bu yüzden satış serisi yalnızca kilogram
 * raporlanan ürüne bağlanıyor; diğer grafikler yalnızca üretim gösterir ve
 * ekran bunun sebebini yazar. Uydurma bir eşleştirme yapmaktansa eksiği
 * söylemek doğru.
 */
export function urunAylikSeriler(
  urunOzetleri: UrunOzet[],
  aylik: AylikSatir[],
  satisMap: Map<string, number>,
  bugun: string,
): UrunAylikSeri[] {
  // Grafiklerin yılı: üretim kaydı olan EN SON yıl. Üretim yoksa bugünün yılı.
  const yillar = aylik.map((a) => Number(a.ay.slice(0, 4))).filter(Number.isFinite);
  const yil = yillar.length ? Math.max(...yillar) : Number(bugun.slice(0, 4));
  const buAyAnahtar = bugun.slice(0, 7);

  return urunOzetleri.map((u) => {
    const satisVar = u.birim === "kg";
    const aylar = AY_KISA_12.map((kisa, i) => {
      const ay = `${yil}-${String(i + 1).padStart(2, "0")}`;
      const satir = aylik.find((a) => a.ay === ay);
      const uretim = satir?.urunler[u.ad] ?? null;
      const satis = satisVar ? satisMap.get(ay) ?? null : null;
      return { ay, kisa, uretim, satis, buAy: ay === buAyAnahtar };
    });

    const buAySatir = aylar.find((a) => a.buAy) ?? null;
    const yillikUretim = yuvarla(
      aylar.reduce((t, a) => t + (a.uretim ?? 0), 0),
    );
    const yillikSatisHam = aylar.reduce((t, a) => t + (a.satis ?? 0), 0);

    return {
      ad: u.ad,
      birim: u.birim,
      aciklama: u.aciklama,
      yil,
      aylar,
      buAyUretim: buAySatir?.uretim ?? null,
      buAySatis: buAySatir?.satis ?? null,
      yillikUretim,
      yillikSatis: satisVar ? yuvarla(yillikSatisHam) : null,
      satisVar,
    };
  });
}

export interface UretimOzet {
  /** kg olarak raporlanan ürünlerin toplamı */
  toplamKg: number;
  /** kg olarak raporlanan ürün adları — başlıklarda gösterilir */
  kgUrunAdlari: string[];
  kayitSayisi: number;
  /** Kilogram karşılığı hesaplanamayan kayıt sayısı */
  adetliKayitSayisi: number;
  bugunKg: number;
  buAyKg: number;
  gunlukOrtalamaKg: number | null;
  uretimGunuSayisi: number;

  /** Her ürün kendi raporlama biriminde */
  urunOzetleri: UrunOzet[];
  /** Ürün başına 12 aylık üretim/satış serisi — çubuk grafikler */
  urunSerileri: UrunAylikSeri[];
  gruplar: Kirilim[];
  ambalajlar: Kirilim[];
  /** kg bazlı ürünlerin günlük trendi */
  gunluk: { tarih: string; kg: number }[];
  /** Tüm ürünlerin ay ay dökümü + satış karşılaştırması */
  aylik: AylikSatir[];
}

/**
 * Üretim özeti.
 *
 * Toplam TEK bir sayı değil: her ürün kendi raporlama biriminde toplanıyor.
 * 55.267 kg çiğköfte ile 9.646 paket lavaş toplanamaz — üstteki kartlar bu
 * yüzden yalnızca kilogramla raporlanan ürünleri gösteriyor, geri kalanı
 * ürün ve ay tablolarında kendi biriminde duruyor.
 */
export function uretimOzeti(
  kayitlar: UretimKaydi[],
  urunler: Urun[],
  bugun: string,
  satislar: SatisSatiri[] = [],
): UretimOzet {
  const harita = urunHaritasi(urunler);
  const satisMap = satisHaritasi(satislar);

  let toplamKg = 0;
  const kgUrunAdlari = new Set<string>();
  const gunMap = new Map<string, number>();

  // ürün adı → özet
  const urunMap = new Map<string, UrunOzet>();
  // ay → satır
  const ayMap = new Map<string, AylikSatir>();

  for (const k of kayitlar) {
    const urun = kayitUrunu(k, harita);
    const ad = k.urun_ad || k.urun_kod || urun?.ad || "(belirtilmemiş)";
    const birim = raporBirimi(urun);
    const g = k.tarih.slice(0, 10);
    const ay = k.tarih.slice(0, 7);
    const kg = say(k.kg_karsiligi);
    const deger = raporMiktari(k, urun);

    // ── Ürün özeti
    let uo = urunMap.get(ad);
    if (!uo) {
      uo = {
        urunId: urun?.id ?? null,
        ad,
        birim,
        bolen: raporBolen(urun),
        aciklama: raporAciklama(urun),
        etiket: raporEtiketi(urun),
        deger: 0,
        kg: 0,
        kayit: 0,
        cevrilemeyen: 0,
      };
      urunMap.set(ad, uo);
    }
    if (deger == null) uo.cevrilemeyen++;
    else uo.deger += deger;
    if (kg != null) uo.kg += kg;
    uo.kayit++;

    // ── Ay satırı
    let as = ayMap.get(ay);
    if (!as) {
      as = {
        ay,
        etiket: ayEtiketi(ay),
        urunler: {},
        kgToplam: 0,
        satisKg: satisMap.get(ay) ?? null,
        kayit: 0,
      };
      ayMap.set(ay, as);
    }
    if (deger != null) as.urunler[ad] = yuvarla((as.urunler[ad] ?? 0) + deger);
    as.kayit++;

    // ── Kilogramla raporlanan ürünler: kartlar ve trend bunlardan çıkıyor
    if (birim === "kg" && kg != null) {
      kgUrunAdlari.add(ad);
      toplamKg += kg;
      gunMap.set(g, (gunMap.get(g) ?? 0) + kg);
      as.kgToplam = yuvarla(as.kgToplam + kg);
    }
  }

  const gunluk = [...gunMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tarih, kg]) => ({ tarih, kg: yuvarla(kg) }));
  const uretimGunu = gunluk.filter((g) => g.kg > 0).length;

  const buAy = bugun.slice(0, 7);

  const urunOzetleri = [...urunMap.values()].sort(
    // Kilogramlılar önce (ana ürün), sonra miktara göre
    (a, b) =>
      Number(b.birim === "kg") - Number(a.birim === "kg") ||
      b.kg - a.kg ||
      b.deger - a.deger,
  );
  const aylikSatirlar = [...ayMap.values()].sort((a, b) => a.ay.localeCompare(b.ay));

  return {
    toplamKg: yuvarla(toplamKg),
    kgUrunAdlari: [...kgUrunAdlari].sort((a, b) => a.localeCompare(b, "tr")),
    kayitSayisi: kayitlar.length,
    adetliKayitSayisi: kgsizKayitlar(kayitlar).length,
    bugunKg: yuvarla(gunMap.get(bugun) ?? 0),
    buAyKg: yuvarla(ayMap.get(buAy)?.kgToplam ?? 0),
    gunlukOrtalamaKg: uretimGunu ? yuvarla(toplamKg / uretimGunu) : null,
    uretimGunuSayisi: uretimGunu,
    urunOzetleri,
    urunSerileri: urunAylikSeriler(urunOzetleri, aylikSatirlar, satisMap, bugun),
    gruplar: kir(kayitlar, (k) => k.urun_grup),
    ambalajlar: kir(kayitlar, (k) => k.ambalaj_tipi),
    gunluk,
    aylik: aylikSatirlar,
  };
}

// ─── Yazım ────────────────────────────────────────────────────────────────

/** kg'ı okunur yazar: 1234.5 → "1.234,5 kg" */
export function kgYaz(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " kg";
}

/** Adet/koli miktarını okunur yazar. */
export function adetYaz(n: number | null | undefined): string {
  if (n == null || n === 0) return "";
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

/** Sayıyı, ürünün raporlama biriminde yazar: "9.646 paket", "55.267 kg" */
export function birimliYaz(deger: number | null | undefined, birim: RaporBirimi): string {
  if (deger == null) return "—";
  if (birim === "kg") return kgYaz(deger);
  const ondalikli = Math.abs(deger % 1) > 0.001;
  return (
    deger.toLocaleString("tr-TR", { maximumFractionDigits: ondalikli ? 1 : 0 }) + " " + birim
  );
}

/**
 * Bir kırılım satırının okunur karşılığı.
 * Kilogramı olan "1.234 kg", olmayan "300 adet" gösterir.
 */
export function miktarYaz(k: Pick<Kirilim, "kg" | "adet">): string {
  const parcalar: string[] = [];
  if (k.kg > 0) parcalar.push(kgYaz(k.kg));
  if (k.adet > 0) parcalar.push(`${adetYaz(k.adet)} adet`);
  return parcalar.join(" + ") || "—";
}

export function uretimCsv(kayitlar: UretimKaydi[], urunler: Urun[] = []): string {
  const harita = urunHaritasi(urunler);
  const basliklar = [
    "Tarih", "Ürün Kodu", "Ürün Adı", "Ürün Grubu",
    "Ambalaj Tipi", "Miktar", "Ölçü Birimi", "Kg Karşılığı",
    "Rapor Miktarı", "Rapor Birimi", "Parti No",
    "SKT", "Operatör", "Açıklama",
  ];
  const kacir = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return /[";\n]/.test(s) ? `"${s}"` : s;
  };
  const satirlar = kayitlar.map((k) => {
    const urun = kayitUrunu(k, harita);
    return [
      k.tarih, k.urun_kod, k.urun_ad, k.urun_grup,
      k.ambalaj_tipi, k.miktar, k.olcu_birimi, k.kg_karsiligi ?? "",
      raporMiktari(k, urun) ?? "", raporEtiketi(urun), k.parti_no,
      k.skt ?? "", k.operator, k.aciklama,
    ].map(kacir).join(";");
  });
  return "﻿" + [basliklar.join(";"), ...satirlar].join("\r\n");
}

/** Aylık üretim + satış tablosunun CSV'si. */
export function aylikCsv(aylik: AylikSatir[], urunOzetleri: UrunOzet[]): string {
  const kacir = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return /[";\n]/.test(s) ? `"${s}"` : s;
  };
  const basliklar = [
    "Ay",
    ...urunOzetleri.map((u) => `${u.ad} (${u.etiket})`),
    "Şube satışı (kg)",
  ];
  const satirlar = aylik.map((a) =>
    [
      a.etiket,
      ...urunOzetleri.map((u) => a.urunler[u.ad] ?? ""),
      a.satisKg ?? "",
    ].map(kacir).join(";"),
  );
  return "﻿" + [basliklar.join(";"), ...satirlar].join("\r\n");
}

/**
 * Excel'den toplu içe aktarma için satır eşleme.
 * Başlık adları serbest yazılabildiği için gevşek eşleştirme yapılır.
 */
export function basligiTani(baslik: string): string | null {
  // Türkçe harfler ASCII'ye katlanır: "Üretim Tarihi", "URETIM TARIHI" ve
  // "üretim tarihi" aynı anahtara düşsün. Katlamadan yalnızca ASCII yazan
  // başlıklar tanınırdı — Excel'de kimse öyle yazmaz.
  const b = baslik
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]/g, "");
  const harita: Record<string, string> = {
    tarih: "tarih", uretimtarihi: "tarih",
    tesis: "tesis", fabrika: "tesis", uretimtesisi: "tesis",
    hat: "hat", uretimhatti: "hat",
    vardiya: "vardiya",
    urunkodu: "urun_kod", kod: "urun_kod",
    urunadi: "urun_ad", urun: "urun_ad",
    urungrubu: "urun_grup", grup: "urun_grup",
    ambalajtipi: "ambalaj_tipi", ambalaj: "ambalaj_tipi",
    miktar: "miktar", uretilenmiktar: "miktar",
    olcubirimi: "olcu_birimi", birim: "olcu_birimi",
    partino: "parti_no", parti: "parti_no", lot: "parti_no", lotno: "parti_no",
    skt: "skt", sonkullanmatarihi: "skt",
    operator: "operator", personel: "operator", uretimiyapan: "operator",
    aciklama: "aciklama", not: "aciklama", notlar: "aciklama",
  };
  return harita[b] ?? null;
}
