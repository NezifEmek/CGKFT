// uretim.ts — Günlük üretim: birim çevrimi ve toplamlar.
//
// Modülün tek zor yeri birim çevrimi. Üretim adet, koli veya kg olarak
// girilebiliyor; "günlük toplam üretim" diye anlamlı bir sayı üretmek
// için hepsinin kilograma indirgenmesi gerekiyor.
//
// Çevrilemeyen kayıt SIFIR sayılmaz, NULL kalır. Sıfır "hiç üretilmedi"
// demek olurdu; oysa gerçek durum "üretildi ama kg'a çeviremiyoruz".
// Ekran bu kayıtları ayrıca sayıp uyarır — sessizce eksik toplam
// göstermektense eksiği söylemek doğru.

export const OLCU_BIRIMLERI = ["Adet", "Kg", "Koli", "Kutu", "Paket"] as const;
export type OlcuBirimi = (typeof OLCU_BIRIMLERI)[number];

export const AMBALAJ_BIRIMLERI = ["Adet", "Koli", "Kutu", "Paket"] as const;

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

function say(x: number | string | null | undefined): number | null {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Girilen miktarı kilograma çevirir. Çevrilemiyorsa null.
 *
 * Kutu ve Paket, ambalaj birimi olarak koliyle aynı mantıkta çalışır:
 * ürün tanımındaki "bir kolide kaç adet" sayısı kullanılır. Ayrı bir
 * kutu/paket adedi tutmak veri girişini ağırlaştırırdı; pratikte
 * kolideki adet neyse kutudaki da odur.
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
  const koli = urun?.koli_adedi;
  if (!koli || koli <= 0) return null;
  return yuvarla(m * koli * birimKg);
}

function yuvarla(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Çevrilemeyen kayıt sayısı — toplamın ne kadarını kaçırdığımızı söyler. */
export function cevrilemeyen(kayitlar: UretimKaydi[]): UretimKaydi[] {
  return kayitlar.filter((k) => say(k.kg_karsiligi) == null);
}

export interface Kirilim {
  anahtar: string;
  kg: number;
  kayit: number;
}

function kir(
  kayitlar: UretimKaydi[],
  al: (k: UretimKaydi) => string,
): Kirilim[] {
  const m = new Map<string, { kg: number; kayit: number }>();
  for (const k of kayitlar) {
    const a = al(k) || "(belirtilmemiş)";
    const kg = say(k.kg_karsiligi) ?? 0;
    const v = m.get(a) ?? { kg: 0, kayit: 0 };
    v.kg += kg;
    v.kayit++;
    m.set(a, v);
  }
  return [...m.entries()]
    .map(([anahtar, v]) => ({ anahtar, kg: yuvarla(v.kg), kayit: v.kayit }))
    .sort((a, b) => b.kg - a.kg);
}

export interface UretimOzet {
  toplamKg: number;
  kayitSayisi: number;
  cevrilemeyenSayisi: number;
  bugunKg: number;
  buAyKg: number;
  gunlukOrtalamaKg: number | null;
  uretimGunuSayisi: number;

  urunler: Kirilim[];
  gruplar: Kirilim[];
  ambalajlar: Kirilim[];
  tesisler: Kirilim[];
  hatlar: Kirilim[];
  vardiyalar: Kirilim[];
  gunluk: { tarih: string; kg: number }[];
  aylik: { ay: string; kg: number }[];
}

export function uretimOzeti(kayitlar: UretimKaydi[], bugun: string): UretimOzet {
  let toplamKg = 0;
  const gunMap = new Map<string, number>();
  const ayMap = new Map<string, number>();

  for (const k of kayitlar) {
    const kg = say(k.kg_karsiligi) ?? 0;
    toplamKg += kg;
    const g = k.tarih.slice(0, 10);
    gunMap.set(g, (gunMap.get(g) ?? 0) + kg);
    const a = k.tarih.slice(0, 7);
    ayMap.set(a, (ayMap.get(a) ?? 0) + kg);
  }

  const gunluk = [...gunMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tarih, kg]) => ({ tarih, kg: yuvarla(kg) }));

  const uretimGunu = gunluk.filter((g) => g.kg > 0).length;

  return {
    toplamKg: yuvarla(toplamKg),
    kayitSayisi: kayitlar.length,
    cevrilemeyenSayisi: cevrilemeyen(kayitlar).length,
    bugunKg: yuvarla(gunMap.get(bugun) ?? 0),
    buAyKg: yuvarla(ayMap.get(bugun.slice(0, 7)) ?? 0),
    gunlukOrtalamaKg: uretimGunu ? yuvarla(toplamKg / uretimGunu) : null,
    uretimGunuSayisi: uretimGunu,
    urunler: kir(kayitlar, (k) => k.urun_ad || k.urun_kod),
    gruplar: kir(kayitlar, (k) => k.urun_grup),
    ambalajlar: kir(kayitlar, (k) => k.ambalaj_tipi),
    tesisler: kir(kayitlar, (k) => k.tesis),
    hatlar: kir(kayitlar, (k) => k.hat),
    vardiyalar: kir(kayitlar, (k) => k.vardiya),
    gunluk,
    aylik: [...ayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ay, kg]) => ({ ay, kg: yuvarla(kg) })),
  };
}

/** kg'ı okunur yazar: 1234.5 → "1.234,5 kg" */
export function kgYaz(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " kg";
}

export function uretimCsv(kayitlar: UretimKaydi[]): string {
  const basliklar = [
    "Tarih", "Tesis", "Hat", "Vardiya", "Ürün Kodu", "Ürün Adı", "Ürün Grubu",
    "Ambalaj Tipi", "Miktar", "Ölçü Birimi", "Kg Karşılığı", "Parti No",
    "SKT", "Operatör", "Açıklama",
  ];
  const kacir = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return /[";\n]/.test(s) ? `"${s}"` : s;
  };
  const satirlar = kayitlar.map((k) =>
    [
      k.tarih, k.tesis, k.hat, k.vardiya, k.urun_kod, k.urun_ad, k.urun_grup,
      k.ambalaj_tipi, k.miktar, k.olcu_birimi, k.kg_karsiligi ?? "", k.parti_no,
      k.skt ?? "", k.operator, k.aciklama,
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
