// organizasyon.ts — Organizasyon şemasını görev tanımlarından türetir.
//
// Şema AYRI bir yerde tutulmuyor: ağaç, Doküman Yönetimi'ndeki pozisyonların
// "Bağlı Olduğu Kişi" alanından çıkarılıyor. Nezif'in "sürekli güncel kalsın"
// isteğinin karşılığı bu — görev tanımını güncelleyince şema kendiliğinden
// güncelleniyor, ikinci bir yeri elle güncelleme derdi olmuyor.

import type { Pozisyon } from "./dokuman-varsayilan";

export type OrgGrup = "yonetim" | "idari" | "bolge" | "uretim";

export const GRUP_ETIKET: Record<OrgGrup, string> = {
  yonetim: "Yönetim",
  idari: "İdari / Merkez",
  bolge: "Bölge / Franchise",
  uretim: "Üretim",
};

export const GRUP_RENK: Record<OrgGrup, string> = {
  yonetim: "#1f3864",
  idari: "#2e75b6",
  bolge: "#ed7d31",
  uretim: "#70ad47",
};

function trUpper(s: string): string {
  return s.replace(/i/g, "İ").toUpperCase();
}

/** Unvandan renk grubunu çıkarır (şemadaki dört kategori). */
export function grupBul(unvan: string, bagliKisi: string): OrgGrup {
  const u = trUpper(unvan);
  if (u.includes("GENEL MÜDÜR") && !trUpper(bagliKisi).includes("GENEL MÜDÜR")) return "yonetim";
  if (u.includes("BÖLGE")) return "bolge";
  if (
    u.includes("GIDA MÜHENDİS") ||
    u.includes("USTA") ||
    u.includes("ÜRETİM") ||
    u.includes("SOS")
  ) {
    return "uretim";
  }
  return "idari";
}

export interface OrgDugum {
  id: string;
  unvan: string;
  adSoyad: string;
  grup: OrgGrup;
  /** Bu pozisyon Doküman Yönetimi'nde bir kayda karşılık geliyor mu? */
  pozisyonMu: boolean;
  cocuklar: OrgDugum[];
}

/**
 * bagliKisi serbest metin ("Ramazan ALTUĞ (Genel Müdür)", "Muhasebe Sorumlusu",
 * "Gıda Mühendisi / Usta Başı"). Bir pozisyonun adı veya unvanı bu metnin
 * içinde geçiyorsa üst olarak kabul ediliyor. Birden fazla eşleşirse en uzun
 * eşleşme kazanır ("Gıda Mühendisi / Usta Başı" → Usta Başı değil, ilk yazan).
 */
