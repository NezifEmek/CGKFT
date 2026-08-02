// sikayet.ts — Şikayet yönetimi: seçenek listeleri ve KPI hesapları.
//
// Listeler tek yerde: ekran, dışa aktarma ve doğrulama aynı kaynaktan
// beslensin. Yeni bir kanal/kategori eklemek için tek satır yeter.

export const KANALLAR = [
  "Telefon", "E-posta", "Web", "WhatsApp", "Sosyal Medya", "Yüz Yüze", "Diğer",
] as const;

export const BASVURAN_TURLERI = [
  "Müşteri", "Tüketici", "Franchise", "Tedarikçi", "Personel", "Diğer",
] as const;

export const KATEGORILER = [
  "Ürün Kalitesi",
  "Hijyen / Temizlik",
  "Personel Davranışı",
  "Servis Süresi",
  "Fiyat",
  "Sipariş / Teslimat",
  "Ambalaj",
  "Yabancı Madde",
  "Şube İşleyişi",
  "Franchise Süreci",
  "Diğer",
] as const;

export const DURUMLAR = [
  "yeni", "inceleniyor", "atandi", "musteri_bekleniyor",
  "cozuldu", "kapatildi", "iptal",
] as const;
export type Durum = (typeof DURUMLAR)[number];

export const DURUM_ETIKET: Record<string, string> = {
  yeni: "Yeni",
  inceleniyor: "İnceleniyor",
  atandi: "İlgili Birime Atandı",
  musteri_bekleniyor: "Müşteri Bekleniyor",
  cozuldu: "Çözüldü",
  kapatildi: "Kapatıldı",
  iptal: "İptal Edildi",
};

export const DURUM_RENK: Record<string, string> = {
  yeni: "#6b7280",
  inceleniyor: "#2563eb",
  atandi: "#7c3aed",
  musteri_bekleniyor: "#f59e0b",
  cozuldu: "#16a34a",
  kapatildi: "#0f766e",
  iptal: "#dc2626",
};

/** Kapanmış sayılan durumlar — açık/kapalı ayrımı her yerde buradan. */
export const KAPALI_DURUMLAR: readonly string[] = ["cozuldu", "kapatildi", "iptal"];

export const ONCELIKLER = ["dusuk", "orta", "yuksek", "kritik"] as const;
export const ONCELIK_ETIKET: Record<string, string> = {
  dusuk: "Düşük", orta: "Orta", yuksek: "Yüksek", kritik: "Kritik",
};
export const ONCELIK_RENK: Record<string, string> = {
  dusuk: "#9ca3af", orta: "#2563eb", yuksek: "#f59e0b", kritik: "#dc2626",
};

export const DEPARTMANLAR = [
  "Çağrı Merkezi", "Operasyon", "Kalite", "Üretim", "Lojistik",
  "Muhasebe", "İnsan Kaynakları", "Franchise", "Yönetim",
] as const;

export const HAREKET_TURLERI = [
  "gorusme", "telefon", "eposta", "ic_not", "musteri_yaniti",
] as const;
export const HAREKET_ETIKET: Record<string, string> = {
  durum: "Durum değişikliği",
  gorusme: "Görüşme",
  telefon: "Telefon notu",
  eposta: "E-posta",
  ic_not: "İç yazışma",
  atama: "Atama",
  musteri_yaniti: "Müşteri yanıtı",
};
export const HAREKET_SIMGE: Record<string, string> = {
  durum: "🔄", gorusme: "💬", telefon: "📞", eposta: "✉️",
  ic_not: "📝", atama: "👤", musteri_yaniti: "🗣️",
};

