// toplanti.ts — Haftalık yönetim toplantısı: tipler ve iş kuralları.

export type ToplantiDurum = "planlaniyor" | "gundem_gonderildi" | "tamamlandi";
export type GorevDurum = "acik" | "tamamlandi" | "iptal";
export type OnayDurum = "bekliyor" | "onaylandi" | "reddedildi";

export const TOPLANTI_DURUM_ETIKET: Record<ToplantiDurum, string> = {
  planlaniyor: "Gündem toplanıyor",
  gundem_gonderildi: "Gündem paylaşıldı",
  tamamlandi: "Tamamlandı",
};

export const TOPLANTI_DURUM_RENK: Record<ToplantiDurum, string> = {
  planlaniyor: "#6b7280",
  gundem_gonderildi: "#2563eb",
  tamamlandi: "#16a34a",
};

export interface Toplanti {
  id: string;
  no: number;
  tarih: string;
  durum: ToplantiDurum;
  genel_not: string;
  katilimcilar: string[];
  gundem_gonderildi_at: string | null;
  sonuc_gonderildi_at: string | null;
  tamamlandi_at: string | null;
}

export interface Gundem {
  id: string;
  toplanti_id: string;
  sira: number;
  baslik: string;
  aciklama: string;
  ekleyen_id: string;
  toplanti_notu: string;
  karar: string;
}

export interface Gorev {
  id: string;
  toplanti_id: string;
  gundem_id: string | null;
  baslik: string;
  aciklama: string;
  atanan_id: string;
  termin: string;
  durum: GorevDurum;
  tamamlanma_tarihi: string | null;
  sonuc_notu: string;
}

export interface Erteleme {
  id: string;
  gorev_id: string;
  eski_termin: string;
  yeni_termin: string;
  gerekce: string;
  talep_eden_id: string;
  onay_durumu: OnayDurum;
  karar_notu: string;
}

const bugun = () => new Date().toISOString().slice(0, 10);

export function gecikmisMi(g: Gorev): boolean {
  return g.durum === "acik" && g.termin < bugun();
}

export function gecikmeGunu(g: Gorev): number {
  if (!gecikmisMi(g)) return 0;
  const fark = new Date(bugun()).getTime() - new Date(g.termin).getTime();
  return Math.floor(fark / 86400000);
}

/** Zamanında tamamlandı mı — KPI'nın temel ölçüsü. */
export function zamanindaMi(g: Gorev): boolean | null {
  if (g.durum !== "tamamlandi" || !g.tamamlanma_tarihi) return null;
  return g.tamamlanma_tarihi <= g.termin;
}

export interface KisiPerformansi {
  atanan_id: string;
  toplam: number;
  tamamlanan: number;
  zamaninda: number;
  geciken: number;
  acik: number;
  gecikmisAcik: number;
  ertelemeSayisi: number;
  /** Tamamlananlar içinde zamanında bitenlerin oranı (0–1). */
  basariOrani: number | null;
}

/**
 * Kişi bazlı görev performansı — Nezif'in "görev tamamlama başarısı kişinin
 * KPI'sına girsin" isteğinin karşılığı.
 *
 * Başarı oranı yalnızca TAMAMLANAN görevler üzerinden hesaplanır; henüz açık
 * olan görevler kimseyi cezalandırmaz, ama gecikmiş açık görevler ayrıca
 * gösterilir (görmezden gelinmesin diye).
 */
