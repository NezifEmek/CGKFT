// Eski panelin assets/js/analytics.js dosyasındaki hesaplama mantığının
// Supabase şemasına göre yeniden yazılmış hali. Saf fonksiyonlar — sayfa
// bileşenleri veriyi çekip bu fonksiyonlara geçirir.

import type { Sube, AylikSatis, Ay, FiyatModeli } from "@/types/database";
import { AYLAR_12 } from "@/types/database";

export interface Esik {
  ad: string;
  min: number;
  renk: string;
}

/** Eşik tablosunda kg/gün değerinin düştüğü segmenti bulur (en yüksek eşikten aşağı doğru). */
export function segmentBul(kgGunluk: number, esikler: Esik[]): Esik | null {
  const sirali = [...esikler].sort((a, b) => b.min - a.min);
  return sirali.find((e) => kgGunluk >= e.min) ?? null;
}

export function gunSayisiMap(aylar: Ay[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of aylar) m.set(`${a.yil}-${a.ay}`, a.gun_sayisi);
  return m;
}

export interface SubeKgOzet {
  subeId: string;
  toplamKg: number;
  toplamGun: number;
  kgGunluk: number;
  aylikKg: Record<string, number>;
}

/** Her şube için, verilen yıl + ay listesi kapsamında toplam kg / toplam gün / kg-gün ortalaması. */
export function subeKgOzetleri(
  subeler: Sube[],
  satislar: AylikSatis[],
  yil: number,
  aylar: string[],
  gunMap: Map<string, number>,
): Map<string, SubeKgOzet> {
  const bySube = new Map<string, AylikSatis[]>();
  for (const s of satislar) {
    if (s.yil !== yil) continue;
    if (!aylar.includes(s.ay)) continue;
    if (!bySube.has(s.sube_id)) bySube.set(s.sube_id, []);
    bySube.get(s.sube_id)!.push(s);
  }

  const sonuc = new Map<string, SubeKgOzet>();
  for (const sube of subeler) {
    const kayitlar = bySube.get(sube.id) ?? [];
    let toplamKg = 0;
    let toplamGun = 0;
    const aylikKg: Record<string, number> = {};
    for (const k of kayitlar) {
      const kg = Number(k.kg) || 0;
      toplamKg += kg;
      toplamGun += gunMap.get(`${yil}-${k.ay}`) ?? 30;
      aylikKg[k.ay] = kg;
    }
    sonuc.set(sube.id, {
      subeId: sube.id,
      toplamKg,
      toplamGun,
      kgGunluk: toplamGun > 0 ? toplamKg / toplamGun : 0,
      aylikKg,
    });
  }
  return sonuc;
}

/** Ay adlarını takvim sırasına göre sıralar (state.aylar rastgele sırada gelebilir). */
export function aySirala(aylar: string[]): string[] {
  return [...aylar].sort((a, b) => AYLAR_12.indexOf(a as never) - AYLAR_12.indexOf(b as never));
}

export interface BolgeKirilimSatiri {
  anahtar: string; // bolge veya il adı
  subeSayisi: number;
  msSayisi: number;
  frSayisi: number;
  toplamKg: number;
  kgGunluk: number;
  yuzdePay: number;
}

/** Bölge veya il kırılımı — subeKgOzetleri çıktısını gruplar. */
export function kirilimHesapla(
  subeler: Sube[],
  ozetler: Map<string, SubeKgOzet>,
  grupAlani: (s: Sube) => string,
): BolgeKirilimSatiri[] {
  const gruplar = new Map<
    string,
    { subeSayisi: number; msSayisi: number; frSayisi: number; toplamKg: number; toplamGun: number }
  >();

  let genelToplamKg = 0;

  for (const sube of subeler) {
    const ozet = ozetler.get(sube.id);
    const kg = ozet?.toplamKg ?? 0;
    const gun = ozet?.toplamGun ?? 0;
    genelToplamKg += kg;

    const anahtar = grupAlani(sube) || "TANIMSIZ";
    if (!gruplar.has(anahtar)) {
      gruplar.set(anahtar, { subeSayisi: 0, msSayisi: 0, frSayisi: 0, toplamKg: 0, toplamGun: 0 });
    }
    const g = gruplar.get(anahtar)!;
    g.subeSayisi++;
    if (sube.tip === "MS") g.msSayisi++;
    else g.frSayisi++;
    g.toplamKg += kg;
    g.toplamGun += gun;
  }

  return [...gruplar.entries()]
    .map(([anahtar, g]) => ({
      anahtar,
      subeSayisi: g.subeSayisi,
      msSayisi: g.msSayisi,
      frSayisi: g.frSayisi,
      toplamKg: g.toplamKg,
      kgGunluk: g.toplamGun > 0 ? g.toplamKg / g.toplamGun : 0,
      yuzdePay: genelToplamKg > 0 ? (g.toplamKg / genelToplamKg) * 100 : 0,
    }))
    .sort((a, b) => b.toplamKg - a.toplamKg);
}

