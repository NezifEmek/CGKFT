// Eski panelin assets/js/ui/denetim.js dosyasındaki denetim formu yapısı.
// 6 kategori · 40 soru · her soru 1–3 puan → ham 120 puan, /100'e normalize edilir.
// Soru seti eskiden JS içine gömülüydü; burada tek bir yerde toplandı ki
// hem form hem geçmiş ekranı aynı tanımı kullansın.

export interface DenetimSorusu {
  id: string;
  metin: string;
}

export interface DenetimKategorisi {
  id: string;
  ad: string;
  ikon: string;
  /** Kategorinin alabileceği en yüksek puan (soru sayısı × 3). */
  max: number;
  sorular: DenetimSorusu[];
}

export const KATEGORILER: DenetimKategorisi[] = [
  {
    id: "yer",
    ad: "Yer ve Lokasyon",
    ikon: "📍",
    max: 21,
    sorular: [
      { id: "y1", metin: "Lokasyon yaya trafiği açısından yeterli mi?" },
      { id: "y2", metin: "Araç trafiği ve park imkânı yeterli mi?" },
      { id: "y3", metin: "Görünürlük: Tabela uzaktan okunabiliyor mu?" },
      { id: "y4", metin: "Vitrinin genel görünümü davetkar mı?" },
      { id: "y5", metin: "Çevredeki rakip işletmelerle kıyasla konumlanma avantajlı mı?" },
      { id: "y6", metin: "Lokasyonun potansiyeli uygun mu? (Hedef kitle, yoğun saatler)" },
      { id: "y7", metin: "Şubenin fiziksel büyüklüğü operasyon için uygun mu?" },
    ],
  },
  {
    id: "urun",
    ad: "Ürün",
    ikon: "🌯",
    max: 27,
    sorular: [
      { id: "u1", metin: "Çiğköfte oranı ve gramajı standartlara uygun mu?" },
      { id: "u2", metin: "Ürün tazeliği (renk, kıvam, aroma) yeterli mi?" },
      { id: "u3", metin: "Depolama ve muhafaza koşulları uygun mu? (Sıcaklık, hijyen)" },
      { id: "u4", metin: "Lavaş kalitesi uygun mu? (Taze, yumuşak, standardize)" },
      { id: "u5", metin: "Soslar eksiksiz, düzenli ve sunuma hazır mı?" },
      { id: "u6", metin: "Yeşillikler taze ve standart görünümde mi?" },
      { id: "u7", metin: "Ürün sunumu görsel olarak markaya yakışır nitelikte mi?" },
      { id: "u8", metin: "Yan ürünler (içecek, atıştırmalık vb.) mevcut ve yeterli mi?" },
      { id: "u9", metin: "Menü çeşitliliği talebi karşılayacak düzeyde mi?" },
    ],
  },
  {
    id: "tanitim",
    ad: "Tanıtım & Pazarlama",
    ikon: "📢",
    max: 18,
    sorular: [
      { id: "t1", metin: "Sosyal medya hesabı aktif ve düzenli olarak kullanılıyor mu?" },
      { id: "t2", metin: "Paylaşımlar marka kimliğine uygun ve kaliteli mi?" },
      { id: "t3", metin: "Google / yemek sipariş platformu yorumlarına yanıt veriliyor mu?" },
      { id: "t4", metin: "Broşür, magnet veya yerel tanıtım çalışmaları yapılıyor mu?" },
      { id: "t5", metin: "Cam giydirme / totem / bayrak kullanımı mevcut ve sağlam mı?" },
      { id: "t6", metin: "Güncel kampanyalar/indirimler uygulanıyor ve duyuruluyor mu?" },
    ],
  },
  {
    id: "insan",
    ad: "İnsan & Hizmet",
    ikon: "👥",
    max: 21,
    sorular: [
      { id: "i1", metin: "Personel sayısı yoğunluğu karşılayacak yeterlilikte mi?" },
      { id: "i2", metin: "İşletme sahibi / sorumlu kişi aktif ve sahada mı?" },
      { id: "i3", metin: "Personel hijyen kurallarına uyuyor mu? (Eldiven, kıyafet, başlık)" },
      { id: "i4", metin: "Kişisel görünüm marka standardına uygun mu?" },
      { id: "i5", metin: "Müşteriyle iletişim nazik ve profesyonel mi?" },
      { id: "i6", metin: "Güler yüzlü ve proaktif hizmet anlayışı mevcut mu?" },
      { id: "i7", metin: "Müşteri şikâyetlerine yerinde ve hızlı müdahale ediliyor mu?" },
    ],
  },
  {
    id: "fiziksel",
    ad: "Fiziksel Ortam",
    ikon: "🏪",
    max: 18,
    sorular: [
      { id: "f1", metin: "İç mekân temizliği (tezgâh, zemin, duvarlar) yeterli mi?" },
      { id: "f2", metin: "Aydınlatma yeterli ve ambiyans markaya uygun mu?" },
      { id: "f3", metin: "Müşteri bekleme / oturma alanı düzenli ve temiz mi?" },
      { id: "f4", metin: "Kasa ve ödeme noktası düzenli mi?" },
      { id: "f5", metin: "Tabela, menü görselleri ve kurumsal tasarım unsurları tutarlı mı?" },
      { id: "f6", metin: "Genel hijyen sertifikası / izinler görünür yerde asılı mı?" },
    ],
  },
  {
    id: "fiyat",
    ad: "Fiyat & Çalışma Düzeni",
    ikon: "💵",
    max: 15,
    sorular: [
      { id: "p1", metin: "Merkez tarafından belirlenen fiyat politikasına uyuluyor mu?" },
      { id: "p2", metin: "Fiyat tabelası güncel, okunaklı ve doğru mu?" },
      { id: "p3", metin: "Açılış ve kapanış saatleri standartlara uygun mu?" },
      { id: "p4", metin: "İşletme belirtilen tüm günlerde faaliyette mi?" },
      { id: "p5", metin: "Teslimat / paket servisi standartlara uygun şekilde yürütülüyor mu?" },
    ],
  },
];

