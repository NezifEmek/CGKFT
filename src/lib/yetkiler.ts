// yetkiler.ts — Ekran (sayfa) yetkileri ve şube kapsamı.
//
// İki ayrı soru var:
//   1) Kullanıcı HANGİ EKRANLARI görür?  → sayfa_yetkileri (bu dosya)
//   2) Kullanıcı HANGİ ŞUBELERİ görür?   → kapsam_turu/kapsam_tipi (RLS, 0004)
//
// sayfa_yetkileri boş bırakılırsa rolün varsayılanı geçerli olur; böylece
// hiç yetki tanımlanmamış kullanıcılar bugünkü davranışı korur.

import type { Rol } from "@/types/database";

export interface SayfaTanimi {
  anahtar: string;
  href: string;
  etiket: string;
  bolum: string;
}

/** Menüdeki tüm ekranlar. Sıra menüde göründüğü sıradır. */
export const SAYFALAR: SayfaTanimi[] = [
  { anahtar: "genel", href: "/", etiket: "📊 Genel Bakış", bolum: "Genel" },
  { anahtar: "subeler", href: "/subeler", etiket: "🏪 Şubeler", bolum: "Genel" },
  { anahtar: "sube-yonetimi", href: "/sube-yonetimi", etiket: "⚙️ Şube Yönetimi", bolum: "Genel" },

  { anahtar: "top30", href: "/top30", etiket: "🏆 Top 30 Şube", bolum: "Analiz" },
  { anahtar: "yoy", href: "/yoy-karsilastirma", etiket: "📈 2026 vs 2025", bolum: "Analiz" },
  { anahtar: "aylik-degisim", href: "/aylik-degisim", etiket: "🔀 Aylık Değişim Analizi", bolum: "Analiz" },
  { anahtar: "kpi", href: "/kpi-takibi", etiket: "🎯 KPI Takibi", bolum: "Analiz" },
  { anahtar: "yetkili-analizi", href: "/yetkili-analizi", etiket: "🧑‍💼 Yetkili Analizi", bolum: "Analiz" },
  { anahtar: "segmentasyon", href: "/segmentasyon", etiket: "⭐ Segmentasyon", bolum: "Analiz" },
  { anahtar: "segment-takibi", href: "/segment-takibi", etiket: "🧭 Segment Takibi", bolum: "Analiz" },
  { anahtar: "dusus", href: "/dusus-uyarilari", etiket: "🚨 Düşüş Uyarıları", bolum: "Analiz" },
  { anahtar: "bolge-analizi", href: "/bolge-analizi", etiket: "🗺️ Bölge Analizi", bolum: "Analiz" },

  { anahtar: "sube-denetimi", href: "/sube-denetimi", etiket: "📋 Şube Denetimi", bolum: "Denetim" },
  { anahtar: "hizli-skor", href: "/hizli-skor", etiket: "⚡ Hızlı Skor Girişi", bolum: "Denetim" },

  { anahtar: "aylar-veri", href: "/aylar-veri", etiket: "🗓️ Aylar & Veri", bolum: "Veri" },
  { anahtar: "ice-disa-aktar", href: "/ice-disa-aktar", etiket: "📥 İçe / Dışa Aktar", bolum: "Veri" },

  { anahtar: "ciro-karlilik", href: "/ciro-karlilik", etiket: "💰 Ciro & Kârlılık", bolum: "Finans" },
  { anahtar: "merkez-gg", href: "/merkez-gelir-gider", etiket: "💹 Merkez Şube Gelir-Gider", bolum: "Finans" },
  { anahtar: "prim-hakedis", href: "/prim-hakedis", etiket: "💵 Prim Hakediş", bolum: "Finans" },
  { anahtar: "prim-projeksiyon", href: "/prim-projeksiyon", etiket: "📉 Prim Projeksiyonu", bolum: "Finans" },

  { anahtar: "toplantilar", href: "/toplantilar", etiket: "🗓️ Toplantı Yönetimi", bolum: "Kurumsal" },
  { anahtar: "franchise-basvuru", href: "/franchise-basvurulari", etiket: "📨 Franchise Başvuruları", bolum: "Kurumsal" },
  { anahtar: "dokuman", href: "/dokuman", etiket: "📄 Doküman Yönetimi", bolum: "Kurumsal" },
  { anahtar: "organizasyon", href: "/organizasyon", etiket: "🏛️ Organizasyon Şeması", bolum: "Kurumsal" },
  { anahtar: "oneriler", href: "/oneriler", etiket: "💡 Öneriler", bolum: "Kurumsal" },
  { anahtar: "trello", href: "/trello", etiket: "🗂️ Trello", bolum: "Kurumsal" },

  { anahtar: "kullanicilar", href: "/kullanicilar", etiket: "👥 Kullanıcılar", bolum: "Yönetim" },
];