export interface DususUyarisi {
  subeId: string;
  subeAd: string;
  bolge: string;
  streakUzunluk: number;
  zirveAy: string;
  zirveKgGunluk: number;
  sonAy: string;
  sonKgGunluk: number;
  dususYuzde: number;
}

/**
 * Ardışık en az 3 ay boyunca (MIN_STREAK) kesintisiz düşüş gösteren şubeleri bulur.
 * Her şubenin dolu aylarını takvim sırasına göre dizip sondan geriye doğru
 * kesintisiz azalan seriyi sayar; seri >= 3 ise zirve (seri başlamadan önceki ay)
 * ile son ay arasındaki % düşüşü raporlar.
 */
export function dususUyarilariHesapla(
  subeler: Sube[],
  satislar: AylikSatis[],
  yil: number,
  aySiraliListe: string[],
  gunMap: Map<string, number>,
  minStreak = 3,
): DususUyarisi[] {
  const bySube = new Map<string, Map<string, number>>();
  for (const s of satislar) {
    if (s.yil !== yil) continue;
    if (!bySube.has(s.sube_id)) bySube.set(s.sube_id, new Map());
    bySube.get(s.sube_id)!.set(s.ay, Number(s.kg) || 0);
  }

  const sonuc: DususUyarisi[] = [];

  for (const sube of subeler) {
    const kgMap = bySube.get(sube.id);
    if (!kgMap) continue;

    const doluAylar = aySiraliListe.filter((ay) => kgMap.has(ay));
    if (doluAylar.length < minStreak + 1) continue;

    const kgGunlukSeri = doluAylar.map((ay) => {
      const gun = gunMap.get(`${yil}-${ay}`) ?? 30;
      return { ay, kgGunluk: (kgMap.get(ay) ?? 0) / gun };
    });

    let streak = 1;
    for (let i = kgGunlukSeri.length - 1; i > 0; i--) {
      if (kgGunlukSeri[i].kgGunluk < kgGunlukSeri[i - 1].kgGunluk) streak++;
      else break;
    }
    streak -= 1; // karşılaştırma sayısı = ay sayısı - 1

    if (streak >= minStreak) {
      const zirveIndex = kgGunlukSeri.length - 1 - streak;
      const zirve = kgGunlukSeri[zirveIndex];
      const son = kgGunlukSeri[kgGunlukSeri.length - 1];
      sonuc.push({
        subeId: sube.id,
        subeAd: sube.ad,
        bolge: sube.bolge,
        streakUzunluk: streak,
        zirveAy: zirve.ay,
        zirveKgGunluk: zirve.kgGunluk,
        sonAy: son.ay,
        sonKgGunluk: son.kgGunluk,
        dususYuzde: zirve.kgGunluk > 0 ? ((son.kgGunluk - zirve.kgGunluk) / zirve.kgGunluk) * 100 : 0,
      });
    }
  }

  return sonuc.sort(
    (a, b) => b.streakUzunluk - a.streakUzunluk || a.dususYuzde - b.dususYuzde,
  );
}

export interface SegmentMatrisSatiri {
  subeId: string;
  subeAd: string;
  bolge: string;
  aySegment: Record<string, string>; // ay -> segment adı
  netTrend: number; // +yükseliş -düşüş sayısı
}

/**
 * Her şube için, her ayın kendi kg/gün ortalamasına göre (kümülatif değil, o
 * aya özel) segmentini hesaplar. Segment Takibi ekranının matrisi bu.
 */
