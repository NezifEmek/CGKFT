// kadro.ts — Personel kadrosu, pozisyon atamaları ve tutarlılık uyarıları.
//
// Amaç: adlar tek yerde dursun ve kadro değiştikçe geçmiş bozulmasın.
// Önceden adlar hem görev tanımlarında (pozisyonlar[].adSoyad) hem prim
// ayarlarında ayrı ayrı yazılıydı; ikisi zamanla ayrıştı ve prim her
// açılışta GÜNCEL listeden hesaplandığı için biri ayrılınca geçmiş ayların
// primi de yeni kişiye yazılıyordu.
//
// Artık: kadro (personeller) + tarihli atamalar (pozisyon_atamalari).
// Prim, seçilen AYDA görevde olanlardan hesaplanır.

export const PRIM_GRUPLARI = [
  "yok",
  "uretim",
  "merkez",
  "merkez_sorumlu",
  "bolge1",
  "bolge2",
] as const;
export type PrimGrubu = (typeof PRIM_GRUPLARI)[number];

export const PRIM_GRUP_ETIKET: Record<PrimGrubu, string> = {
  yok: "Prime girmiyor",
  uretim: "Üretim havuzu",
  merkez: "Merkez / İdari havuzu",
  merkez_sorumlu: "Merkez Şubeler Sorumlusu",
  bolge1: "Bölge 1 Sorumlusu",
  bolge2: "Bölge 2 Sorumlusu",
};

export interface Personel {
  id: string;
  ad_soyad: string;
  telefon: string;
  eposta: string;
  ise_giris: string | null;
  ayrilis: string | null;
  profil_id: string | null;
  notlar: string;
}

export interface Atama {
  id: string;
  pozisyon_id: string;
  personel_id: string;
  baslangic: string | null;
  bitis: string | null;
  prim_grubu: string;
  aciklama: string;
}

/** Görev tanımının kadro açısından ilgilendiren kısmı. */
export interface PozisyonKisa {
  id: string;
  unvan: string;
  adSoyad: string;
  /** Görev tanımı metinleri dolu mu? Boşsa "yazılmalı" uyarısı üretir. */
  doluMu: boolean;
}

/**
 * Ay "2026-08" biçiminde. Kişi o ayın primine giriyor mu?
 *
 * KURAL (Nezif): "Yeni başlayan personelin birimi sonraki aydan itibaren
 * başlamalı." Yani göreve başlanan AY prime dahil değil; kişi ancak ayın
 * ilk gününde çoktan görevdeyse o ayın havuzundan pay alır. 15 Ağustos'ta
 * başlayan da 1 Ağustos'ta başlayan da ilk primini EYLÜL'de alır.
 *
 * Ayrılışta simetrik davranmıyoruz: ayın başında görevdeyse o ayı alır,
 * ay içinde ayrılsa bile. Ay ortasında ayrılanın hakkını silmek, ay
 * ortasında başlayana pay vermemekle aynı şey değil.
 */
export function aydaGorevliMi(a: Pick<Atama, "baslangic" | "bitis">, ay: string): boolean {
  const ayBas = `${ay}-01`;
  // Başlangıç boşsa "her zaman görevdeydi" sayılır (geçişte tarihi
  // bilinmeyen kayıtlar için).
  if (a.baslangic && a.baslangic.slice(0, 10) >= ayBas) return false;
  if (a.bitis && a.bitis.slice(0, 10) < ayBas) return false;
  return true;
}

export function ayinSonGunu(ay: string): string {
  const [y, a] = ay.split("-").map(Number);
  // 0. gün = bir önceki ayın son günü
  const d = new Date(Date.UTC(y, a, 0));
  return d.toISOString().slice(0, 10);
}

export function aktifMi(p: Pick<Personel, "ayrilis">, bugun: string): boolean {
  return !p.ayrilis || p.ayrilis.slice(0, 10) > bugun;
}

export interface AydaKisi {
  personelId: string;
  adSoyad: string;
  pozisyonId: string;
  unvan: string;
  primGrubu: string;
}

/**
 * Seçilen ayda görevde olan kişiler, prim grubuyla birlikte.
 *
 * Aynı kişi aynı ayda iki pozisyonda görünebilir (devir ayı). Prim
 * hesabında çift saymamak için grup bazında KİŞİ tekilleştiriliyor —
 * bir kişi bir havuzdan yalnızca bir pay alır.
 */