export const MAX_PUAN = 120;
export const TUM_SORULAR = KATEGORILER.flatMap((k) => k.sorular);
export const SORU_SAYISI = TUM_SORULAR.length;

export const CEVAP_ETIKETLERI: Record<number, string> = {
  1: "Yetersiz",
  2: "Kısmen",
  3: "Uygun",
};

export const DENETIM_TURLERI = ["Periyodik", "Sürpriz", "Şikayet Üzerine", "Diğer"] as const;

export interface DenetimGrubu {
  ad: string;
  min: number;
  etiket: string;
  renk: string;
}

export const GRUPLAR: DenetimGrubu[] = [
  { ad: "A", min: 86, etiket: "Mükemmel", renk: "#10b981" },
  { ad: "B", min: 71, etiket: "İyi", renk: "#22c55e" },
  { ad: "C", min: 56, etiket: "Orta", renk: "#f59e0b" },
  { ad: "D", min: 41, etiket: "Gelişim Gerekli", renk: "#f97316" },
  { ad: "E", min: 0, etiket: "Acil Aksiyon", renk: "#ef4444" },
];

export function grupBul(puan100: number): DenetimGrubu {
  return GRUPLAR.find((g) => puan100 >= g.min) ?? GRUPLAR[GRUPLAR.length - 1];
}

export interface SkorSonucu {
  toplam: number;
  puan100: number;
  bolumPuanlar: Record<string, number>;
  cevaplanmis: number;
}

/** Ham toplamı hesaplar ve 120 üzerinden 100'e normalize eder. */
export function skorHesapla(cevaplar: Record<string, number>): SkorSonucu {
  let toplam = 0;
  let cevaplanmis = 0;
  const bolumPuanlar: Record<string, number> = {};

  for (const kat of KATEGORILER) {
    let bp = 0;
    for (const s of kat.sorular) {
      const p = Number(cevaplar[s.id]) || 0;
      bp += p;
      if (p > 0) cevaplanmis++;
    }
    bolumPuanlar[kat.id] = bp;
    toplam += bp;
  }

  return {
    toplam,
    puan100: Math.round((toplam / MAX_PUAN) * 100),
    bolumPuanlar,
    cevaplanmis,
  };
}