/** "Gıda Mühendisi (Üretim ve Kalite Sorumlusu)" → "Gıda Mühendisi" */
function parantezsiz(s: string): string {
  return s.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

function ustBul(p: Pozisyon, hepsi: Pozisyon[]): Pozisyon | null {
  const hedef = trUpper(p.bagliKisi || "");
  if (!hedef) return null;

  let enIyi: { poz: Pozisyon; skor: number } | null = null;
  for (const aday of hepsi) {
    if (aday.id === p.id) continue;

    // Ad ve unvanın hem tam hem parantezsiz hali denenir: görev tanımlarında
    // üst, çoğu zaman kısa yazımla anılıyor ("Gıda Mühendisi") ama pozisyonun
    // kendi unvanı uzun olabiliyor.
    const anahtarlar = new Set(
      [aday.adSoyad, aday.unvan, parantezsiz(aday.adSoyad), parantezsiz(aday.unvan)]
        .map((x) => trUpper((x || "").trim()))
        .filter((x) => x.length >= 4),
    );

    for (const a of anahtarlar) {
      let skor = 0;
      if (hedef.includes(a)) skor = a.length;
      // Ters yön: bagliKisi kısa, adayın unvanı uzun olabilir.
      else if (a.includes(hedef) && hedef.length >= 5) skor = hedef.length - 1;
      if (skor && (!enIyi || skor > enIyi.skor)) enIyi = { poz: aday, skor };
    }
  }
  return enIyi?.poz ?? null;
}

/** bagliKisi metninden kişi adını ayıklar: "Ramazan ALTUĞ (Genel Müdür)" → ad + unvan. */
function kokAyikla(bagliKisi: string): { adSoyad: string; unvan: string } {
  const m = bagliKisi.match(/^\s*([^(]+?)\s*\(([^)]+)\)\s*$/);
  if (m) return { adSoyad: m[1].trim(), unvan: m[2].trim() };
  return { adSoyad: bagliKisi.trim(), unvan: "" };
}

export interface OrgSemasi {
  kokler: OrgDugum[];
  /** Ağaca bağlanamayan pozisyonlar — bagliKisi eşleşmemiş olabilir. */
  bagsizlar: OrgDugum[];
}

export function organizasyonKur(pozisyonlar: Pozisyon[]): OrgSemasi {
  const dugum = new Map<string, OrgDugum>();
  for (const p of pozisyonlar) {
    dugum.set(p.id, {
      id: p.id,
      unvan: p.unvan,
      adSoyad: p.adSoyad,
      grup: grupBul(p.unvan, p.bagliKisi),
      pozisyonMu: true,
      cocuklar: [],
    });
  }

  // Pozisyon listesinde karşılığı olmayan üstler (ör. Genel Müdür) için
  // sentetik kök düğümler.
  const sentetik = new Map<string, OrgDugum>();
  const koksuzler: OrgDugum[] = [];

  for (const p of pozisyonlar) {
    const kendi = dugum.get(p.id)!;
    const ust = ustBul(p, pozisyonlar);

    if (ust) {
      dugum.get(ust.id)!.cocuklar.push(kendi);
      continue;
    }

    if (p.bagliKisi?.trim()) {
      const { adSoyad, unvan } = kokAyikla(p.bagliKisi);
      const anahtar = trUpper(adSoyad);
      if (!sentetik.has(anahtar)) {
        sentetik.set(anahtar, {
          id: "kok-" + anahtar.replace(/[^A-Z0-9]/g, ""),
          unvan: unvan || "Genel Müdür",
          adSoyad,
          grup: "yonetim",
          pozisyonMu: false,
          cocuklar: [],
        });
      }
      sentetik.get(anahtar)!.cocuklar.push(kendi);
    } else {
      koksuzler.push(kendi);
    }
  }

  // Sıra: pozisyon listesindeki sıra korunur, çocuklar da aynı sırayla.
  const sira = new Map(pozisyonlar.map((p, i) => [p.id, i]));
  const sirala = (d: OrgDugum) => {
    d.cocuklar.sort((a, b) => (sira.get(a.id) ?? 0) - (sira.get(b.id) ?? 0));
    d.cocuklar.forEach(sirala);
  };
  const kokler = [...sentetik.values()];
  kokler.forEach(sirala);

  return { kokler, bagsizlar: koksuzler };
}

/** Ağaçtaki toplam düğüm sayısı (sentetik kökler dahil). */
export function dugumSay(d: OrgDugum): number {
  return 1 + d.cocuklar.reduce((t, c) => t + dugumSay(c), 0);
}

/**
 * Bir pozisyonun KENDİSİ + BÜTÜN ASTLARI (alt dalların tamamı).
 *
 * "Kişi kendi KPI'ını, primini ve görev tanımını görsün, astlarınınkini de
 * görsün" kuralının karşılığı. Hiyerarşi zaten görev tanımlarındaki
 * "Bağlı Olduğu Kişi" alanından türetildiği için ayrıca tanımlanmıyor —
 * organizasyon şeması değiştikçe görünürlük de kendiliğinden değişir.
 *
 * Genel müdür ağacın kökü olduğu için onun astları herkestir; yani aynı
 * kural üst kademede "her şeyi gör" anlamına gelir, ayrı bir istisna
 * yazmaya gerek kalmaz.
 */
export function kendisiVeAstlari(pozisyonlar: Pozisyon[], pozisyonId: string): Set<string> {
  const { kokler } = organizasyonKur(pozisyonlar);

  const topla = (d: OrgDugum, kume: Set<string>) => {
    kume.add(d.id);
    d.cocuklar.forEach((c) => topla(c, kume));
  };

  const ara = (d: OrgDugum): OrgDugum | null => {
    if (d.id === pozisyonId) return d;
    for (const c of d.cocuklar) {
      const b = ara(c);
      if (b) return b;
    }
    return null;
  };

  for (const k of kokler) {
    const bulunan = ara(k);
    if (bulunan) {
      const kume = new Set<string>();
      topla(bulunan, kume);
      return kume;
    }
  }
  // Ağaçta yoksa en azından kendisi görünsün.
  return new Set(pozisyonId ? [pozisyonId] : []);
}

/**
 * Kullanıcının görebileceği pozisyonlar.
 * Admin her şeyi görür; diğerleri kendisi + astları. Pozisyonu atanmamış
 * kullanıcı hiçbir kişisel kayıt görmez (boş küme) — yanlışlıkla herkesin
 * primini göstermektense hiç göstermemek daha güvenli.
 */
export function gorunurPozisyonlar(
  rol: string,
  pozisyonId: string | null | undefined,
  pozisyonlar: Pozisyon[],
): Set<string> | null {
  if (rol === "admin") return null; // null = sınır yok
  if (!pozisyonId) return new Set();
  return kendisiVeAstlari(pozisyonlar, pozisyonId);
}

/** profiles.ad_soyad ile pozisyon.adSoyad arasında Türkçe duyarlı eşleşme. */
export function pozisyonTahmin(adSoyad: string, pozisyonlar: Pozisyon[]): string | null {
  const a = trUpper((adSoyad || "").trim());
  if (!a) return null;
  const tam = pozisyonlar.find((p) => trUpper((p.adSoyad || "").trim()) === a);
  if (tam) return tam.id;
  const icerir = pozisyonlar.find((p) => {
    const b = trUpper((p.adSoyad || "").trim());
    return b.length > 4 && (b.includes(a) || a.includes(b));
  });
  return icerir?.id ?? null;
}
