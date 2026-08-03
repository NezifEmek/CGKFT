// Eski panelin assets/js/ui/kpi.js dosyasındaki hedef kurallarının birebir
// karşılığı. Kurallar eskiden kod içine dağılmış if'lerdeydi; burada okunabilir
// bir yapılandırma + tek bir hesaplayıcı olarak toplandı.
//
// Kişiler ve hedefler 2026-07-30'da güncel olarak teyit edildi.

import type { Sube, AylikSatis } from "@/types/database";
import type { Esik } from "./analytics";

/** Merkez yetkilisi olarak KPI'sı takip edilen kişiler. */
export const IZZET = "İZZET ALTUĞ";
export const BOLGE_YETKILILERI = ["UMUT CAN DOĞAN", "METİN BAŞOK"] as const;

/** Şikayetlerin söz verilen tarihte kapanma oranı hedefi (%). */
export const SIKAYET_SLA_HEDEFI = 90;

const AY_SIRASI = [
  "OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN",
  "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK",
];

/**
 * KPI kartlarındaki kişiler `subeler.merkez_yetkilisi` METNİNDEN geliyor,
 * şikayet görevlendirmeleri ise profil kimliğinden. İkisini eşleştirmek
 * için ad katlanıyor — faaliyet raporundaki franchise eşleştirmesinin
 * aynısı ("Umut Can Doğan" ↔ "UMUT CAN DOĞAN").
 */
