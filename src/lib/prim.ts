// prim.ts — Tonaj Primi hakediş motoru.
//
// Eski panelin assets/js/ui/primhesap.js → primHesapla() fonksiyonunun birebir
// karşılığı; kurallar şirketin görev tanımı Word belgesi Bölüm 8.3'ten geliyor.
// Tek fark veri kaynağı: orada şube nesnesinin içindeki satislar[ay] alanı,
// burada aylik_satislar tablosundan gelen (yil, ay) kayıtları.

import type { Sube, AylikSatis } from "@/types/database";
import type { PrimAyarlari } from "./dokuman-varsayilan";

/** Türkçe büyük harfe çevirir (i → İ). Eski utils.js trUpper karşılığı. */
export function trUpper(s: string): string {
  return s.replace(/i/g, "İ").toUpperCase();
}

export interface HedefDetaySatiri {
  ad: string;
  subeSayisi: number;
  subeHedef: number;
  ham: number;
  taban: number;
  kullanilan: number;
}

export interface PrimSonucu {
  toplamKg: number;
  toplamHedef: number;
  toplamAsim: number;
  merkezKg: number;
  bolge1Kg: number;
  bolge2Kg: number;
  merkezHedef: number;
  bolge1Hedef: number;
  bolge2Hedef: number;
  merkezAsim: number;
  bolge1Asim: number;
  bolge2Asim: number;
  hedefDetay: HedefDetaySatiri[];
  uretimHavuz: number;
  merkezHavuz: number;
  bolge1Havuz: number;
  bolge2Havuz: number;
  merkezSoruHavuz: number;
  uretimGrubunaToplam: number;
  merkezGrubunaToplam: number;
  uretimKisiBasina: number;
  merkezKisiBasina: number;
  bolge1Sorumlu: number;
  bolge2Sorumlu: number;
  merkezSorumlu: number;
  primYok: boolean;
}

/**
 * O ayın kadrosu. Verilirse adlar ve kişi sayıları buradan alınır.
 *
 * Neden: adlar önceden prim ayarlarında elle yazılıydı ve kadro değişince
 * geçmiş ayların primi de yeni kişiye yazılıyordu. Artık kadro tarihli
 * atamalardan geliyor; her ay kendi kadrosuyla hesaplanıyor.
 *
 * Verilmezse eski davranış korunuyor (0018 uygulanmamış kurulumlar için).
 */
export interface KadroBilgisi {
  uretimSayisi: number;
  merkezSayisi: number;
  merkezSorumluAd: string;
  bolge1Ad: string;
  bolge2Ad: string;
}

