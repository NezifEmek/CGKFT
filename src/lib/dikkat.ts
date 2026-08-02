// dikkat.ts — "Bugün neye bakmam lazım?" hesabı.
//
// Her modül kendi ekranında bekliyor; kimse hepsini tek tek dolaşmıyor.
// Burada YALNIZCA aksiyon gerektirenler toplanıyor: süresi geçen, kimseye
// atanmamış, onay bekleyen, unutulmuş kayıtlar.
//
// Tasarım kuralı: sayı sıfırsa satır hiç üretilmez. "0 geciken şikayet"
// yazan bir kutu, bir süre sonra bakılmayan bir kutuya dönüşür.

import type { DikkatSatiri } from "@/components/dikkat-paneli";

export interface DikkatGirdi {
  bugun: string;
  sikayetler: { id: string; durum: string; son_cozum_tarihi: string | null }[];
  sikayetAtamalari: { sikayet_id: string }[];
  sozlesmeler: { id: string; bitis: string | null; uyari_gun: number }[];
  gorevler: { id: string; durum: string; termin: string }[];
  ertelemeler: { id: string; onay_durumu: string }[];
  oneriler: { id: string; durum: string }[];
  /** Aktif şubeler ve son denetim tarihleri (yoksa null) */
  subeDenetimleri: { subeId: string; sonDenetim: string | null }[];
  /** Bu kadar gündür denetlenmeyen şube "unutulmuş" sayılır */
  denetimEsigiGun?: number;
}

const KAPALI_SIKAYET = ["cozuldu", "kapatildi", "iptal"];

function gunFarki(a: string, b: string): number {
  const x = Date.parse(a.slice(0, 10) + "T00:00:00Z");
  const y = Date.parse(b.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return Math.round((x - y) / 86400000);
}

export function dikkatSatirlari(g: DikkatGirdi): DikkatSatiri[] {
  const { bugun } = g;
  const esik = g.denetimEsigiGun ?? 90;
  const satirlar: DikkatSatiri[] = [];

  // ── Şikayetler ──────────────────────────────────────────────────────
  const acikSikayet = g.sikayetler.filter((s) => !KAPALI_SIKAYET.includes(s.durum));

  const gecikenSikayet = acikSikayet.filter(
    (s) => s.son_cozum_tarihi && s.son_cozum_tarihi.slice(0, 10) < bugun,
  ).length;
  if (gecikenSikayet) {
    satirlar.push({
      adet: gecikenSikayet,
      etiket: "şikayetin çözüm süresi geçti",
      href: "/sikayetler",
      acil: true,
    });
  }

  const atanmisSet = new Set(g.sikayetAtamalari.map((a) => a.sikayet_id));
  const atanmamis = acikSikayet.filter((s) => !atanmisSet.has(s.id)).length;
  if (atanmamis) {
    satirlar.push({
      adet: atanmamis,
      etiket: "açık şikayette görevli yok",
      href: "/sikayetler",
      acil: false,
      aciklama: "kimse üstlenmemiş",
    });
  }

  // ── Sözleşmeler ─────────────────────────────────────────────────────
  const dolan = g.sozlesmeler.filter(
    (s) => s.bitis && s.bitis.slice(0, 10) < bugun,
  ).length;
  if (dolan) {
    satirlar.push({
      adet: dolan,
      etiket: "sözleşmenin süresi doldu",
      href: "/subeler",
      acil: true,
    });
  }

  const yaklasan = g.sozlesmeler.filter((s) => {
    if (!s.bitis) return false;
    const kalan = gunFarki(s.bitis, bugun);
    return kalan >= 0 && kalan <= (s.uyari_gun ?? 90);
  }).length;
  if (yaklasan) {
    satirlar.push({
      adet: yaklasan,
      etiket: "sözleşmenin süresi yaklaşıyor",
      href: "/subeler",
      acil: false,
    });
  }

  // ── Görevler ────────────────────────────────────────────────────────
  const gecikenGorev = g.gorevler.filter(
    (t) => t.durum === "acik" && t.termin.slice(0, 10) < bugun,
  ).length;
  if (gecikenGorev) {
    satirlar.push({
      adet: gecikenGorev,
      etiket: "görevin termini geçti",
      href: "/toplantilar",
      acil: true,
    });
  }

  const bekleyenErteleme = g.ertelemeler.filter((e) => e.onay_durumu === "bekliyor").length;
  if (bekleyenErteleme) {
    satirlar.push({
      adet: bekleyenErteleme,
      etiket: "erteleme talebi onay bekliyor",
      href: "/toplantilar",
      acil: false,
      aciklama: "genel müdür onayı",
    });
  }

  // ── Denetim ─────────────────────────────────────────────────────────
  // YALNIZCA daha önce denetlenmiş olup üzerinden çok geçenler.
  //
  // "Hiç denetlenmemiş şube" kasten dışarıda: sisteme yalnızca son dönemin
  // denetimleri aktarıldığı için bu sayı yüzlerle ifade ediliyor ve ihmali
  // değil, veri kapsamını anlatıyor. Uyarı kutusunda her gün duran üç
  // haneli bir sayı, kutuyu bakılmaz hâle getirir. Denetim kapsamı ayrı
  // bir rapor konusu.
  const unutulan = g.subeDenetimleri.filter(
    (s) => s.sonDenetim && gunFarki(bugun, s.sonDenetim) > esik,
  ).length;
  if (unutulan) {
    satirlar.push({
      adet: unutulan,
      etiket: `şube ${esik} gündür denetlenmedi`,
      href: "/sube-denetimi",
      acil: false,
      aciklama: "son denetiminin üzerinden geçen süre",
    });
  }

  // ── Öneriler ────────────────────────────────────────────────────────
  const yeniOneri = g.oneriler.filter((o) => o.durum === "yeni").length;
  if (yeniOneri) {
    satirlar.push({
      adet: yeniOneri,
      etiket: "öneri değerlendirilmedi",
      href: "/oneriler",
      acil: false,
    });
  }

  // Acil olanlar önce, sonra adede göre.
  return satirlar.sort((a, b) => Number(b.acil) - Number(a.acil) || b.adet - a.adet);
}
