// sube-kod.ts — Şube kodlama sistemi.
//
// Format:  T PP - SSS II      örnek: F41-039GE
//   T   = tip harfi           F = Franchise, M = Merkez Şube
//   PP  = il plaka kodu       2 hane
//   SSS = il içi sıra no      3 hane, sıfır dolgulu
//   II  = ilçe kısaltması     ilçe adının Türkçe büyük harfle ilk 2 harfi
//
// Kurallar üretimdeki 239 şubenin tamamından geri mühendislikle çıkarıldı
// (eski panelde yalnızca serbest metin alanıydı, üretici mantık yoktu):
//   · Sıra no il içinde F ve M için ORTAK tek sayaçtır, tip başına ayrı değil.
//   · Yeni numara "mevcut en büyük + 1"dir; kapanan şubenin numarası
//     tekrar kullanılmaz (Nezif'in kararı, 2026-07-30) — böylece bir kod
//     tarih boyunca tek bir şubeye ait kalır ve eski raporlar karışmaz.
//   · İlçe kısaltmaları tekil değildir (KANDIRA ve KARTEPE ikisi de KA);
//     ayrımı sıra no yapar.

import type { Sube } from "@/types/database";

export const KOD_DESENI = /^([FM])(\d{2})-(\d{3})([A-ZÇĞİÖŞÜ]{2})$/;

/** Türkçe büyük harf: i → İ (JS toUpperCase bunu I yapar, kodlarda Dİ/İZ var). */
export function trUpper(s: string): string {
  return s.replace(/i/g, "İ").toUpperCase();
}

/**
 * İl adı → plaka kodu. Üretim verisinde iller kısa adla tutuluyor
 * (AFYON, değil AFYONKARAHİSAR), o yüzden yaygın kısa adlar da eşlenik.
 */
const IL_PLAKA: Record<string, string> = {
  ADANA: "01", ADIYAMAN: "02", AFYONKARAHİSAR: "03", AFYON: "03", AĞRI: "04",
  AMASYA: "05", ANKARA: "06", ANTALYA: "07", ARTVİN: "08", AYDIN: "09",
  BALIKESİR: "10", BİLECİK: "11", BİNGÖL: "12", BİTLİS: "13", BOLU: "14",
  BURDUR: "15", BURSA: "16", ÇANAKKALE: "17", ÇANKIRI: "18", ÇORUM: "19",
  DENİZLİ: "20", DİYARBAKIR: "21", EDİRNE: "22", ELAZIĞ: "23", ERZİNCAN: "24",
  ERZURUM: "25", ESKİŞEHİR: "26", GAZİANTEP: "27", GİRESUN: "28",
  GÜMÜŞHANE: "29", HAKKARİ: "30", HATAY: "31", ISPARTA: "32", MERSİN: "33",
  İÇEL: "33", İSTANBUL: "34", İZMİR: "35", KARS: "36", KASTAMONU: "37",
  KAYSERİ: "38", KIRKLARELİ: "39", KIRŞEHİR: "40", KOCAELİ: "41", KONYA: "42",
  KÜTAHYA: "43", MALATYA: "44", MANİSA: "45", KAHRAMANMARAŞ: "46",
  MARAŞ: "46", MARDİN: "47", MUĞLA: "48", MUŞ: "49", NEVŞEHİR: "50",
  NİĞDE: "51", ORDU: "52", RİZE: "53", SAKARYA: "54", SAMSUN: "55",
  SİİRT: "56", SİNOP: "57", SİVAS: "58", TEKİRDAĞ: "59", TOKAT: "60",
  TRABZON: "61", TUNCELİ: "62", ŞANLIURFA: "63", URFA: "63", UŞAK: "64",
  VAN: "65", YOZGAT: "66", ZONGULDAK: "67", AKSARAY: "68", BAYBURT: "69",
  KARAMAN: "70", KIRIKKALE: "71", BATMAN: "72", ŞIRNAK: "73", BARTIN: "74",
  ARDAHAN: "75", IĞDIR: "76", YALOVA: "77", KARABÜK: "78", KİLİS: "79",
  OSMANİYE: "80", DÜZCE: "81",
};

/**
 * İl için plaka kodu bulur. Öncelik mevcut şubelerdedir: il zaten kullanımdaysa
 * o ilin fiilen kullandığı plaka döner, böylece elle girilmiş bir istisna varsa
 * statik tablo onu bozmaz. Bilinmeyen il için null.
 */
export function ilPlakaBul(il: string, subeler: Sube[] = []): string | null {
  const hedef = trUpper((il || "").trim());
  for (const s of subeler) {
    if (trUpper((s.il || "").trim()) === hedef) {
      const m = (s.kod || "").match(KOD_DESENI);
      if (m) return m[2];
    }
  }
  return IL_PLAKA[hedef] ?? null;
}

/** İlçe adının ilk 2 harfi, Türkçe büyük harfle. Harf olmayanlar atılır. */
export function ilceKisalt(ilce: string): string {
  return trUpper(ilce || "")
    .replace(/[^A-ZÇĞİÖŞÜ]/g, "")
    .slice(0, 2);
}