const TUM_ANAHTARLAR = SAYFALAR.map((s) => s.anahtar);

/** Yetki tanımlanmamış kullanıcılar için rol varsayılanları (bugünkü davranış). */
export const ROL_VARSAYILAN: Record<Rol, string[]> = {
  admin: TUM_ANAHTARLAR,
  genel_mudur: TUM_ANAHTARLAR.filter((a) => a !== "kullanicilar"),
  bolge_muduru: TUM_ANAHTARLAR.filter((a) => a !== "kullanicilar"),
  denetmen: TUM_ANAHTARLAR.filter(
    (a) =>
      ![
        "kullanicilar",
        "sube-yonetimi",
        "merkez-gg",
        "prim-hakedis",
        "prim-projeksiyon",
      ].includes(a),
  ),
};

/**
 * Kullanıcının görebileceği sayfa anahtarları.
 * sayfa_yetkileri boşsa rol varsayılanı; doluysa yalnızca oradakiler.
 * Kullanıcılar ekranı her hâlükârda yalnızca admin'e açık kalır.
 */
export function gorunurSayfalar(rol: Rol, sayfaYetkileri: unknown): Set<string> {
  const secili = Array.isArray(sayfaYetkileri)
    ? (sayfaYetkileri as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const temel = secili.length ? secili : ROL_VARSAYILAN[rol];
  const sonuc = new Set(temel.filter((a) => TUM_ANAHTARLAR.includes(a)));

  // Güvenlik ağı: kullanıcı yönetimi admin dışına açılamaz.
  if (rol !== "admin") sonuc.delete("kullanicilar");
  // Herkes en azından Genel Bakış'ı görsün, yoksa giriş sonrası boş ekran kalır.
  sonuc.add("genel");
  return sonuc;
}

export const KAPSAM_ETIKET: Record<string, string> = {
  rol: "Rolün varsayılanı",
  yetkili: "Sorumlusu olduğu şubeler",
  tum: "Bütün şubeler",
  bolge: "Yalnızca kendi bölgesi",
  tip: "Şube tipine göre",
  secili: "Tek tek seçilen şubeler",
};

export const KAPSAM_ACIKLAMA: Record<string, string> = {
  rol: "Bugüne kadarki davranış: admin ve genel müdür her şubeyi, bölge müdürü kendi bölgesini, denetmen kendisine atanan şubeleri görür.",
  yetkili:
    "Şube listesinde “Merkez Yetkilisi” alanı bu kişi olan şubeleri görür. Şube sorumlusu değiştikçe kapsam kendiliğinden güncellenir — tek tek işaretlemeye gerek yok.",
  tum: "Rolünden bağımsız olarak bütün şubeleri görür.",
  bolge: "Profilindeki bölgeye ait şubeleri görür.",
  tip: "Yalnızca seçilen tipteki şubeleri görür.",
  secili: "Aşağıda tek tek işaretlenen şubeleri görür — kapsamı sabit kalır.",
};