export function aylikSegmentMatrisi(
  subeler: Sube[],
  satislar: AylikSatis[],
  yil: number,
  aySiraliListe: string[],
  gunMap: Map<string, number>,
  esikler: Esik[],
): SegmentMatrisSatiri[] {
  const bySube = new Map<string, Map<string, number>>();
  for (const s of satislar) {
    if (s.yil !== yil) continue;
    if (!bySube.has(s.sube_id)) bySube.set(s.sube_id, new Map());
    bySube.get(s.sube_id)!.set(s.ay, Number(s.kg) || 0);
  }

  const siraliEsikler = [...esikler].sort((a, b) => b.min - a.min);

  return subeler.map((sube) => {
    const kgMap = bySube.get(sube.id) ?? new Map<string, number>();
    const aySegment: Record<string, string> = {};
    const segmentIndexSeri: number[] = [];

    for (const ay of aySiraliListe) {
      if (!kgMap.has(ay)) continue;
      const gun = gunMap.get(`${yil}-${ay}`) ?? 30;
      const kgGunluk = (kgMap.get(ay) ?? 0) / gun;
      const eslesen = siraliEsikler.find((e) => kgGunluk >= e.min);
      if (eslesen) {
        aySegment[ay] = eslesen.ad;
        segmentIndexSeri.push(siraliEsikler.indexOf(eslesen));
      }
    }

    let netTrend = 0;
    for (let i = 1; i < segmentIndexSeri.length; i++) {
      // düşük index = daha iyi segment (esikler min'e göre büyükten küçüğe sıralı)
      if (segmentIndexSeri[i] < segmentIndexSeri[i - 1]) netTrend++;
      else if (segmentIndexSeri[i] > segmentIndexSeri[i - 1]) netTrend--;
    }

    return { subeId: sube.id, subeAd: sube.ad, bolge: sube.bolge, aySegment, netTrend };
  });
}

export interface PeriyotOzet {
  toplamKg: number;
  subeSayisi: number;
  kgGunluk: number;
}

/** İki dönem (ör. 2026 vs 2025, ya da bir ay vs önceki ay) arasındaki toplamları karşılaştırır. */
export function periyotOzetKarsilastir(
  subeler: Sube[],
  ozetA: Map<string, SubeKgOzet>,
  ozetB: Map<string, SubeKgOzet>,
  lfl: boolean,
): { a: PeriyotOzet; b: PeriyotOzet; farkKg: number; farkYuzde: number } {
  let idler = subeler.map((s) => s.id);
  if (lfl) {
    idler = idler.filter((id) => (ozetA.get(id)?.toplamKg ?? 0) > 0 && (ozetB.get(id)?.toplamKg ?? 0) > 0);
  }

  const topla = (m: Map<string, SubeKgOzet>): PeriyotOzet => {
    let toplamKg = 0;
    let toplamGun = 0;
    let subeSayisi = 0;
    for (const id of idler) {
      const o = m.get(id);
      if (!o || o.toplamKg <= 0) continue;
      toplamKg += o.toplamKg;
      toplamGun += o.toplamGun;
      subeSayisi++;
    }
    return { toplamKg, subeSayisi, kgGunluk: toplamGun > 0 ? toplamKg / toplamGun : 0 };
  };

  const a = topla(ozetA);
  const b = topla(ozetB);
  const farkKg = a.toplamKg - b.toplamKg;
  const farkYuzde = b.toplamKg > 0 ? (farkKg / b.toplamKg) * 100 : 0;

  return { a, b, farkKg, farkYuzde };
}

// ─── Genel Bakış hesapları ───────────────────────────────────────────────
// Eski panelin ayOzet/kumulatifOzet fonksiyonlarının birebir karşılığı.
// Dikkat: buradaki "ort" ŞUBE BAŞINA günlük ortalamadır — kg / (gün × açık şube) —
// subeKgOzetleri'ndeki şube bazlı kgGunluk ile aynı şey değildir.

export interface AyOzet {
  ay: string;
  kg: number;
  /** O ay veri girilmiş (açık) şube sayısı — 0 kg da açık sayılır. */
  acik: number;
  gun: number;
  /** Şube başına günlük ortalama: kg / (gün × açık şube). */
  ort: number;
}

/** Seçili ayların her biri için şirket toplamı (tip: "MS" | "FR" | null=tümü). */
export function aylikTrendHesapla(
  subeler: Sube[],
  satislar: AylikSatis[],
  yil: number,
  aylar: string[],
  gunMap: Map<string, number>,
  tip: "MS" | "FR" | null = null,
): AyOzet[] {
  const kapsam = tip ? subeler.filter((s) => s.tip === tip) : subeler;
  const idSet = new Set(kapsam.map((s) => s.id));

  const ayaGore = new Map<string, { kg: number; acik: number }>();
  for (const ay of aylar) ayaGore.set(ay, { kg: 0, acik: 0 });

  for (const s of satislar) {
    if (s.yil !== yil) continue;
    if (!idSet.has(s.sube_id)) continue;
    const g = ayaGore.get(s.ay);
    if (!g) continue;
    g.kg += Number(s.kg) || 0;
    g.acik++;
  }

  return aylar.map((ay) => {
    const g = ayaGore.get(ay)!;
    const gun = gunMap.get(`${yil}-${ay}`) ?? 30;
    return { ay, kg: g.kg, acik: g.acik, gun, ort: g.acik ? g.kg / (gun * g.acik) : 0 };
  });
}

