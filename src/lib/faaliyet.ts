// faaliyet.ts — Kişi bazlı haftalık faaliyet raporunun hesabı.
//
// Rapor hiçbir şeyi ayrıca kaydetmez; her satırı kaynak modülden okur:
//
//   Denetim / Hızlı skor  → denetimler, skorlar          (denetmen_id / olusturan_id)
//   Franchise araması     → franchise_basvurulari        (sirket_sorumlusu ADIYLA)
//   Toplantı katılımı     → toplantilar.katilimcilar
//   Görev                 → toplanti_gorevleri           (atanan_id)
//   Öneri                 → oneriler                     (ekleyen_id)
//   Plan                  → haftalik_plan                (profil_id)
//
// Franchise kaydında sorumlu bir profil kimliği değil, serbest METİN.
// O yüzden eşleştirme ada göre yapılıyor ve Türkçe yazım farklarına
// dayanıklı olması için asciiKatla'dan geçiriliyor ("Ümran Balci" ↔
// "ÜMRAN BALCI"). Eşleşmeyen kayıt kimseye atfedilmez — yanlış kişiye
// yazmaktansa raporda görünmemesi doğru.

import { haftadaMi, type Hafta } from "./hafta";
import { asciiKatla } from "./organizasyon";

export interface DenetimSatir {
  id: string;
  sube_id: string;
  denetmen_id: string;
  tarih: string;
  puan: number | string | null;
}
export interface SkorSatir {
  id: string;
  sube_id: string;
  olusturan_id: string;
  tarih: string;
  puan: number | string | null;
}
export interface FranchiseSatir {
  id: string;
  basvuru_no: string | null;
  isim: string;
  sirket_sorumlusu: string | null;
  sorumlu_arama_tarihi: string | null;
  memnuniyet_arama_tarihi: string | null;
  son_durum: string;
}
export interface ToplantiSatir {
  id: string;
  no: number;
  tarih: string;
  katilimcilar: unknown;
}
export interface GorevSatir {
  id: string;
  baslik: string;
  atanan_id: string;
  termin: string;
  durum: string;
  tamamlanma_tarihi: string | null;
  created_at: string;
}
export interface OneriSatir {
  id: string;
  baslik: string;
  ekleyen_id: string;
  created_at: string;
}
export interface PlanSatir {
  id: string;
  profil_id: string;
  hafta: string;
  gun: string | null;
  tur: string;
  sube_id: string | null;
  baslik: string;
  aciklama: string;
  durum: string | null;
  durum_notu: string;
}

export interface FaaliyetKaynak {
  denetimler: DenetimSatir[];
  skorlar: SkorSatir[];
  franchise: FranchiseSatir[];
  toplantilar: ToplantiSatir[];
  gorevler: GorevSatir[];
  oneriler: OneriSatir[];
  plan: PlanSatir[];
  subeAdlari: Map<string, string>;
}

export interface SubeZiyaret {
  subeId: string;
  subeAdi: string;
  tarih: string;
  puan: number | null;
  tur: "denetim" | "skor";
}

export interface PlanSatirSonuc extends PlanSatir {
  subeAdi: string;
  /** Kayıtlardan otomatik anlaşıldı mı? */
  otomatikGerceklesti: boolean;
  /** Elle işaret varsa o, yoksa otomatik sonuç. */
  sonuc: "gerceklesti" | "gerceklesmedi" | "ertelendi";
}

export interface KisiFaaliyet {
  profilId: string;
  ad: string;

  ziyaretler: SubeZiyaret[];
  franchiseAramalari: { id: string; etiket: string; tarih: string; tur: string; durum: string }[];
  toplantilar: { id: string; no: number; tarih: string }[];
  tamamlananGorevler: GorevSatir[];
  acilanGorevler: GorevSatir[];
  /** Termini geçmiş, hâlâ açık görevler (hafta sonuna göre) */
  gecikenGorevler: GorevSatir[];
  oneriler: OneriSatir[];

  plan: PlanSatirSonuc[];
  planToplam: number;
  planGerceklesen: number;
  /** Planlanmadığı hâlde yapılan ziyaretler */
  plansizZiyaret: number;

  /** Haftanın toplam faaliyet sayısı — sıralama ve "hiç faaliyet yok" için */
  toplamFaaliyet: number;
}

