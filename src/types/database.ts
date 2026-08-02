// Elle yazılmış tipler — supabase/migrations/0001_init.sql şemasıyla eşleşir.
// Şema değişirse burayı da güncelleyin (Faz 1'de `supabase gen types` kullanılmıyor).

export type Rol = "admin" | "genel_mudur" | "bolge_muduru" | "denetmen";
export type SubeTipi = "MS" | "FR";
export type FiyatGrubu = "dagitim" | "lojistik";

export type KapsamTuru = "rol" | "tum" | "bolge" | "tip" | "secili" | "yetkili";

export interface Profile {
  id: string;
  ad_soyad: string;
  rol: Rol;
  bolge: string | null;
  created_at: string;
  /** 0004 migration'ından önce oluşmuş kayıtlarda bulunmayabilir. */
  kapsam_turu?: KapsamTuru;
  kapsam_tipi?: SubeTipi | null;
  kapsam_yetkilisi?: string | null;
  /** Şikayet modülü rolü. NULL ise genel rolden türetilir (bkz. @/lib/sikayet-rol). */
  sikayet_rolu?: string | null;
  /** dokuman_ayarlari.pozisyonlar içindeki pozisyon id'si — kişisel görünürlüğü belirler. */
  pozisyon_id?: string | null;
  yazabilir?: boolean;
  sayfa_yetkileri?: string[];
}

export interface Sube {
  id: string;
  eski_id: string | null;
  bolge: string;
  tip: SubeTipi;
  ad: string;
  il: string;
  ilce: string;
  kod: string;
  merkez_yetkilisi: string;
  sube_yetkilisi: string;
  il_sube_sirasi: string;
  aktif: boolean;
  acilis_tarihi: string | null;
  kapanis_tarihi: string | null;
  acilis_tahmini: boolean;
  fiyat_grubu: FiyatGrubu | null;
  telefon: string;
  yetkili_telefon: string;
  eposta: string;
  adres: string;
  harita_url: string;
  enlem: number | null;
  boylam: number | null;
  iletisim_notu: string;
  created_at: string;
  updated_at: string;
}

/** Şube sorumlusunun zaman içindeki değişimi. Dönem [baslangic, bitis). */
export interface SubeSorumluGecmisi {
  id: string;
  sube_id: string;
  /** 'merkez' = Adıyaman Çiğköfte tarafı, 'sube' = şube tarafındaki işletmeci */
  taraf: "merkez" | "sube";
  kisi_adi: string;
  baslangic: string | null;
  bitis: string | null;
  aciklama: string;
  otomatik: boolean;
  kaydeden_id: string | null;
  created_at: string;
}

export interface Ay {
  yil: number;
  ay: string;
  gun_sayisi: number;
}

export interface AylikSatis {
  id: string;
  sube_id: string;
  yil: number;
  ay: string;
  kg: number;
  guncelleyen_id: string | null;
  updated_at: string;
}

export interface Denetim {
  id: string;
  sube_id: string;
  denetmen_id: string;
  tarih: string;
  puan: number | null;
  notlar: string;
  detay: Record<string, unknown>;
  created_at: string;
}

export interface Skor {
  id: string;
  sube_id: string;
  olusturan_id: string;
  tarih: string;
  puan: number | null;
  detay: Record<string, unknown>;
  created_at: string;
}

export interface FiyatModeli {
  id: number;
  para_birimi: string;
  /** Anahtarlar: "MS" | "FR_dagitim" | "FR_lojistik" — TL/kg satış fiyatı. */
  satis_fiyati: Record<string, number>;
  birim_maliyet_varsayilan: number;
  /** Ay adına göre birim maliyet override'ı; yoksa varsayılan kullanılır. */
  birim_maliyet_aylik: Record<string, number>;
  sabit_gider_aylik: number;
}

export const AYLAR_12 = [
  "OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN",
  "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK",
] as const;

export const ROL_ETIKET: Record<Rol, string> = {
  admin: "Admin",
  genel_mudur: "Genel Müdür",
  bolge_muduru: "Bölge Müdürü",
  denetmen: "Denetmen",
};