export interface KumulatifOzet {
  kg: number;
  gun: number;
  ortAcik: number;
  ort: number;
  aktifSube: number;
  toplamSube: number;
}

/** Trend dizisinden kümülatif şirket özeti üretir. */
export function kumulatifOzetHesapla(
  subeler: Sube[],
  trend: AyOzet[],
  tip: "MS" | "FR" | null = null,
): KumulatifOzet {
  const kapsam = tip ? subeler.filter((s) => s.tip === tip) : subeler;
  const kg = trend.reduce((t, x) => t + x.kg, 0);
  const gun = trend.reduce((t, x) => t + x.gun, 0);
  const ortAcik = trend.length ? trend.reduce((t, x) => t + x.acik, 0) / trend.length : 0;

  return {
    kg,
    gun,
    ortAcik,
    ort: gun && ortAcik ? kg / (gun * ortAcik) : 0,
    aktifSube: kapsam.filter((s) => s.aktif).length,
    toplamSube: kapsam.length,
  };
}

export interface YoYAySatiri {
  ay: string;
  kgCari: number;
  kgOnceki: number;
  degisim: number | null;
}

/** Her ay için cari yıl ve önceki yıl toplamları + yüzde değişim. */
export function aylikYoYHesapla(
  subeler: Sube[],
  satislar: AylikSatis[],
  cariYil: number,
  oncekiYil: number,
  aylar: string[],
): YoYAySatiri[] {
  const idSet = new Set(subeler.map((s) => s.id));
  const cari = new Map<string, number>();
  const onceki = new Map<string, number>();
  for (const ay of aylar) {
    cari.set(ay, 0);
    onceki.set(ay, 0);
  }

  for (const s of satislar) {
    if (!idSet.has(s.sube_id)) continue;
    const hedef = s.yil === cariYil ? cari : s.yil === oncekiYil ? onceki : null;
    if (!hedef || !hedef.has(s.ay)) continue;
    hedef.set(s.ay, hedef.get(s.ay)! + (Number(s.kg) || 0));
  }

  return aylar.map((ay) => {
    const kgCari = cari.get(ay) ?? 0;
    const kgOnceki = onceki.get(ay) ?? 0;
    return {
      ay,
      kgCari,
      kgOnceki,
      degisim: kgOnceki > 0 ? (kgCari - kgOnceki) / kgOnceki : null,
    };
  });
}

/** Seçili aylarda önceki yıla ait verisi olan (o dönem açık olan) şube sayısı. */
export function acikSubeSayisi(
  subeler: Sube[],
  satislar: AylikSatis[],
  yil: number,
  aylar: string[],
): number {
  const aySet = new Set(aylar);
  const idSet = new Set(subeler.map((s) => s.id));
  const bulunan = new Set<string>();
  for (const s of satislar) {
    if (s.yil !== yil || !aySet.has(s.ay) || !idSet.has(s.sube_id)) continue;
    bulunan.add(s.sube_id);
  }
  return bulunan.size;
}

// ─── Ciro / maliyet / kâr ────────────────────────────────────────────────
// Eski panelin subeFiyat/birimMaliyet/subeCiro/ayCiroOzet karşılıkları.
// Not: bu bir VARSAYIM modelidir — gerçek fatura verisi değil, kg × birim fiyat.

/** Şubenin birim satış fiyatı (TL/kg) — tip + fiyat grubuna göre. */
export function subeFiyat(sube: Sube, model: FiyatModeli): number {
  const f = model.satis_fiyati ?? {};
  if (sube.tip === "MS") return f["MS"] ?? 0;
  return (sube.fiyat_grubu === "lojistik" ? f["FR_lojistik"] : f["FR_dagitim"]) ?? 0;
}

/** Bir ayın birim maliyeti (TL/kg) — aylık tanım yoksa varsayılan. */
export function birimMaliyet(ay: string, model: FiyatModeli): number {
  return model.birim_maliyet_aylik?.[ay] ?? model.birim_maliyet_varsayilan ?? 0;
}