export interface Sikayet {
  id: string;
  sikayet_no: string;
  basvuru_tarihi: string;
  kanal: string;
  basvuran_turu: string;
  ad_soyad: string;
  firma: string;
  telefon: string;
  eposta: string;
  sube_id: string | null;
  urun: string;
  kategori: string;
  aciklama: string;
  oncelik: string;
  durum: string;
  departman: string;
  son_cozum_tarihi: string | null;
  cozum_notu: string;
  kok_neden: string;
  cozuldu_at: string | null;
  kapatildi_at: string | null;
  olusturan_id: string | null;
  created_at: string;
}

export function acikMi(s: { durum: string }): boolean {
  return !KAPALI_DURUMLAR.includes(s.durum);
}

/** SLA aşımı: hedef tarih geçmiş ve kayıt hâlâ açık. */
export function gecikmisMi(s: Sikayet, bugun: string): boolean {
  return acikMi(s) && !!s.son_cozum_tarihi && s.son_cozum_tarihi.slice(0, 10) < bugun;
}

/**
 * Çözüm süresi (gün). Çözülmemişse null.
 *
 * İptal edilen kayıt çözülmüş sayılmaz — iptali "1 günde çözdük" diye
 * ortalamaya katmak performansı olduğundan iyi gösterir.
 *
 * Gün farkı AŞAĞI yuvarlanır: başvuru tarihi gece yarısı olduğu için
 * floor, takvim günü farkına eşittir. Yuvarlama yapılsaydı aynı gün
 * öğleden sonra çözülen kayıt "1 gün" görünürdü.
 */
export function cozumSuresi(s: Sikayet): number | null {
  if (s.durum === "iptal") return null;
  if (!s.cozuldu_at && !s.kapatildi_at) return null;
  const bit = new Date(s.cozuldu_at ?? s.kapatildi_at!).getTime();
  const bas = new Date(s.basvuru_tarihi + "T00:00:00Z").getTime();
  if (!Number.isFinite(bit) || !Number.isFinite(bas)) return null;
  return Math.max(0, Math.floor((bit - bas) / 86400000));
}

export interface SikayetOzet {
  toplam: number;
  acik: number;
  kapali: number;
  geciken: number;
  kritik: number;
  ortalamaCozumGun: number | null;
  slaBasari: number | null; // hedefinde çözülenlerin oranı (%)
  durumSayim: Map<string, number>;
  kategoriSayim: Map<string, number>;
  kanalSayim: Map<string, number>;
  departmanSayim: Map<string, number>;
  subeSayim: Map<string, number>;
  urunSayim: Map<string, number>;
  aylikTrend: { ay: string; acilan: number; kapanan: number }[];
}

export function sikayetOzeti(kayitlar: Sikayet[], bugun: string): SikayetOzet {
  const say = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  const durumSayim = new Map<string, number>();
  const kategoriSayim = new Map<string, number>();
  const kanalSayim = new Map<string, number>();
  const departmanSayim = new Map<string, number>();
  const subeSayim = new Map<string, number>();
  const urunSayim = new Map<string, number>();
  const aylik = new Map<string, { acilan: number; kapanan: number }>();

  let acik = 0, geciken = 0, kritik = 0;
  const sureler: number[] = [];
  let slaKapsam = 0, slaTutan = 0;

  for (const s of kayitlar) {
    say(durumSayim, s.durum);
    say(kategoriSayim, s.kategori || "Diğer");
    say(kanalSayim, s.kanal || "Diğer");
    if (s.departman) say(departmanSayim, s.departman);
    if (s.sube_id) say(subeSayim, s.sube_id);
    if (s.urun) say(urunSayim, s.urun);

    if (acikMi(s)) acik++;
    if (gecikmisMi(s, bugun)) geciken++;
    if (s.oncelik === "kritik" && acikMi(s)) kritik++;

    const sure = cozumSuresi(s);
    if (sure != null) sureler.push(sure);

    // SLA başarısı: hedefi olan ve GERÇEKTEN çözülmüş kayıtlar üzerinden.
    // İptaller hariç — iptal ne başarı ne başarısızlıktır.
    if (s.son_cozum_tarihi && !acikMi(s) && s.durum !== "iptal") {
      slaKapsam++;
      const bitis = (s.cozuldu_at ?? s.kapatildi_at ?? "").slice(0, 10);
      if (bitis && bitis <= s.son_cozum_tarihi.slice(0, 10)) slaTutan++;
    }

    const ayA = s.basvuru_tarihi.slice(0, 7);
    if (!aylik.has(ayA)) aylik.set(ayA, { acilan: 0, kapanan: 0 });
    aylik.get(ayA)!.acilan++;

    const kapanis = (s.kapatildi_at ?? s.cozuldu_at ?? "").slice(0, 7);
    if (kapanis) {
      if (!aylik.has(kapanis)) aylik.set(kapanis, { acilan: 0, kapanan: 0 });
      aylik.get(kapanis)!.kapanan++;
    }
  }

  return {
    toplam: kayitlar.length,
    acik,
    kapali: kayitlar.length - acik,
    geciken,
    kritik,
    ortalamaCozumGun: sureler.length
      ? Math.round((sureler.reduce((a, b) => a + b, 0) / sureler.length) * 10) / 10
      : null,
    slaBasari: slaKapsam ? Math.round((slaTutan / slaKapsam) * 100) : null,
    durumSayim,
    kategoriSayim,
    kanalSayim,
    departmanSayim,
    subeSayim,
    urunSayim,
    aylikTrend: [...aylik.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ay, v]) => ({ ay, ...v })),
  };
}

