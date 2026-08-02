// dosya.ts — Dosya ekleri ve sözleşme süresi hesapları.
//
// Kova ÖZEL. Dosyalar herkese açık bir adresle sunulmuyor; her indirme
// için kısa ömürlü imzalı bağlantı üretiliyor. Sözleşme ve şikayet eki
// kurumsal belge, bağlantısı elden ele dolaşmamalı.

export const KOVA = "belgeler";

/** 25 MB — kova tarafında da aynı sınır tanımlı. */
export const AZAMI_BOYUT = 25 * 1024 * 1024;

/**
 * İzin verilen türler. Çalıştırılabilir dosya kabul edilmiyor: panel
 * bir dosya deposu değil, belge eki alanı.
 */
export const IZINLI_MIME = [
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
] as const;

export const IZINLI_UZANTI = [
  "pdf", "jpg", "jpeg", "png", "webp", "heic", "gif",
  "doc", "docx", "xls", "xlsx", "txt", "csv",
] as const;

export interface Dosya {
  id: string;
  kapsam: string;
  kayit_id: string;
  yol: string;
  ad: string;
  boyut: number | null;
  mime: string;
  aciklama: string;
  yukleyen_id: string | null;
  created_at: string;
}

export function uzanti(dosyaAdi: string): string {
  const p = dosyaAdi.lastIndexOf(".");
  return p < 0 ? "" : dosyaAdi.slice(p + 1).toLocaleLowerCase("tr");
}

export function turIzinliMi(dosyaAdi: string, mime: string): boolean {
  const u = uzanti(dosyaAdi);
  return (
    (IZINLI_UZANTI as readonly string[]).includes(u) ||
    (IZINLI_MIME as readonly string[]).includes(mime)
  );
}

/**
 * Storage yolu üretir.
 *
 * Kullanıcının dosya adı YOLA KONMAZ; Türkçe karakter, boşluk ve
 * eğik çizgi Storage'da sorun çıkarır, ayrıca aynı adlı iki dosya
 * çakışır. Gerçek ad veritabanında `ad` sütununda saklanır ve indirme
 * sırasında geri verilir.
 */
export function yolUret(kapsam: string, kayitId: string, dosyaAdi: string): string {
  const u = uzanti(dosyaAdi);
  const damga = Date.now().toString(36);
  const rastgele = Math.random().toString(36).slice(2, 8);
  return `${kapsam}/${kayitId}/${damga}-${rastgele}${u ? "." + u : ""}`;
}

export function boyutYaz(bayt: number | null | undefined): string {
  if (bayt == null) return "";
  if (bayt < 1024) return `${bayt} B`;
  if (bayt < 1024 * 1024) return `${Math.round(bayt / 1024)} KB`;
  return `${(bayt / (1024 * 1024)).toFixed(1)} MB`;
}

export function simge(dosyaAdi: string, mime: string): string {
  const u = uzanti(dosyaAdi);
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(u)) return "🖼️";
  if (u === "pdf") return "📕";
  if (["doc", "docx"].includes(u)) return "📘";
  if (["xls", "xlsx", "csv"].includes(u)) return "📗";
  return "📄";
}

// ─── Sözleşme süresi ──────────────────────────────────────────────────────

export const SOZLESME_TURLERI = ["franchise", "kira", "marka", "diger"] as const;
export const TUR_ETIKET: Record<string, string> = {
  franchise: "Franchise Sözleşmesi",
  kira: "Kira Sözleşmesi",
  marka: "Marka / Lisans",
  diger: "Diğer",
};

export interface Sozlesme {
  id: string;
  sube_id: string;
  tur: string;
  sozlesme_no: string;
  baslangic: string | null;
  bitis: string | null;
  uyari_gun: number;
  taraf: string;
  notlar: string;
  created_at: string;
}

export type SozlesmeDurum = "gecerli" | "yaklasiyor" | "doldu" | "tarihsiz";

export const DURUM_ETIKET: Record<SozlesmeDurum, string> = {
  gecerli: "Geçerli",
  yaklasiyor: "Süresi yaklaşıyor",
  doldu: "Süresi doldu",
  tarihsiz: "Bitiş tarihi girilmemiş",
};

export const DURUM_RENK: Record<SozlesmeDurum, string> = {
  gecerli: "#16a34a",
  yaklasiyor: "#f59e0b",
  doldu: "#dc2626",
  tarihsiz: "#9ca3af",
};

/** Bitişe kaç gün kaldı? Negatif = geçmiş. Bitiş yoksa null. */
export function kalanGun(s: Pick<Sozlesme, "bitis">, bugun: string): number | null {
  if (!s.bitis) return null;
  const bit = Date.parse(s.bitis.slice(0, 10) + "T00:00:00Z");
  const bas = Date.parse(bugun.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(bit) || !Number.isFinite(bas)) return null;
  return Math.round((bit - bas) / 86400000);
}

export function sozlesmeDurumu(
  s: Pick<Sozlesme, "bitis" | "uyari_gun">,
  bugun: string,
): SozlesmeDurum {
  const kalan = kalanGun(s, bugun);
  if (kalan == null) return "tarihsiz";
  if (kalan < 0) return "doldu";
  // Bitiş günü dahil "geçerli" sayılır; o gün hâlâ yürürlükte.
  return kalan <= (s.uyari_gun ?? 90) ? "yaklasiyor" : "gecerli";
}

export interface SozlesmeOzet {
  toplam: number;
  gecerli: number;
  yaklasiyor: number;
  doldu: number;
  tarihsiz: number;
}

export function sozlesmeOzeti(liste: Sozlesme[], bugun: string): SozlesmeOzet {
  const o: SozlesmeOzet = { toplam: liste.length, gecerli: 0, yaklasiyor: 0, doldu: 0, tarihsiz: 0 };
  for (const s of liste) o[sozlesmeDurumu(s, bugun)]++;
  return o;
}

/** Dikkat isteyenler önce: süresi dolmuş, sonra yaklaşan, sonra kalanı. */
export function dikkatSirasi(liste: Sozlesme[], bugun: string): Sozlesme[] {
  const agirlik: Record<SozlesmeDurum, number> = {
    doldu: 0, yaklasiyor: 1, tarihsiz: 2, gecerli: 3,
  };
  return [...liste].sort((a, b) => {
    const fark = agirlik[sozlesmeDurumu(a, bugun)] - agirlik[sozlesmeDurumu(b, bugun)];
    if (fark) return fark;
    return (a.bitis ?? "9999").localeCompare(b.bitis ?? "9999");
  });
}