function sayi(x: number | string | null): number | null {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/** toplantilar.katilimcilar jsonb'si; profil kimliği listesi ya da ad listesi olabilir. */
function katilimcilariCoz(ham: unknown): { kimlikler: Set<string>; adlar: Set<string> } {
  const kimlikler = new Set<string>();
  const adlar = new Set<string>();
  if (!Array.isArray(ham)) return { kimlikler, adlar };
  for (const k of ham) {
    if (typeof k === "string") {
      // uuid mi ad mı?
      if (/^[0-9a-f-]{36}$/i.test(k)) kimlikler.add(k);
      else adlar.add(asciiKatla(k));
    } else if (k && typeof k === "object") {
      const o = k as Record<string, unknown>;
      if (typeof o.id === "string") kimlikler.add(o.id);
      if (typeof o.ad_soyad === "string") adlar.add(asciiKatla(o.ad_soyad));
      if (typeof o.ad === "string") adlar.add(asciiKatla(o.ad));
    }
  }
  return { kimlikler, adlar };
}

/**
 * Bir haftanın faaliyetini kişi kişi çıkarır.
 *
 * @param kisiler Raporda yer alacak kişiler. Görünürlük süzgeci ÇAĞIRAN
 *   tarafta uygulanır; burada verilen herkes rapora girer.
 */
export function haftalikFaaliyet(
  hafta: Hafta,
  kisiler: { id: string; ad_soyad: string }[],
  kaynak: FaaliyetKaynak,
): KisiFaaliyet[] {
  const adIle = new Map<string, string>(); // katlanmış ad → profil id
  for (const k of kisiler) {
    const a = asciiKatla(k.ad_soyad || "");
    if (a) adIle.set(a, k.id);
  }

  const bos = (): Omit<KisiFaaliyet, "profilId" | "ad"> => ({
    ziyaretler: [],
    franchiseAramalari: [],
    toplantilar: [],
    tamamlananGorevler: [],
    acilanGorevler: [],
    gecikenGorevler: [],
    oneriler: [],
    plan: [],
    planToplam: 0,
    planGerceklesen: 0,
    plansizZiyaret: 0,
    toplamFaaliyet: 0,
  });

  const sonuc = new Map<string, KisiFaaliyet>();
  for (const k of kisiler) {
    sonuc.set(k.id, { profilId: k.id, ad: k.ad_soyad || "(adsız)", ...bos() });
  }
  const al = (id: string | null | undefined) => (id ? sonuc.get(id) : undefined);

  // ─── Denetim ve hızlı skor ─────────────────────────────────────────────
  for (const d of kaynak.denetimler) {
    if (!haftadaMi(d.tarih, hafta)) continue;
    al(d.denetmen_id)?.ziyaretler.push({
      subeId: d.sube_id,
      subeAdi: kaynak.subeAdlari.get(d.sube_id) ?? "(bilinmeyen şube)",
      tarih: d.tarih.slice(0, 10),
      puan: sayi(d.puan),
      tur: "denetim",
    });
  }
  for (const s of kaynak.skorlar) {
    if (!haftadaMi(s.tarih, hafta)) continue;
    al(s.olusturan_id)?.ziyaretler.push({
      subeId: s.sube_id,
      subeAdi: kaynak.subeAdlari.get(s.sube_id) ?? "(bilinmeyen şube)",
      tarih: s.tarih.slice(0, 10),
      puan: sayi(s.puan),
      tur: "skor",
    });
  }

  // ─── Franchise aramaları (ada göre eşleşir) ────────────────────────────
  for (const f of kaynak.franchise) {
    const kisiId = adIle.get(asciiKatla(f.sirket_sorumlusu ?? ""));
    const k = al(kisiId);
    if (!k) continue;
    const etiket = `${f.basvuru_no ? f.basvuru_no + " · " : ""}${f.isim}`;
    if (haftadaMi(f.sorumlu_arama_tarihi, hafta)) {
      k.franchiseAramalari.push({
        id: f.id + "-a",
        etiket,
        tarih: f.sorumlu_arama_tarihi!.slice(0, 10),
        tur: "Başvuru araması",
        durum: f.son_durum,
      });
    }
    if (haftadaMi(f.memnuniyet_arama_tarihi, hafta)) {
      k.franchiseAramalari.push({
        id: f.id + "-m",
        etiket,
        tarih: f.memnuniyet_arama_tarihi!.slice(0, 10),
        tur: "Memnuniyet araması",
        durum: f.son_durum,
      });
    }
  }

  // ─── Toplantı katılımı ─────────────────────────────────────────────────
  for (const t of kaynak.toplantilar) {
    if (!haftadaMi(t.tarih, hafta)) continue;
    const { kimlikler, adlar } = katilimcilariCoz(t.katilimcilar);
    for (const kisi of kisiler) {
      if (kimlikler.has(kisi.id) || adlar.has(asciiKatla(kisi.ad_soyad || ""))) {
        al(kisi.id)?.toplantilar.push({ id: t.id, no: t.no, tarih: t.tarih.slice(0, 10) });
      }
    }
  }

  // ─── Görevler ──────────────────────────────────────────────────────────
  for (const g of kaynak.gorevler) {
    const k = al(g.atanan_id);
    if (!k) continue;
    if (g.durum === "tamamlandi" && haftadaMi(g.tamamlanma_tarihi, hafta)) {
      k.tamamlananGorevler.push(g);
    }
    if (haftadaMi(g.created_at, hafta)) k.acilanGorevler.push(g);
    // Hafta sonu itibarıyla termini geçmiş ve hâlâ açık.
    if (g.durum === "acik" && g.termin.slice(0, 10) < hafta.bitis) {
      k.gecikenGorevler.push(g);
    }
  }

  // ─── Öneriler ──────────────────────────────────────────────────────────
  for (const o of kaynak.oneriler) {
    if (!haftadaMi(o.created_at, hafta)) continue;
    al(o.ekleyen_id)?.oneriler.push(o);
  }

  // ─── Plan ve gerçekleşme ───────────────────────────────────────────────
  for (const p of kaynak.plan) {
    if (p.hafta.slice(0, 10) !== hafta.baslangic) continue;
    const k = al(p.profil_id);
    if (!k) continue;

    // Plandaki şube o hafta gerçekten ziyaret edilmiş mi?
    const otomatik = p.sube_id
      ? k.ziyaretler.some((z) => z.subeId === p.sube_id)
      : false;

    k.plan.push({
      ...p,
      subeAdi: p.sube_id ? (kaynak.subeAdlari.get(p.sube_id) ?? "(bilinmeyen şube)") : p.baslik,
      otomatikGerceklesti: otomatik,
      sonuc:
        (p.durum as PlanSatirSonuc["sonuc"] | null) ??
        (otomatik ? "gerceklesti" : "gerceklesmedi"),
    });
  }

  // ─── Toplamlar ─────────────────────────────────────────────────────────
  for (const k of sonuc.values()) {
    k.ziyaretler.sort((a, b) => a.tarih.localeCompare(b.tarih));
    k.plan.sort((a, b) => (a.gun ?? "9").localeCompare(b.gun ?? "9"));

    k.planToplam = k.plan.length;
    k.planGerceklesen = k.plan.filter((p) => p.sonuc === "gerceklesti").length;

    const planlananSubeler = new Set(k.plan.map((p) => p.sube_id).filter(Boolean) as string[]);
    k.plansizZiyaret = new Set(
      k.ziyaretler.filter((z) => !planlananSubeler.has(z.subeId)).map((z) => z.subeId),
    ).size;

    k.toplamFaaliyet =
      k.ziyaretler.length +
      k.franchiseAramalari.length +
      k.toplantilar.length +
      k.tamamlananGorevler.length +
      k.oneriler.length;
  }

  return [...sonuc.values()].sort(
    (a, b) => b.toplamFaaliyet - a.toplamFaaliyet || a.ad.localeCompare(b.ad, "tr"),
  );
}

/** Rapor metni — e-posta/WhatsApp'a yapıştırmalık düz metin. */
export function faaliyetMetni(hafta: Hafta, kisiler: KisiFaaliyet[]): string {
  const s: string[] = [];
  s.push(`HAFTALIK FAALİYET RAPORU`);
  s.push(`${hafta.etiket}  (${hafta.yil} / ${hafta.no}. hafta)`);
  s.push("");

  for (const k of kisiler) {
    if (!k.toplamFaaliyet && !k.planToplam) continue;
    s.push(`── ${k.ad} ${"─".repeat(Math.max(0, 46 - k.ad.length))}`);

    if (k.planToplam) {
      s.push(`  Plan: ${k.planGerceklesen}/${k.planToplam} gerçekleşti`);
      for (const p of k.plan) {
        const isaret = p.sonuc === "gerceklesti" ? "✔" : p.sonuc === "ertelendi" ? "↻" : "✘";
        s.push(`    ${isaret} ${p.subeAdi}${p.gun ? ` (${p.gun.slice(8, 10)}.${p.gun.slice(5, 7)})` : ""}`);
      }
    }
    if (k.ziyaretler.length) {
      s.push(`  Ziyaret / denetim: ${k.ziyaretler.length}`);
      for (const z of k.ziyaretler) {
        s.push(`    • ${z.tarih.slice(8, 10)}.${z.tarih.slice(5, 7)} ${z.subeAdi}${z.puan != null ? ` — ${z.puan} puan` : ""}`);
      }
    }
    if (k.franchiseAramalari.length) {
      s.push(`  Franchise araması: ${k.franchiseAramalari.length}`);
      for (const f of k.franchiseAramalari) s.push(`    • ${f.etiket} (${f.tur})`);
    }
    if (k.toplantilar.length) s.push(`  Toplantı katılımı: ${k.toplantilar.map((t) => `#${t.no}`).join(", ")}`);
    if (k.tamamlananGorevler.length) {
      s.push(`  Tamamlanan görev: ${k.tamamlananGorevler.length}`);
      for (const g of k.tamamlananGorevler) s.push(`    ✔ ${g.baslik}`);
    }
    if (k.gecikenGorevler.length) {
      s.push(`  GECİKEN GÖREV: ${k.gecikenGorevler.length}`);
      for (const g of k.gecikenGorevler) s.push(`    ! ${g.baslik} (termin ${g.termin})`);
    }
    if (k.oneriler.length) s.push(`  Öneri: ${k.oneriler.length}`);
    s.push("");
  }

  const hicYok = kisiler.filter((k) => !k.toplamFaaliyet && !k.planToplam);
  if (hicYok.length) {
    s.push(`Bu hafta kaydı olmayanlar (${hicYok.length}): ${hicYok.map((k) => k.ad).join(", ")}`);
  }
  return s.join("\n");
}