export function kpiAdAnahtari(s: string): string {
  return s
    .toLocaleUpperCase("tr")
    .replace(/[İIıi]/g, "I")
    .replace(/Ö/g, "O").replace(/Ü/g, "U").replace(/Ş/g, "S")
    .replace(/Ç/g, "C").replace(/Ğ/g, "G")
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** KPI'ya şikayet sütunu eklemek için gereken veri. */
export interface KpiSikayetKaynak {
  sikayetler: {
    id: string;
    son_cozum_tarihi: string | null;
    cozuldu_at: string | null;
    kapatildi_at: string | null;
  }[];
  /** şikayet id → görevli profil kimlikleri */
  gorevliler: Map<string, string[]>;
  /** katlanmış ad → profil kimliği */
  adDanProfil: Map<string, string>;
}

export interface KpiHucre {
  ok: boolean;
  deger: string;
  hedef: string;
  /** Hedef yapısı gereği kendiliğinden sağlanmış (ör. tüm şubeler ★). */
  na?: boolean;
}

export interface KpiSutun {
  anahtar: string;
  etiket: string;
}

export interface KpiAySatiri {
  ay: string;
  hucreler: Record<string, KpiHucre | null>;
}

export interface KpiKarti {
  baslik: string;
  altBaslik: string;
  sutunlar: KpiSutun[];
  satirlar: KpiAySatiri[];
  skorTam: number;
  skorToplam: number;
}

const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(Math.round(n));
const fmt2 = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Şube × ay kg tablosu — undefined "o ay veri yok" demektir (0 kg'dan farklı). */
function kgTablosuKur(satislar: AylikSatis[], yil: number) {
  const m = new Map<string, Map<string, number>>();
  for (const s of satislar) {
    if (s.yil !== yil) continue;
    if (!m.has(s.sube_id)) m.set(s.sube_id, new Map());
    m.get(s.sube_id)!.set(s.ay, Number(s.kg) || 0);
  }
  return m;
}

export function kpiKartlariHesapla(
  subeler: Sube[],
  satislar: AylikSatis[],
  yil: number,
  aylar: string[],
  gunMap: Map<string, number>,
  esikler: Esik[],
  /** Verilmezse şikayet sütunu hiç eklenmez — eski davranış korunur. */
  sikayetKaynak?: KpiSikayetKaynak,
): KpiKarti[] {
  const kgTablo = kgTablosuKur(satislar, yil);
  // 0 = en iyi segment (★); esikler min'e göre büyükten küçüğe sıralanır.
  const siraliEsikler = [...esikler].sort((a, b) => b.min - a.min);
  const gun = (ay: string) => gunMap.get(`${yil}-${ay}`) ?? 30;

  const kg = (sube: Sube, ay: string) => kgTablo.get(sube.id)?.get(ay);

  /** Şubenin o aydaki segment indeksi; veri yoksa null. */
  const segIdx = (sube: Sube, ay: string): number | null => {
    const v = kg(sube, ay);
    if (v == null) return null;
    const ort = v / gun(ay);
    for (let i = 0; i < siraliEsikler.length; i++) if (ort >= siraliEsikler[i].min) return i;
    return siraliEsikler.length - 1;
  };

  const ayKg = (kapsam: Sube[], ay: string) =>
    kapsam.reduce((t, s) => t + (kg(s, ay) ?? 0), 0);

  const acikSayisi = (kapsam: Sube[], ay: string) =>
    kapsam.filter((s) => kg(s, ay) != null).length;

  /** Önceki 3 ayın kg ortalaması; 3 aydan az geçmiş varsa null. */
  const oncekiOrt = (kapsam: Sube[], ayIdx: number): number | null => {
    if (ayIdx < 3) return null;
    const toplam = aylar
      .slice(ayIdx - 3, ayIdx)
      .reduce((t, a) => t + ayKg(kapsam, a), 0);
    return toplam / 3;
  };

  /** Önceki aya göre segment hareketleri. */
  const segHareket = (kapsam: Sube[], ayIdx: number) => {
    if (ayIdx === 0) return null;
    const ay = aylar[ayIdx];
    const oncAy = aylar[ayIdx - 1];
    let yukselen = 0;
    let dusen = 0;
    let aktif = 0;
    let hepsiYildiz = true;

    for (const s of kapsam) {
      const iSu = segIdx(s, ay);
      const iOnc = segIdx(s, oncAy);
      if (iSu !== null) {
        aktif++;
        if (iSu !== 0) hepsiYildiz = false;
      }
      if (iSu === null || iOnc === null) continue;
      if (iSu < iOnc) yukselen++;
      if (iSu > iOnc) dusen++;
    }
    if (aktif === 0) hepsiYildiz = false;
    return { yukselen, dusen, hepsiYildiz };
  };

  /** Önceki aya göre şube açılış/kapanış (veri varlığına göre). */
  const subeHareket = (kapsam: Sube[], ayIdx: number) => {
    if (ayIdx === 0) return null;
    const ay = aylar[ayIdx];
    const oncAy = aylar[ayIdx - 1];
    let yeni = 0;
    let kapanan = 0;
    for (const s of kapsam) {
      const varSu = kg(s, ay) != null;
      const varOnc = kg(s, oncAy) != null;
      if (varSu && !varOnc) yeni++;
      if (!varSu && varOnc) kapanan++;
    }
    return { yeni, kapanan };
  };

  const miktarHucresi = (kapsam: Sube[], ay: string, ayIdx: number): KpiHucre | null => {
    const ort3 = oncekiOrt(kapsam, ayIdx);
    if (ort3 === null) return null;
    const bu = ayKg(kapsam, ay);
    return { ok: bu >= ort3, deger: `${fmt(bu)} kg`, hedef: `≥ ${fmt(ort3)} kg` };
  };

  const yukselisHucresi = (
    kapsam: Sube[],
    ayIdx: number,
    esik: number,
  ): KpiHucre | null => {
    const h = segHareket(kapsam, ayIdx);
    if (h === null) return null;
    if (h.hepsiYildiz) return { ok: true, na: true, deger: "★ Tamam", hedef: "tüm şubeler ★" };
    return { ok: h.yukselen >= esik, deger: `${h.yukselen} şube`, hedef: `≥ ${esik} şube` };
  };

  const dususHucresi = (kapsam: Sube[], ayIdx: number, ustSinir: number): KpiHucre | null => {
    const h = segHareket(kapsam, ayIdx);
    if (h === null) return null;
    return {
      ok: h.dusen <= ustSinir,
      deger: `${h.dusen} şube`,
      hedef: ustSinir === 0 ? "= 0" : `≤ ${ustSinir} şube`,
    };
  };

  function skorla(satirlar: KpiAySatiri[], sutunlar: KpiSutun[]) {
    let tam = 0;
    let toplam = 0;
    for (const satir of satirlar) {
      for (const s of sutunlar) {
        const h = satir.hucreler[s.anahtar];
        if (!h) continue;
        toplam++;
        if (h.ok) tam++;
      }
    }
    return { tam, toplam };
  }

  // ── Şikayet hücresi ─────────────────────────────────────────────────────
  //
  // Nezif: şikayet "KPI'ı etkilemeli". Ölçü olarak SLA seçildi: kişiye
  // atanan şikayetlerden kaçı söz verilen tarihte kapandı.
  //
  // Neden çözülen ADEDİ değil de ORAN: adet, şikayet sayısına bağlı. Az
  // şikayet gelen ay düşük, çok gelen ay yüksek çıkar; ikisi de kişinin
  // performansını anlatmaz. Oran "üstlendiğini zamanında bitirdi mi"
  // sorusunu cevaplıyor.
  //
  // O ay kişiye kapanmış hiç şikayet düşmediyse hücre NULL — "hedef
  // tutmadı" demek yanlış olurdu. Null hücreler skora da girmiyor.
  const sikayetHucresi = (yetkiliAdi: string, ay: string): KpiHucre | null => {
    if (!sikayetKaynak) return null;
    const profilId = sikayetKaynak.adDanProfil.get(kpiAdAnahtari(yetkiliAdi));
    if (!profilId) return null;

    const ayNo = String(AY_SIRASI.indexOf(ay) + 1).padStart(2, "0");
    if (ayNo === "00") return null;
    const onEk = `${yil}-${ayNo}`;

    const benim = sikayetKaynak.sikayetler.filter(
      (s) => sikayetKaynak.gorevliler.get(s.id)?.includes(profilId),
    );
    // O ay KAPANAN kayıtlar: ölçüm anı kapanış tarihidir.
    const kapananlar = benim.filter((s) => {
      const kapanis = s.cozuldu_at ?? s.kapatildi_at;
      return !!kapanis && kapanis.slice(0, 7) === onEk;
    });
    if (!kapananlar.length) return null;

    // Hedefi olmayan kayıt SLA ölçümüne girmez; tarih verilmemişse
    // "zamanında mı" sorusunun cevabı yok.
    //
    // Hiçbirinde tarih yoksa hücre NULL — "na: true" ile geçer saymak
    // yanlış olurdu: o, SLA alanını boş bırakmayı ÖDÜLLENDİRİR. Null
    // hücre skora hiç girmiyor. (Şikayet kaydında tarih boş bırakılırsa
    // önceliğe göre kendiliğinden atanıyor, bkz. varsayilanSlaTarihi.)
    const hedefli = kapananlar.filter((s) => !!s.son_cozum_tarihi);
    if (!hedefli.length) return null;
    const zamaninda = hedefli.filter((s) => {
      const kapanis = (s.cozuldu_at ?? s.kapatildi_at)!.slice(0, 10);
      return kapanis <= s.son_cozum_tarihi!.slice(0, 10);
    }).length;
    const oran = (zamaninda / hedefli.length) * 100;

    return {
      ok: oran >= SIKAYET_SLA_HEDEFI,
      deger: `%${Math.round(oran)} (${zamaninda}/${hedefli.length})`,
      hedef: `≥ %${SIKAYET_SLA_HEDEFI}`,
    };
  };

  const kartlar: KpiKarti[] = [];

  // ── İzzet Altuğ: miktar + segment yükseliş (≥1) + segment düşüş (=0) ─────
  {
    const kapsam = subeler.filter((s) => s.merkez_yetkilisi === IZZET);
    const sutunlar: KpiSutun[] = [
      { anahtar: "miktar", etiket: "Miktar" },
      { anahtar: "yukselis", etiket: "Segment Yükseliş" },
      { anahtar: "dusus", etiket: "Segment Düşüş" },
      ...(sikayetKaynak ? [{ anahtar: "sikayet", etiket: "Şikayet SLA" }] : []),
    ];
    const satirlar = aylar.map((ay, i) => ({
      ay,
      hucreler: {
        miktar: miktarHucresi(kapsam, ay, i),
        yukselis: yukselisHucresi(kapsam, i, 1),
        dusus: dususHucresi(kapsam, i, 0),
        ...(sikayetKaynak ? { sikayet: sikayetHucresi(IZZET, ay) } : {}),
      },
    }));
    const { tam, toplam } = skorla(satirlar, sutunlar);
    kartlar.push({
      baslik: IZZET,
      altBaslik: `${kapsam.length} şube`,
      sutunlar,
      satirlar,
      skorTam: tam,
      skorToplam: toplam,
    });
  }

  // ── Bölge yetkilileri: açılış (≥4) + kapanış (≤1) + miktar + yük. (≥5) + düş. (≤1)
  for (const yetkili of BOLGE_YETKILILERI) {
    const kapsam = subeler.filter((s) => s.merkez_yetkilisi === yetkili);
    const sutunlar: KpiSutun[] = [
      { anahtar: "acilis", etiket: "Şube Açılış" },
      { anahtar: "kapanis", etiket: "Şube Kapanış" },
      { anahtar: "miktar", etiket: "Miktar" },
      { anahtar: "yukselis", etiket: "Segment Yükseliş" },
      { anahtar: "dusus", etiket: "Segment Düşüş" },
      ...(sikayetKaynak ? [{ anahtar: "sikayet", etiket: "Şikayet SLA" }] : []),
    ];
    const satirlar = aylar.map((ay, i) => {
      const hareket = subeHareket(kapsam, i);
      return {
        ay,
        hucreler: {
          acilis: hareket
            ? { ok: hareket.yeni >= 4, deger: `+${hareket.yeni} şube`, hedef: "≥ 4 şube" }
            : null,
          kapanis: hareket
            ? { ok: hareket.kapanan <= 1, deger: `${hareket.kapanan} kapandı`, hedef: "≤ 1 şube" }
            : null,
          miktar: miktarHucresi(kapsam, ay, i),
          yukselis: yukselisHucresi(kapsam, i, 5),
          dusus: dususHucresi(kapsam, i, 1),
          ...(sikayetKaynak ? { sikayet: sikayetHucresi(yetkili, ay) } : {}),
        },
      };
    });
    const { tam, toplam } = skorla(satirlar, sutunlar);
    kartlar.push({
      baslik: yetkili,
      altBaslik: `${kapsam.length} şube`,
      sutunlar,
      satirlar,
      skorTam: tam,
      skorToplam: toplam,
    });
  }

  // ── Şirket geneli ────────────────────────────────────────────────────────
  {
    const kapsam = subeler;
    const eIdx = siraliEsikler.length - 1;
    const sutunlar: KpiSutun[] = [
      { anahtar: "miktar", etiket: "Miktar" },
      { anahtar: "subeArtis", etiket: "Şube Artışı" },
      { anahtar: "eAzalis", etiket: "E Segment Azalışı" },
      { anahtar: "yildiz", etiket: "★ Şube" },
      { anahtar: "ortKg", etiket: "Ort. kg/gün" },
    ];

    const satirlar = aylar.map((ay, i) => {
      const acik = acikSayisi(kapsam, ay);
      const ort = acik ? ayKg(kapsam, ay) / (gun(ay) * acik) : 0;

      let subeArtis: KpiHucre | null = null;
      let eAzalis: KpiHucre | null = null;
      if (i > 0) {
        const fark = acik - acikSayisi(kapsam, aylar[i - 1]);
        subeArtis = {
          ok: fark >= 6,
          deger: `${fark >= 0 ? "+" : ""}${fark} şube`,
          hedef: "≥ +6 şube",
        };

        const eSayisi = (a: string) =>
          kapsam.filter((s) => kg(s, a) != null && segIdx(s, a) === eIdx).length;
        const eOnceki = eSayisi(aylar[i - 1]);
        const eGuncel = eSayisi(ay);
        const azalis = eOnceki - eGuncel;
        eAzalis = {
          ok: azalis >= 2,
          deger: `${eOnceki}→${eGuncel} (${azalis >= 0 ? "−" : "+"}${Math.abs(azalis)})`,
          hedef: "≥ 2 azalış",
        };
      }

      const yildizSayisi = kapsam.filter((s) => kg(s, ay) != null && segIdx(s, ay) === 0).length;

      return {
        ay,
        hucreler: {
          miktar: miktarHucresi(kapsam, ay, i),
          subeArtis,
          eAzalis,
          yildiz: {
            ok: yildizSayisi >= 1,
            deger: `${yildizSayisi} ★ şube`,
            hedef: "≥ 1 ★",
          } satisfies KpiHucre,
          ortKg: {
            ok: ort >= 10,
            deger: `${fmt2(ort)} kg/gün`,
            hedef: "≥ 10,00",
          } satisfies KpiHucre,
        },
      };
    });

    const { tam, toplam } = skorla(satirlar, sutunlar);
    kartlar.push({
      baslik: "ŞİRKET GENELİ",
      altBaslik: `${kapsam.length} şube`,
      sutunlar,
      satirlar,
      skorTam: tam,
      skorToplam: toplam,
    });
  }

  return kartlar;
}
