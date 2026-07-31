// franchise.ts — Franchise başvuru CRM'inin seçenek listeleri ve puanlaması.
//
// Hepsi "FRANCHISE BAŞVURULARI_v3.xlsx" dosyasının ⚙️ Ayarlar sayfasından
// birebir alındı. Puan ağırlıkları veritabanındaki
// public.franchise_kalite_puani() fonksiyonuyla aynı olmalı — kalite puanı
// orada üretilen bir sütun; buradaki kopya yalnızca formda anlık önizleme için.

export const DURUMLAR = [
  "Yeni Başvuru",
  "Arandı / Temas Kuruldu",
  "Görüşüldü / Takipte",
  "Lokasyon Aranıyor",
  "Sözleşme / Açılış",
  "Kaybedildi",
] as const;

/** Süreçte ilerleme sırası — huni görünümü ve renkler bu sırayı kullanır. */
export const DURUM_RENK: Record<string, string> = {
  "Yeni Başvuru": "#6b7280",
  "Arandı / Temas Kuruldu": "#2563eb",
  "Görüşüldü / Takipte": "#7c3aed",
  "Lokasyon Aranıyor": "#f59e0b",
  "Sözleşme / Açılış": "#16a34a",
  Kaybedildi: "#dc2626",
};

export const KANALLAR = [
  "Instagram",
  "Google",
  "Fuar",
  "Santral",
  "TV / Reklam",
  "Referans",
  "Whatsapp Hattı",
  "Web Sitesi",
  "Diğer",
] as const;

export const KAYIP_NEDENLERI = [
  "-",
  "Ulaşılamadı",
  "Vazgeçti / Olumsuz",
  "Sermaye Yetersiz",
  "Rakibe Geçti",
] as const;

export const MEMNUNIYET = [
  "Çok Memnun",
  "Memnun",
  "Memnun Değil",
  "Aranmamış",
  "Ulaşılamadı",
] as const;

/** Puanlanan dört alan. Her birinin en yükseği 25, toplamı 100. */
export const PUANLI_ALANLAR = [
  {
    key: "dukkan",
    etiket: "Dükkan Durumu",
    secenekler: [
      { deger: "Dükkan Var", puan: 25 },
      { deger: "Bizden Talep Ediyor", puan: 15 },
      { deger: "Dükkan Araştıracak", puan: 10 },
      { deger: "Dükkan Yok", puan: 0 },
    ],
  },
  {
    key: "sermaye",
    etiket: "Sermaye / Bütçe",
    secenekler: [
      { deger: "Yatırım Bütçesi Hazır", puan: 25 },
      { deger: "Bütçesi Hazır Değil, Mülk Satacak", puan: 15 },
      { deger: "Bütçesi Hazır Değil, Kredi Bekliyor", puan: 10 },
      { deger: "Bütçesi Yok, Taksit Soruyor", puan: 5 },
      { deger: "Bütçesi Yok, İndirim Soruyor", puan: 0 },
    ],
  },
  {
    key: "niyet_istek",
    etiket: "Niyet / İstek",
    secenekler: [
      { deger: "İletişimi Çok Güçlü, Detaylı Araştırma Yapmış", puan: 25 },
      { deger: "İstekli Ama Bilgi Eksikliği Var", puan: 15 },
      { deger: "Sadece Fiyat Sormak İçin Aramış", puan: 0 },
    ],
  },
  {
    key: "isi_yonetme",
    etiket: "İşi Yönetme",
    secenekler: [
      { deger: "Kendisi İşletecek", puan: 25 },
      { deger: "Ailesinden Biri İşletecek", puan: 20 },
      { deger: "Ortağıyla Birlikte İşletecek", puan: 15 },
      { deger: "Personel Çalıştıracak", puan: 10 },
    ],
  },
] as const;

export interface FranchiseBasvuru {
  id: string;
  basvuru_no: string | null;
  tarih: string;
  isim: string;
  telefon: string;
  il: string;
  ilce: string;
  ilave_iller: string;
  ilave_ilceler: string;
  kanal: string;
  dukkan: string;
  sermaye: string;
  niyet_istek: string;
  isi_yonetme: string;
  sirket_sorumlusu: string;
  son_durum: string;
  sorumlu_arama_tarihi: string | null;
  kaybetme_nedeni: string;
  gorusme_notu: string;
  memnuniyet_arama_tarihi: string | null;
  memnuniyet_neticesi: string;
  memnuniyet_notu: string;
  kalite_puani: number;
  created_at?: string;
  updated_at?: string;
}

/** Formda anlık önizleme için; kaydedilen değer veritabanında üretilir. */
export function kalitePuani(v: {
  dukkan?: string;
  sermaye?: string;
  niyet_istek?: string;
  isi_yonetme?: string;
}): number {
  let t = 0;
  for (const alan of PUANLI_ALANLAR) {
    const secili = (v as Record<string, string | undefined>)[alan.key];
    const s = alan.secenekler.find((x) => x.deger === secili);
    t += s?.puan ?? 0;
  }
  return t;
}

export function kaliteRengi(p: number): string {
  return p >= 75 ? "#16a34a" : p >= 50 ? "#f59e0b" : p > 0 ? "#dc2626" : "#9ca3af";
}
