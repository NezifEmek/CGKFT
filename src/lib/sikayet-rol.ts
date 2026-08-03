// sikayet-rol.ts — Şikayet modülünün rolleri.
//
// KONULAR2'deki yetkilendirme başlığı yedi rol istiyor: Admin, Çağrı
// Merkezi, Franchise, Bölge Müdürü, Operasyon, Kalite, Yönetim.
//
// Bunlar panelin GENEL rollerinden (admin / genel_mudur / bolge_muduru /
// denetmen) ayrı tutuluyor. Sebebi: genel rol satış, prim ve şube
// yetkilerini de belirliyor; şikayet için yeni bir genel rol eklemek o
// yetkileri de karıştırırdı. Kişinin şikayet rolü ayrı bir alanda duruyor,
// boşsa genel rolünden makul bir karşılık türetiliyor.
//
// İki eksen var:
//   kapsam  → hangi kayıtları GÖRÜR
//   yetki   → gördüğü kayda ne YAPABİLİR

export const SIKAYET_ROLLERI = [
  "admin",
  "yonetim",
  "cagri_merkezi",
  "kalite",
  "operasyon",
  "bolge",
  "franchise",
] as const;

export type SikayetRolu = (typeof SIKAYET_ROLLERI)[number];

export const ROL_ETIKET: Record<SikayetRolu, string> = {
  admin: "Admin",
  yonetim: "Yönetim",
  cagri_merkezi: "Çağrı Merkezi",
  kalite: "Kalite",
  operasyon: "Operasyon",
  bolge: "Bölge Müdürü",
  franchise: "Franchise",
};

export type Kapsam = "hepsi" | "sube" | "kendi";

export const KAPSAM_ACIKLAMA: Record<Kapsam, string> = {
  hepsi: "Bütün şikayetleri görür",
  sube: "Yetkili olduğu şubelerin şikayetlerini görür",
  kendi: "Yalnızca kendi açtığı ve kendisine atanan şikayetleri görür",
};

export interface RolYetkisi {
  kapsam: Kapsam;
  /** Yeni şikayet kaydı açabilir */
  kayitAcar: boolean;
  /** Başkasına görev atayabilir */
  atar: boolean;
  /** Durumu ilerletebilir (İnceleniyor, Müşteri Bekleniyor…) */
  durumDegistirir: boolean;
  /** Çözüldü / Kapatıldı / İptal yapabilir */
  kapatir: boolean;
  /** Kaydı tamamen silebilir */
  siler: boolean;
  /** Kök neden alanını doldurabilir */
  kokNedenYazar: boolean;
}

/**
 * Yetki tablosu.
 *
 * Bilerek dar tutuldu: bir rolün yapabildiği her şey burada tek bakışta
 * görünsün, ekranlarda dağınık koşullar birikmesin.
 */
export const ROL_YETKISI: Record<SikayetRolu, RolYetkisi> = {
  admin: {
    kapsam: "hepsi",
    kayitAcar: true, atar: true, durumDegistirir: true,
    kapatir: true, siler: true, kokNedenYazar: true,
  },
  yonetim: {
    kapsam: "hepsi",
    kayitAcar: true, atar: true, durumDegistirir: true,
    kapatir: true, siler: true, kokNedenYazar: true,
  },
  // Şikayeti karşılayan birim: kaydı açar, ilgiliye atar, müşteriyle
  // yazışır. Kapatma kararı onda değil — kapatan, işi çözen taraf olmalı.
  cagri_merkezi: {
    kapsam: "hepsi",
    kayitAcar: true, atar: true, durumDegistirir: true,
    kapatir: false, siler: false, kokNedenYazar: false,
  },
  // Kaliteyi ilgilendiren asıl iş kök neden ve kapatma.
  kalite: {
    kapsam: "hepsi",
    kayitAcar: true, atar: true, durumDegistirir: true,
    kapatir: true, siler: false, kokNedenYazar: true,
  },
  operasyon: {
    kapsam: "sube",
    kayitAcar: true, atar: false, durumDegistirir: true,
    kapatir: true, siler: false, kokNedenYazar: true,
  },
  bolge: {
    kapsam: "sube",
    kayitAcar: true, atar: true, durumDegistirir: true,
    kapatir: true, siler: false, kokNedenYazar: true,
  },
  // Franchise işletmecisi kendi şubesiyle ilgili kaydı görür ve yanıt
  // yazar; başkasına iş atayamaz, kaydı kapatamaz.
  franchise: {
    kapsam: "kendi",
    kayitAcar: true, atar: false, durumDegistirir: false,
    kapatir: false, siler: false, kokNedenYazar: false,
  },
};

/**
 * Şikayet rolü atanmamış kullanıcı için genel rolden makul karşılık.
 *
 * Böylece 0016 çalıştıktan sonra kimse yetkisiz kalmıyor; Nezif kişileri
 * tek tek ayarlayana kadar sistem bugünkü gibi çalışmaya devam ediyor.
 */
export function varsayilanRol(genelRol: string): SikayetRolu {
  switch (genelRol) {
    case "admin":
      return "admin";
    case "genel_mudur":
      return "yonetim";
    case "bolge_muduru":
      return "bolge";
    default:
      return "operasyon";
  }
}

export function rolCoz(sikayetRolu: string | null | undefined, genelRol: string): SikayetRolu {
  const r = (sikayetRolu ?? "").trim();
  return (SIKAYET_ROLLERI as readonly string[]).includes(r)
    ? (r as SikayetRolu)
    : varsayilanRol(genelRol);
}

export function yetkiCoz(sikayetRolu: string | null | undefined, genelRol: string): RolYetkisi {
  return ROL_YETKISI[rolCoz(sikayetRolu, genelRol)];
}

/** Kapatma sayılan durumlar — yetki kontrolü buradan. */
export const KAPATMA_DURUMLARI = ["cozuldu", "kapatildi", "iptal"] as const;

/**
 * Bu kişi şikayeti bu duruma taşıyabilir mi?
 *
 * `atanmisMi`: kişi bu şikayete GÖREVLİ olarak atanmış mı.
 *
 * Görevli olan kişi, rolü ne olursa olsun kaydı kapatabilir. Nezif'in
 * kararı: "şikayetler de birine atanmalı, o görev olarak görmeli ve
 * kapamalı."
 *
 * Önceki kurgu kapatmayı role bağlıyordu; çağrı merkezi ve franchise
 * kapatamıyordu. Mantığı şuydu: kaydı karşılayan kişi işi çözen taraf
 * olmayabilir. Ama bu, işi üstlenen kişiyi kendi görevini kapatamaz hâle
 * getiriyordu — görev mantığıyla çelişiyor. Atama artık bilinçli bir
 * eylem olduğu için (kimin üstlendiği belli), kapatma yetkisi de onunla
 * birlikte geliyor.
 *
 * Atanmamış kişiler için eski kural aynen duruyor.
 */
export function durumIcinYetkiVar(
  y: RolYetkisi,
  hedefDurum: string,
  atanmisMi = false,
): boolean {
  if ((KAPATMA_DURUMLARI as readonly string[]).includes(hedefDurum)) {
    return y.kapatir || atanmisMi;
  }
  return y.durumDegistirir || atanmisMi;
}