export function primHesapla(
  subeler: Sube[],
  satislar: AylikSatis[],
  yil: number,
  ay: string,
  a: PrimAyarlari,
  kadro?: KadroBilgisi,
): PrimSonucu {
  const aktifler = subeler.filter((s) => s.aktif !== false);

  // Bölge filtresi — "bolge" (dağıtım bölgesi) alanına göre DEĞİL, her şubenin
  // gerçek sorumlusunu gösteren "merkez_yetkilisi" alanına göre ayrılır: bir
  // dağıtım bölgesinde iki sorumlunun şubeleri karışık olabiliyor.
  const merkezSubeler = aktifler.filter((s) => s.tip === "MS");
  const frSubeler = aktifler.filter((s) => s.tip === "FR");
  // Bölge sorumlusunun adı kadrodan geliyorsa oradan; yoksa ayarlardan.
  const bolge1Ad = kadro?.bolge1Ad || a.bolge1_ad || "";
  const bolge2Ad = kadro?.bolge2Ad || a.bolge2_ad || "";
  const bolge2AdNorm = trUpper(bolge2Ad);
  const bolge2Subeler = bolge2AdNorm
    ? frSubeler.filter((s) => trUpper(s.merkez_yetkilisi || "") === bolge2AdNorm)
    : [];
  const bolge1Subeler = bolge2AdNorm
    ? frSubeler.filter((s) => trUpper(s.merkez_yetkilisi || "") !== bolge2AdNorm)
    : frSubeler;

  // Seçilen ayın kg'ları
  const kgMap = new Map<string, number>();
  for (const s of satislar) {
    if (s.yil !== yil || s.ay !== ay) continue;
    kgMap.set(s.sube_id, (kgMap.get(s.sube_id) ?? 0) + (Number(s.kg) || 0));
  }
  const topla = (liste: Sube[]) => liste.reduce((t, s) => t + (kgMap.get(s.id) ?? 0), 0);

  const merkezKg = topla(merkezSubeler);
  const bolge1Kg = topla(bolge1Subeler);
  const bolge2Kg = topla(bolge2Subeler);
  const toplamKg = merkezKg + bolge1Kg + bolge2Kg;

  // Hedefler — her bölgenin kendi tabanı var (aktif şube × şube hedefi,
  // taban altındaysa taban geçerli).
  const merkezHedefHam = merkezSubeler.length * a.merkez_sube_hedef_kg;
  const bolge1HedefHam = bolge1Subeler.length * a.bolge1_sube_hedef_kg;
  const bolge2HedefHam = bolge2Subeler.length * a.bolge2_sube_hedef_kg;
  const merkezHedef = Math.max(a.merkez_taban_kg, merkezHedefHam);
  const bolge1Hedef = Math.max(a.bolge1_taban_kg, bolge1HedefHam);
  const bolge2Hedef = Math.max(a.bolge2_taban_kg, bolge2HedefHam);
  const toplamHedef = merkezHedef + bolge1Hedef + bolge2Hedef;

  const hedefDetay: HedefDetaySatiri[] = [
    {
      ad: "Merkez Şubeler",
      subeSayisi: merkezSubeler.length,
      subeHedef: a.merkez_sube_hedef_kg,
      ham: merkezHedefHam,
      taban: a.merkez_taban_kg,
      kullanilan: merkezHedef,
    },
    {
      ad: `Bölge 1 — ${bolge1Ad || "Bölge 1"}`,
      subeSayisi: bolge1Subeler.length,
      subeHedef: a.bolge1_sube_hedef_kg,
      ham: bolge1HedefHam,
      taban: a.bolge1_taban_kg,
      kullanilan: bolge1Hedef,
    },
    {
      ad: `Bölge 2 — ${bolge2Ad || "Bölge 2"}`,
      subeSayisi: bolge2Subeler.length,
      subeHedef: a.bolge2_sube_hedef_kg,
      ham: bolge2HedefHam,
      taban: a.bolge2_taban_kg,
      kullanilan: bolge2Hedef,
    },
  ];

  const toplamAsim = Math.max(0, toplamKg - toplamHedef);
  const merkezAsim = Math.max(0, merkezKg - merkezHedef);
  const bolge1Asim = Math.max(0, bolge1Kg - bolge1Hedef);
  const bolge2Asim = Math.max(0, bolge2Kg - bolge2Hedef);

  const bos = {
    toplamKg,
    toplamHedef,
    toplamAsim,
    merkezKg,
    bolge1Kg,
    bolge2Kg,
    merkezHedef,
    bolge1Hedef,
    bolge2Hedef,
    merkezAsim,
    bolge1Asim,
    bolge2Asim,
    hedefDetay,
  };

  // Şirket geneli hedef aşılmadıysa hiç prim doğmaz — bölgesel aşım olsa bile.
  if (toplamAsim === 0) {
    return {
      ...bos,
      primYok: true,
      uretimHavuz: 0,
      merkezHavuz: 0,
      bolge1Havuz: 0,
      bolge2Havuz: 0,
      merkezSoruHavuz: 0,
      uretimGrubunaToplam: 0,
      merkezGrubunaToplam: 0,
      uretimKisiBasina: 0,
      merkezKisiBasina: 0,
      bolge1Sorumlu: 0,
      bolge2Sorumlu: 0,
      merkezSorumlu: 0,
    };
  }

  // Havuzlar (Bölüm 8.3)
  const uretimHavuz = toplamAsim * a.uretim_katsayi_tl;
  const merkezHavuz = toplamAsim * a.merkez_katsayi_tl;
  const bolge1Havuz = bolge1Asim * a.bolge_katsayi_tl;
  const bolge2Havuz = bolge2Asim * a.bolge_katsayi_tl;
  const merkezSoruHavuz = merkezAsim * a.bolge_katsayi_tl;

  const ud = a.uretim_dagilim;
  const md = a.merkez_dagilim;
  const bd = a.bolge_dagilim;

  // Kişi başına pay, o AYIN kadro sayısına bölünür. Kadro verilmezse eski
  // davranış: ayarlardaki liste uzunluğu. Bu ayrım önemli — biri ayrıldığında
  // geçmiş ayın payı, o ay görevde olan kişi sayısına göre kalmalı.
  const nU = (kadro ? kadro.uretimSayisi : a.personel_uretim.length) || 1;
  const nM = (kadro ? kadro.merkezSayisi : a.personel_merkez.length) || 1;

  const uretimGrup =
    uretimHavuz * ud.uretim +
    merkezHavuz * md.uretim +
    bolge1Havuz * bd.uretim +
    bolge2Havuz * bd.uretim +
    merkezSoruHavuz * bd.uretim;

  const merkezGrup =
    uretimHavuz * ud.merkez +
    merkezHavuz * md.merkez +
    bolge1Havuz * bd.merkez +
    bolge2Havuz * bd.merkez +
    merkezSoruHavuz * bd.merkez;

  // Her sorumlunun kişisel payı: kendi havuzunun %70'i + Üretim/Merkez
  // havuzlarının Bölge payının aşım yapan sorumlu sayısına bölünmüş hali.
  const bolgeKisiSayisi =
    (bolge1Asim > 0 ? 1 : 0) + (bolge2Asim > 0 ? 1 : 0) + (merkezAsim > 0 ? 1 : 0) || 1;
  const bolgePayiUretimden = uretimHavuz * ud.bolge;
  const bolgePayiMerkezden = merkezHavuz * md.bolge;
  const ortakPay = bolgePayiUretimden / bolgeKisiSayisi + bolgePayiMerkezden / bolgeKisiSayisi;

  return {
    ...bos,
    uretimHavuz,
    merkezHavuz,
    bolge1Havuz,
    bolge2Havuz,
    merkezSoruHavuz,
    uretimGrubunaToplam: uretimGrup,
    merkezGrubunaToplam: merkezGrup,
    uretimKisiBasina: uretimGrup / nU,
    merkezKisiBasina: merkezGrup / nM,
    bolge1Sorumlu: (bolge1Asim > 0 ? bolge1Havuz * bd.sorumlu : 0) + ortakPay,
    bolge2Sorumlu: (bolge2Asim > 0 ? bolge2Havuz * bd.sorumlu : 0) + ortakPay,
    merkezSorumlu: (merkezAsim > 0 ? merkezSoruHavuz * bd.sorumlu : 0) + ortakPay,
    primYok: false,
  };
}