export function kisiPerformanslari(
  gorevler: Gorev[],
  ertelemeler: Erteleme[],
): Map<string, KisiPerformansi> {
  const onayliErteleme = new Map<string, number>();
  for (const e of ertelemeler) {
    if (e.onay_durumu !== "onaylandi") continue;
    onayliErteleme.set(e.gorev_id, (onayliErteleme.get(e.gorev_id) ?? 0) + 1);
  }

  const sonuc = new Map<string, KisiPerformansi>();
  for (const g of gorevler) {
    if (g.durum === "iptal") continue;
    if (!sonuc.has(g.atanan_id)) {
      sonuc.set(g.atanan_id, {
        atanan_id: g.atanan_id,
        toplam: 0, tamamlanan: 0, zamaninda: 0, geciken: 0,
        acik: 0, gecikmisAcik: 0, ertelemeSayisi: 0, basariOrani: null,
      });
    }
    const k = sonuc.get(g.atanan_id)!;
    k.toplam++;
    k.ertelemeSayisi += onayliErteleme.get(g.id) ?? 0;
    if (g.durum === "tamamlandi") {
      k.tamamlanan++;
      if (zamanindaMi(g)) k.zamaninda++;
      else k.geciken++;
    } else {
      k.acik++;
      if (gecikmisMi(g)) k.gecikmisAcik++;
    }
  }
  for (const k of sonuc.values()) {
    k.basariOrani = k.tamamlanan ? k.zamaninda / k.tamamlanan : null;
  }
  return sonuc;
}

/** Bir görevin kaç kez ERTELENDİĞİ (yalnızca onaylanmış talepler). */
export function ertelemeSayisi(gorevId: string, ertelemeler: Erteleme[]): number {
  return ertelemeler.filter((e) => e.gorev_id === gorevId && e.onay_durumu === "onaylandi").length;
}

export function bekleyenErteleme(gorevId: string, ertelemeler: Erteleme[]): Erteleme | undefined {
  return ertelemeler.find((e) => e.gorev_id === gorevId && e.onay_durumu === "bekliyor");
}

/**
 * Gündem ve sonuç "gönderimi". Bugün e-posta altyapısı yok; gönderim panel
 * içinde kayda geçiyor ve metin dışa aktarılabiliyor. E-posta eklendiğinde
 * yalnızca bu fonksiyonun içi dolacak, çağıran yerler değişmeyecek.
 */
export type GonderimYontemi = "panel" | "eposta";

export function gundemMetni(
  t: Toplanti,
  gundemler: Gundem[],
  adlar: Map<string, string>,
): string {
  const satir = [`${t.no}. YÖNETİM TOPLANTISI — GÜNDEM`, `Tarih: ${t.tarih}`, ""];
  gundemler
    .slice()
    .sort((a, b) => a.sira - b.sira)
    .forEach((g, i) => {
      satir.push(`${i + 1}. ${g.baslik}`);
      if (g.aciklama.trim()) satir.push(`   ${g.aciklama.trim()}`);
      satir.push(`   Ekleyen: ${adlar.get(g.ekleyen_id) ?? "—"}`);
      satir.push("");
    });
  if (!gundemler.length) satir.push("(henüz gündem maddesi eklenmemiş)");
  return satir.join("\n");
}

export function sonucMetni(
  t: Toplanti,
  gundemler: Gundem[],
  gorevler: Gorev[],
  adlar: Map<string, string>,
): string {
  const satir = [`${t.no}. YÖNETİM TOPLANTISI — KARARLAR VE GÖREVLER`, `Tarih: ${t.tarih}`, ""];
  gundemler
    .slice()
    .sort((a, b) => a.sira - b.sira)
    .forEach((g, i) => {
      satir.push(`${i + 1}. ${g.baslik}`);
      if (g.toplanti_notu.trim()) satir.push(`   Not: ${g.toplanti_notu.trim()}`);
      if (g.karar.trim()) satir.push(`   KARAR: ${g.karar.trim()}`);
      const bagli = gorevler.filter((x) => x.gundem_id === g.id);
      for (const x of bagli) {
        satir.push(`   → Görev: ${x.baslik} | ${adlar.get(x.atanan_id) ?? "—"} | termin ${x.termin}`);
      }
      satir.push("");
    });

  const bagimsiz = gorevler.filter((x) => !x.gundem_id);
  if (bagimsiz.length) {
    satir.push("GÜNDEM DIŞI GÖREVLER");
    for (const x of bagimsiz) {
      satir.push(`   → ${x.baslik} | ${adlar.get(x.atanan_id) ?? "—"} | termin ${x.termin}`);
    }
    satir.push("");
  }
  if (t.genel_not.trim()) satir.push(`GENEL NOT: ${t.genel_not.trim()}`);
  return satir.join("\n");
}