export function aydaGorevliler(
  ay: string,
  atamalar: Atama[],
  personeller: Personel[],
  pozisyonlar: PozisyonKisa[],
): AydaKisi[] {
  const kisiIle = new Map(personeller.map((p) => [p.id, p]));
  const pozIle = new Map(pozisyonlar.map((p) => [p.id, p]));
  const gorulen = new Set<string>();
  const sonuc: AydaKisi[] = [];

  for (const a of atamalar) {
    if (!aydaGorevliMi(a, ay)) continue;
    const kisi = kisiIle.get(a.personel_id);
    if (!kisi) continue;

    const anahtar = `${a.personel_id}|${a.prim_grubu}`;
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);

    sonuc.push({
      personelId: a.personel_id,
      adSoyad: kisi.ad_soyad,
      pozisyonId: a.pozisyon_id,
      unvan: pozIle.get(a.pozisyon_id)?.unvan ?? "(görev tanımı yok)",
      primGrubu: a.prim_grubu,
    });
  }

  return sonuc.sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, "tr"));
}

/** Bir grubun o aydaki üyeleri. */
export function grupUyeleri(kisiler: AydaKisi[], grup: PrimGrubu): AydaKisi[] {
  return kisiler.filter((k) => k.primGrubu === grup);
}

/**
 * Prim motoruna verilecek kadro özeti.
 *
 * Bölge sorumlusu adları şube eşleştirmesinde kullanıldığı için (şubenin
 * merkez_yetkilisi alanıyla karşılaştırılıyor) buradan geçiyor. O ay o
 * görevde kimse yoksa ad boş kalır ve çağıran taraf ayarlardaki değere
 * düşer — yoksa bölge ayrımı çöker ve prim sıfırlanır.
 */
export function kadroBilgisi(kisiler: AydaKisi[]): {
  uretimSayisi: number;
  merkezSayisi: number;
  merkezSorumluAd: string;
  bolge1Ad: string;
  bolge2Ad: string;
} {
  const ilk = (g: PrimGrubu) => grupUyeleri(kisiler, g)[0]?.adSoyad ?? "";
  return {
    uretimSayisi: grupUyeleri(kisiler, "uretim").length,
    merkezSayisi: grupUyeleri(kisiler, "merkez").length,
    merkezSorumluAd: ilk("merkez_sorumlu"),
    bolge1Ad: ilk("bolge1"),
    bolge2Ad: ilk("bolge2"),
  };
}

/** Kadro o ay için kullanılabilir mi? Hiç atama yoksa eski listeye düşülür. */
export function kadroKullanilabilir(kisiler: AydaKisi[]): boolean {
  return kisiler.some((k) => k.primGrubu !== "yok");
}

// ─── Tutarlılık uyarıları ─────────────────────────────────────────────────

export type UyariTuru =
  | "gorev_tanimi_yok"
  | "gorevde_kimse_yok"
  | "atamasiz_personel"
  | "gorev_tanimi_bos"
  | "prim_grubu_yok"
  | "ayrilan_hala_atanmis"
  | "ayni_adli_gorev";

export interface Uyari {
  tur: UyariTuru;
  baslik: string;
  ayrinti: string;
  /** Bu uyarı için elle yapılması gereken iş */
  yapilacak: string;
  agir: boolean;
}

const UYARI_BASLIK: Record<UyariTuru, string> = {
  gorev_tanimi_yok: "Görev tanımı olmayan atama",
  gorevde_kimse_yok: "Kimsenin atanmadığı görev",
  atamasiz_personel: "Görevi atanmamış personel",
  gorev_tanimi_bos: "İçeriği boş görev tanımı",
  prim_grubu_yok: "Prim grubu seçilmemiş",
  ayrilan_hala_atanmis: "Ayrılmış personelin açık görevi",
  ayni_adli_gorev: "Aynı adla birden fazla görev tanımı",
};

/**
 * Elle müdahale gereken yerleri bulur.
 *
 * Nezif'in istediği: "güncellenmesi gereken ama güncellenmesi için elle
 * müdahale edilen yerler için uyarı olmalı. Örneğin tamamen yeni bir kadro
 * eklendiğinde görev tanımı eklenmesi uyarısı gelmeli."
 */