export interface PrimPersonelSatiri {
  ad: string;
  unvan: string;
  grup: string;
  prim: number;
}

/**
 * Kadrodan gelen kişilerle prim tablosu.
 *
 * Adlar artık elle yazılmıyor: seçilen ayda o göreve atanmış kişiler
 * geliyor. Kadro boşsa (0018 uygulanmamışsa ya da o ay için hiç atama
 * yoksa) çağıran taraf eski primPersonelSatirlari'na düşer.
 */
export function primPersonelSatirlariKadrodan(
  h: PrimSonucu,
  kisiler: { adSoyad: string; unvan: string; primGrubu: string }[],
): PrimPersonelSatiri[] {
  const pay: Record<string, { grup: string; prim: number }> = {
    merkez_sorumlu: { grup: "Bölge Sorumluları", prim: h.merkezSorumlu },
    bolge1: { grup: "Bölge Sorumluları", prim: h.bolge1Sorumlu },
    bolge2: { grup: "Bölge Sorumluları", prim: h.bolge2Sorumlu },
    merkez: { grup: "Merkez / İdari", prim: h.merkezKisiBasina },
    uretim: { grup: "Üretim", prim: h.uretimKisiBasina },
  };

  return kisiler
    .filter((k) => k.primGrubu !== "yok" && pay[k.primGrubu])
    .map((k) => ({
      ad: k.adSoyad,
      unvan: k.unvan,
      grup: pay[k.primGrubu].grup,
      prim: pay[k.primGrubu].prim,
    }));
}

/** Sonucu kişi bazlı prim tablosuna çevirir (eski personelSatirlar mantığı). */
export function primPersonelSatirlari(
  h: PrimSonucu,
  a: PrimAyarlari,
): PrimPersonelSatiri[] {
  return [
    {
      ad: a.merkez_sorumlu_ad || "İzzet ALTUĞ",
      unvan: a.merkez_sorumlu_unvan || "Merkez Şubeler Sorumlusu",
      grup: "Bölge Sorumluları",
      prim: h.merkezSorumlu,
    },
    {
      ad: a.bolge1_ad || "Bölge 1",
      unvan: a.bolge1_unvan || "Bölge 1 Sorumlusu",
      grup: "Bölge Sorumluları",
      prim: h.bolge1Sorumlu,
    },
    {
      ad: a.bolge2_ad || "Bölge 2",
      unvan: a.bolge2_unvan || "Bölge 2 Sorumlusu",
      grup: "Bölge Sorumluları",
      prim: h.bolge2Sorumlu,
    },
    ...a.personel_merkez.map((p) => ({
      ad: p.ad,
      unvan: p.unvan,
      grup: "Merkez / İdari",
      prim: h.merkezKisiBasina,
    })),
    ...a.personel_uretim.map((p) => ({
      ad: p.ad,
      unvan: p.unvan,
      grup: "Üretim",
      prim: h.uretimKisiBasina,
    })),
  ];
}