export interface SubeCiro {
  subeId: string;
  kg: number;
  fiyat: number;
  ciro: number;
  maliyet: number;
  kar: number;
  marj: number;
}

/** Her şube için kümülatif ciro/maliyet/kâr. */
export function subeCiroHesapla(
  subeler: Sube[],
  satislar: AylikSatis[],
  yil: number,
  aylar: string[],
  model: FiyatModeli,
): Map<string, SubeCiro> {
  const aySet = new Set(aylar);
  const subeMap = new Map(subeler.map((s) => [s.id, s]));

  const sonuc = new Map<string, SubeCiro>();
  for (const s of subeler) {
    sonuc.set(s.id, {
      subeId: s.id,
      kg: 0,
      fiyat: subeFiyat(s, model),
      ciro: 0,
      maliyet: 0,
      kar: 0,
      marj: 0,
    });
  }

  for (const satir of satislar) {
    if (satir.yil !== yil || !aySet.has(satir.ay)) continue;
    const sube = subeMap.get(satir.sube_id);
    const hedef = sonuc.get(satir.sube_id);
    if (!sube || !hedef) continue;

    const kg = Number(satir.kg) || 0;
    hedef.kg += kg;
    hedef.ciro += kg * hedef.fiyat;
    hedef.maliyet += kg * birimMaliyet(satir.ay, model);
  }

  for (const c of sonuc.values()) {
    c.kar = c.ciro - c.maliyet;
    c.marj = c.ciro ? c.kar / c.ciro : 0;
  }
  return sonuc;
}

export interface AyCiro {
  ay: string;
  kg: number;
  ciro: number;
  maliyet: number;
  brutKar: number;
  marj: number;
}

/** Ay ay şirket ciro özeti (tip: "MS" | "FR" | null=tümü). */
export function aylikCiroHesapla(
  subeler: Sube[],
  satislar: AylikSatis[],
  yil: number,
  aylar: string[],
  model: FiyatModeli,
  tip: "MS" | "FR" | null = null,
): AyCiro[] {
  const kapsam = tip ? subeler.filter((s) => s.tip === tip) : subeler;
  const subeMap = new Map(kapsam.map((s) => [s.id, s]));

  const ayaGore = new Map<string, { kg: number; ciro: number; maliyet: number }>();
  for (const ay of aylar) ayaGore.set(ay, { kg: 0, ciro: 0, maliyet: 0 });

  for (const satir of satislar) {
    if (satir.yil !== yil) continue;
    const g = ayaGore.get(satir.ay);
    const sube = subeMap.get(satir.sube_id);
    if (!g || !sube) continue;

    const kg = Number(satir.kg) || 0;
    g.kg += kg;
    g.ciro += kg * subeFiyat(sube, model);
    g.maliyet += kg * birimMaliyet(satir.ay, model);
  }

  return aylar.map((ay) => {
    const g = ayaGore.get(ay)!;
    const brutKar = g.ciro - g.maliyet;
    return { ay, kg: g.kg, ciro: g.ciro, maliyet: g.maliyet, brutKar, marj: g.ciro ? brutKar / g.ciro : 0 };
  });
}

export interface CiroOzet {
  kg: number;
  ciro: number;
  maliyet: number;
  brutKar: number;
  sabit: number;
  netKar: number;
  marj: number;
}

/** Kümülatif ciro özeti — sabit gider aylık × ay sayısı düşülerek net kâr. */
export function kumulatifCiroOzet(trend: AyCiro[], model: FiyatModeli, aySayisi: number): CiroOzet {
  const ciro = trend.reduce((t, x) => t + x.ciro, 0);
  const maliyet = trend.reduce((t, x) => t + x.maliyet, 0);
  const kg = trend.reduce((t, x) => t + x.kg, 0);
  const brutKar = ciro - maliyet;
  const sabit = (model.sabit_gider_aylik || 0) * aySayisi;
  return {
    kg,
    ciro,
    maliyet,
    brutKar,
    sabit,
    netKar: brutKar - sabit,
    marj: ciro ? brutKar / ciro : 0,
  };
}

export function paraFmt(n: number, birim = "TL"): string {
  return `${new Intl.NumberFormat("tr-TR").format(Math.round(n))} ${birim}`;
}

export function yuzdeFmt(n: number): string {
  const isaret = n > 0 ? "+" : "";
  return `${isaret}${n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`;
}

export function kgFmt(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n)) + " kg";
}