export function kadroUyarilari(
  personeller: Personel[],
  atamalar: Atama[],
  pozisyonlar: PozisyonKisa[],
  bugun: string,
): Uyari[] {
  const uyarilar: Uyari[] = [];
  const pozIle = new Map(pozisyonlar.map((p) => [p.id, p]));
  const kisiIle = new Map(personeller.map((p) => [p.id, p]));
  const acik = atamalar.filter((a) => !a.bitis);

  // 1) Atama var ama görev tanımı silinmiş/yok
  for (const a of acik) {
    if (pozIle.has(a.pozisyon_id)) continue;
    const kisi = kisiIle.get(a.personel_id);
    uyarilar.push({
      tur: "gorev_tanimi_yok",
      baslik: UYARI_BASLIK.gorev_tanimi_yok,
      ayrinti: `${kisi?.ad_soyad ?? "Bilinmeyen kişi"} artık var olmayan bir göreve atanmış.`,
      yapilacak: "Doküman Yönetimi'nden görev tanımını geri ekleyin ya da atamayı başka göreve taşıyın.",
      agir: true,
    });
  }

  // 2) Görev tanımı var ama kimse atanmamış — "yeni kadro" durumu
  const atananPozisyonlar = new Set(acik.map((a) => a.pozisyon_id));
  for (const p of pozisyonlar) {
    if (atananPozisyonlar.has(p.id)) continue;
    uyarilar.push({
      tur: "gorevde_kimse_yok",
      baslik: UYARI_BASLIK.gorevde_kimse_yok,
      ayrinti: `"${p.unvan}" görevinde şu an kimse yok.`,
      yapilacak: "Personel ekranından bu göreve birini atayın; kimse yoksa görev tanımını pasife alın.",
      agir: false,
    });
  }

  // 3) Kadroda olup hiçbir göreve atanmamış kişi
  const atananKisiler = new Set(acik.map((a) => a.personel_id));
  for (const p of personeller) {
    if (!aktifMi(p, bugun)) continue;
    if (atananKisiler.has(p.id)) continue;
    uyarilar.push({
      tur: "atamasiz_personel",
      baslik: UYARI_BASLIK.atamasiz_personel,
      ayrinti: `${p.ad_soyad} kadroda ama hiçbir göreve atanmamış.`,
      yapilacak: "Görev tanımı yoksa Doküman Yönetimi'nden ekleyin, sonra bu kişiyi atayın.",
      agir: true,
    });
  }

  // 4) Görev tanımı boş — yeni açılmış ama içeriği yazılmamış
  for (const p of pozisyonlar) {
    if (p.doluMu) continue;
    uyarilar.push({
      tur: "gorev_tanimi_bos",
      baslik: UYARI_BASLIK.gorev_tanimi_bos,
      ayrinti: `"${p.unvan}" görev tanımının içeriği boş.`,
      yapilacak: "Doküman Yönetimi'nden amaç, görevler, sorumluluklar ve KPI alanlarını doldurun.",
      agir: false,
    });
  }

  // 5) Prim grubu seçilmemiş açık atama — prim hesabında görünmez
  for (const a of acik) {
    if (a.prim_grubu !== "yok") continue;
    const kisi = kisiIle.get(a.personel_id);
    const poz = pozIle.get(a.pozisyon_id);
    uyarilar.push({
      tur: "prim_grubu_yok",
      baslik: UYARI_BASLIK.prim_grubu_yok,
      ayrinti: `${kisi?.ad_soyad ?? "?"} — ${poz?.unvan ?? "?"} için prim grubu seçilmemiş; prim hesabına girmiyor.`,
      yapilacak: "Prime girmesi gerekiyorsa atamadan grubu seçin; gerekmiyorsa bu uyarı göz ardı edilebilir.",
      agir: false,
    });
  }

  // 6) Ayrılmış ama açık ataması duran kişi (trigger kaçırmışsa)
  for (const a of acik) {
    const kisi = kisiIle.get(a.personel_id);
    if (!kisi || aktifMi(kisi, bugun)) continue;
    uyarilar.push({
      tur: "ayrilan_hala_atanmis",
      baslik: UYARI_BASLIK.ayrilan_hala_atanmis,
      ayrinti: `${kisi.ad_soyad} ${kisi.ayrilis} tarihinde ayrılmış ama görevi hâlâ açık.`,
      yapilacak: "Atamanın bitiş tarihini girin; yoksa primde görünmeye devam eder.",
      agir: true,
    });
  }

  // 7) Aynı unvanla birden fazla görev tanımı
  //
  // Neden uyarı: bir göreve birden fazla kişi atanabildiği belli olmayınca
  // kişi başına ayrı tanım açılıyor. Sonuç, organizasyon şemasında aynı
  // kutudan üç tane ve "bu görevde kimse yok" diyen yanıltıcı uyarılar.
  const unvanSayim = new Map<string, PozisyonKisa[]>();
  for (const p of pozisyonlar) {
    const anahtar = p.unvan.trim().toLocaleLowerCase("tr");
    if (!anahtar) continue;
    if (!unvanSayim.has(anahtar)) unvanSayim.set(anahtar, []);
    unvanSayim.get(anahtar)!.push(p);
  }
  for (const [, grup] of unvanSayim) {
    if (grup.length < 2) continue;
    const doluSayisi = grup.filter((p) =>
      acik.some((a) => a.pozisyon_id === p.id),
    ).length;
    uyarilar.push({
      tur: "ayni_adli_gorev",
      baslik: UYARI_BASLIK.ayni_adli_gorev,
      ayrinti: `"${grup[0].unvan}" adıyla ${grup.length} ayrı görev tanımı var (${doluSayisi} tanesinde kişi atanmış).`,
      yapilacak:
        "Aynı göreve birden fazla kişi atanabilir; tek tanımda birleştirip fazlalıkları silin.",
      agir: false,
    });
  }

  return uyarilar.sort((a, b) => Number(b.agir) - Number(a.agir));
}