/** Aynı şube + aynı kategoride birden fazla kayıt — tekrarlayan şikayet analizi. */
export function tekrarlayanlar(
  kayitlar: Sikayet[],
  subeAdlari: Map<string, string>,
): { etiket: string; kategori: string; adet: number }[] {
  const m = new Map<string, number>();
  for (const s of kayitlar) {
    if (!s.sube_id) continue;
    const anahtar = `${s.sube_id}|${s.kategori}`;
    m.set(anahtar, (m.get(anahtar) ?? 0) + 1);
  }
  return [...m.entries()]
    .filter(([, adet]) => adet > 1)
    .map(([k, adet]) => {
      const [subeId, kategori] = k.split("|");
      return { etiket: subeAdlari.get(subeId) ?? "(bilinmeyen şube)", kategori, adet };
    })
    .sort((a, b) => b.adet - a.adet);
}

/** Excel'de açılabilen CSV. Türkçe karakterler için BOM şart. */
export function sikayetCsv(kayitlar: Sikayet[], subeAdlari: Map<string, string>): string {
  const basliklar = [
    "Şikayet No", "Başvuru Tarihi", "Kanal", "Başvuran Türü", "Ad Soyad", "Firma",
    "Telefon", "E-posta", "Şube", "Ürün", "Kategori", "Öncelik", "Durum",
    "Departman", "Son Çözüm Tarihi", "Çözüm Süresi (gün)", "Açıklama",
    "Çözüm Notu", "Kök Neden",
  ];
  const kacir = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return /[";\n]/.test(s) ? `"${s}"` : s;
  };
  const satirlar = kayitlar.map((s) =>
    [
      s.sikayet_no, s.basvuru_tarihi, s.kanal, s.basvuran_turu, s.ad_soyad, s.firma,
      s.telefon, s.eposta, s.sube_id ? (subeAdlari.get(s.sube_id) ?? "") : "",
      s.urun, s.kategori, ONCELIK_ETIKET[s.oncelik] ?? s.oncelik,
      DURUM_ETIKET[s.durum] ?? s.durum, s.departman, s.son_cozum_tarihi ?? "",
      cozumSuresi(s) ?? "", s.aciklama, s.cozum_notu, s.kok_neden,
    ].map(kacir).join(";"),
  );
  // Excel Türkçe yerelde ayırıcı olarak ; bekler; BOM olmadan İ/Ş bozulur.
  return "﻿" + [basliklar.join(";"), ...satirlar].join("\r\n");
}