/** Bir il için sonraki sıra no: mevcut en büyük + 1 (F ve M ortak sayaç). */
export function sonrakiSiraNo(subeler: Sube[], il: string): number {
  const plaka = ilPlakaBul(il, subeler);
  if (!plaka) return 1;
  let max = 0;
  for (const s of subeler) {
    const m = (s.kod || "").match(KOD_DESENI);
    if (m && m[2] === plaka) max = Math.max(max, Number(m[3]));
  }
  return max + 1;
}

export interface KodUretSonucu {
  kod: string | null;
  siraNo: number | null;
  hata: string | null;
}

/**
 * Şube kodu üretir. siraNo verilmezse ilin sonraki numarası kullanılır.
 * İl bilinmiyorsa veya ilçe boşsa kod üretilmez — uydurmak yerine hata döner.
 */
export function subeKoduUret(
  tip: "MS" | "FR",
  il: string,
  ilce: string,
  subeler: Sube[],
  siraNo?: number,
): KodUretSonucu {
  const plaka = ilPlakaBul(il, subeler);
  if (!plaka) {
    return { kod: null, siraNo: null, hata: `"${il}" ilinin plaka kodu bilinmiyor.` };
  }
  const kisa = ilceKisalt(ilce);
  if (kisa.length < 2) {
    return { kod: null, siraNo: null, hata: "İlçe adı en az 2 harf olmalı." };
  }
  const sira = siraNo ?? sonrakiSiraNo(subeler, il);
  if (!Number.isInteger(sira) || sira < 1 || sira > 999) {
    return { kod: null, siraNo: null, hata: "Sıra no 1 – 999 arasında olmalı." };
  }
  const harf = tip === "MS" ? "M" : "F";
  return {
    kod: `${harf}${plaka}-${String(sira).padStart(3, "0")}${kisa}`,
    siraNo: sira,
    hata: null,
  };
}

export interface KodDenetimi {
  gecerli: boolean;
  hatalar: string[];
}

/**
 * Elle girilmiş kodu formata ve şubenin kendi alanlarına karşı denetler.
 * Uyarı üretir ama engellemez — istisna gerekebilir, kararı kullanıcı verir.
 */
export function kodDenetle(
  kod: string,
  tip: "MS" | "FR",
  il: string,
  ilce: string,
  subeler: Sube[],
  kendiId?: string,
): KodDenetimi {
  const hatalar: string[] = [];
  const temiz = (kod || "").trim().toUpperCase();

  const m = temiz.match(KOD_DESENI);
  if (!m) {
    return {
      gecerli: false,
      hatalar: ["Kod formatı beklenen kalıba uymuyor (örnek: F41-039GE)."],
    };
  }

  const [, harf, plaka, sira, kisa] = m;

  const beklenenHarf = tip === "MS" ? "M" : "F";
  if (harf !== beklenenHarf) {
    hatalar.push(
      `Tip harfi "${harf}" ama şube tipi ${tip === "MS" ? "Merkez" : "Franchise"} → "${beklenenHarf}" olmalı.`,
    );
  }

  const beklenenPlaka = ilPlakaBul(il, subeler);
  if (beklenenPlaka && plaka !== beklenenPlaka) {
    hatalar.push(`Plaka "${plaka}" ama ${il} için ${beklenenPlaka} bekleniyor.`);
  }

  const beklenenKisa = ilceKisalt(ilce);
  if (beklenenKisa.length === 2 && kisa !== beklenenKisa) {
    hatalar.push(`İlçe kısaltması "${kisa}" ama ${ilce} için "${beklenenKisa}" bekleniyor.`);
  }

  // Aynı plaka + sıra no başka şubede kullanılıyor mu (tip fark etmez)?
  const cakisan = subeler.find((s) => {
    if (kendiId && s.id === kendiId) return false;
    const sm = (s.kod || "").match(KOD_DESENI);
    return sm ? sm[2] === plaka && sm[3] === sira : false;
  });
  if (cakisan) {
    hatalar.push(`${plaka}-${sira} sıra numarası "${cakisan.ad}" şubesinde kullanılıyor.`);
  }

  return { gecerli: hatalar.length === 0, hatalar };
}

export interface KodCakismasi {
  anahtar: string;
  subeler: { id: string; ad: string; kod: string; tip: string }[];
}

/** Tüm şubelerde aynı plaka + sıra no'yu paylaşan grupları bulur. */
export function kodCakismalari(subeler: Sube[]): KodCakismasi[] {
  const grup = new Map<string, Sube[]>();
  for (const s of subeler) {
    const m = (s.kod || "").match(KOD_DESENI);
    if (!m) continue;
    const anahtar = `${m[2]}-${m[3]}`;
    if (!grup.has(anahtar)) grup.set(anahtar, []);
    grup.get(anahtar)!.push(s);
  }
  return [...grup]
    .filter(([, liste]) => liste.length > 1)
    .map(([anahtar, liste]) => ({
      anahtar,
      subeler: liste.map((s) => ({ id: s.id, ad: s.ad, kod: s.kod, tip: s.tip })),
    }));
}

/** Formata uymayan kodlu şubeler. */
export function kodsuzVeyaBozuk(subeler: Sube[]): Sube[] {
  return subeler.filter((s) => !KOD_DESENI.test((s.kod || "").trim()));
}
