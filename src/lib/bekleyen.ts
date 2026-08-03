// bekleyen.ts — "Bana ne düşüyor?" hesabı.
//
// ── Dikkat panelinden farkı ──────────────────────────────────────────────
// @/lib/dikkat ŞİRKET genelinde kaç iş bekliyor sorusunu sayıyla cevaplar
// ("2 öneri değerlendirilmedi"). Kullanıcı o sayıyı görüp ilgili ekrana
// gidiyor, orada kendi işini arıyordu.
//
// Burası KİŞİSEL: üzerine atanmış işleri tek tek, adıyla listeler.
// Nezif'in isteği: "kendisine atanan şikayet, franchise başvurusu gibi
// konuları ilgili kişi oradan görsün."
//
// ── Atama modeli her modülde aynı değil ──────────────────────────────────
// Şikayet ve toplantı görevi kişiye kimlikle (uuid) bağlı — kesin eşleşme.
// Franchise başvurusunda ise sorumlu bir METİN alanı (sirket_sorumlusu),
// profil kaydına bağlı değil. Bu yüzden ad karşılaştırması yapılıyor ve
// Türkçe harfler katlanıyor ("ERSİN KORAY" = "Ersin Koray"). Yazım farkı
// yüzünden eşleşmeyen kayıt sessizce kaybolmasın diye ekran, eşleşmeyi
// adla yaptığını açıkça yazar.

import { asciiKatla } from "@/lib/organizasyon";

export type BekleyenTuru = "sikayet" | "gorev" | "franchise" | "plan" | "onay";

export interface BekleyenKayit {
  id: string;
  baslik: string;
  aciklama: string;
  href: string;
  /** Son tarih (YYYY-AA-GG). Yoksa null. */
  termin: string | null;
  /** Pozitif: bu kadar gün geçti. Negatif: bu kadar gün kaldı. Null: termin yok. */
  gecikme: number | null;
  /** Durum rozeti */
  rozet: string;
  /** Sıralamada öne alınır */
  acil: boolean;
}

export interface BekleyenBolum {
  anahtar: BekleyenTuru;
  baslik: string;
  simge: string;
  aciklama: string;
  href: string;
  kayitlar: BekleyenKayit[];
}

// ─── Girdi tipleri ────────────────────────────────────────────────────────

export interface BekleyenGirdi {
  bugun: string;
  benimId: string;
  benimAdim: string;
  /** Erteleme onayı ve öneri kararı yalnızca yönetimde görünür */
  yonetimMi: boolean;

  sikayetler: {
    id: string;
    sikayet_no: string;
    kategori: string;
    aciklama: string;
    durum: string;
    oncelik: string;
    son_cozum_tarihi: string | null;
  }[];
  sikayetAtamalari: { sikayet_id: string; profil_id: string }[];

  gorevler: {
    id: string;
    baslik: string;
    aciklama: string;
    atanan_id: string;
    termin: string;
    durum: string;
  }[];

  franchiseler: {
    id: string;
    basvuru_no: string | null;
    isim: string;
    il: string;
    ilce: string;
    son_durum: string;
    sirket_sorumlusu: string;
    sorumlu_arama_tarihi: string | null;
    tarih: string;
  }[];

  planlar: {
    id: string;
    profil_id: string;
    hafta: string;
    gun: string | null;
    tur: string;
    baslik: string;
    durum: string | null;
    sube_adi?: string;
  }[];

  ertelemeler: {
    id: string;
    onay_durumu: string;
    gorev_basligi?: string;
  }[];

  oneriler: { id: string; baslik: string; durum: string }[];
}

const KAPALI_SIKAYET = ["cozuldu", "kapatildi", "iptal"];
const KAPALI_FRANCHISE = ["Kaybedildi", "Sözleşme / Açılış"];

const ONCELIK_ETIKET: Record<string, string> = {
  kritik: "kritik",
  yuksek: "yüksek",
  orta: "orta",
  dusuk: "düşük",
};

const PLAN_ETIKET: Record<string, string> = {
  ziyaret: "Ziyaret",
  denetim: "Denetim",
  toplanti: "Toplantı",
  egitim: "Eğitim",
  diger: "Diğer",
};

function gunFarki(a: string, b: string): number | null {
  const x = Date.parse(a.slice(0, 10) + "T00:00:00Z");
  const y = Date.parse(b.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Math.round((x - y) / 86400000);
}

function kisalt(s: string, n = 90): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/** Termin bilgisini "3 gün gecikti" / "yarın" gibi okunur yazar. */
export function gecikmeYaz(gecikme: number | null): string {
  if (gecikme == null) return "";
  if (gecikme > 1) return `${gecikme} gün gecikti`;
  if (gecikme === 1) return "1 gün gecikti";
  if (gecikme === 0) return "bugün son gün";
  if (gecikme === -1) return "yarın";
  return `${-gecikme} gün var`;
}

/**
 * Kişiye düşen işleri bölüm bölüm çıkarır.
 *
 * Boş bölüm ÜRETİLMEZ. "0 bekleyen şikayet" yazan bir kutu, bir süre sonra
 * bakılmayan bir kutuya dönüşür — dikkat panelindeki kuralın aynısı.
 */
export function bekleyenBolumler(g: BekleyenGirdi): BekleyenBolum[] {
  const { bugun, benimId } = g;
  const bolumler: BekleyenBolum[] = [];

  // ── Üstüme atanan şikayetler ────────────────────────────────────────
  const banaAtanan = new Set(
    g.sikayetAtamalari.filter((a) => a.profil_id === benimId).map((a) => a.sikayet_id),
  );
  const sikayetKayitlari: BekleyenKayit[] = g.sikayetler
    .filter((s) => banaAtanan.has(s.id) && !KAPALI_SIKAYET.includes(s.durum))
    .map((s) => {
      const gecikme = s.son_cozum_tarihi ? gunFarki(bugun, s.son_cozum_tarihi) : null;
      return {
        id: s.id,
        baslik: `${s.sikayet_no} · ${s.kategori || "Şikayet"}`,
        aciklama: kisalt(s.aciklama),
        href: "/sikayetler",
        termin: s.son_cozum_tarihi?.slice(0, 10) ?? null,
        gecikme,
        rozet: ONCELIK_ETIKET[s.oncelik] ?? s.oncelik,
        acil: (gecikme ?? -1) >= 0 || s.oncelik === "kritik",
      };
    });
  if (sikayetKayitlari.length) {
    bolumler.push({
      anahtar: "sikayet",
      baslik: "Üstüme atanan şikayetler",
      simge: "📣",
      aciklama: "Çözülmemiş ve size atanmış şikayetler",
      href: "/sikayetler",
      kayitlar: sirala(sikayetKayitlari),
    });
  }

  // ── Üstümdeki görevler ──────────────────────────────────────────────
  const gorevKayitlari: BekleyenKayit[] = g.gorevler
    .filter((t) => t.atanan_id === benimId && t.durum === "acik")
    .map((t) => {
      const gecikme = gunFarki(bugun, t.termin);
      return {
        id: t.id,
        baslik: t.baslik,
        aciklama: kisalt(t.aciklama),
        href: "/toplantilar",
        termin: t.termin.slice(0, 10),
        gecikme,
        rozet: "görev",
        acil: (gecikme ?? -1) >= 0,
      };
    });
  if (gorevKayitlari.length) {
    bolumler.push({
      anahtar: "gorev",
      baslik: "Üstümdeki görevler",
      simge: "✅",
      aciklama: "Toplantılarda size verilen, henüz kapatılmamış görevler",
      href: "/toplantilar",
      kayitlar: sirala(gorevKayitlari),
    });
  }

  // ── Takibimdeki franchise başvuruları ───────────────────────────────
  // Sorumlu alanı metin olduğu için ad karşılaştırması yapılıyor.
  const benimAd = asciiKatla(g.benimAdim);
  const franchiseKayitlari: BekleyenKayit[] = benimAd
    ? g.franchiseler
        .filter(
          (f) =>
            asciiKatla(f.sirket_sorumlusu) === benimAd &&
            !KAPALI_FRANCHISE.includes(f.son_durum),
        )
        .map((f) => {
          // Aranma tarihi varsa termin odur; yoksa başvurunun kendisi bekliyor.
          const bekleyenGun = gunFarki(bugun, f.sorumlu_arama_tarihi ?? f.tarih);
          const yer = [f.il, f.ilce].filter(Boolean).join(" / ");
          return {
            id: f.id,
            baslik: `${f.basvuru_no ? f.basvuru_no + " · " : ""}${f.isim}`,
            aciklama: yer ? `${yer} — ${f.son_durum}` : f.son_durum,
            href: "/franchise-basvurulari",
            termin: null,
            gecikme: null,
            rozet:
              bekleyenGun != null && bekleyenGun > 0
                ? `${bekleyenGun} gündür bekliyor`
                : f.son_durum,
            acil: f.son_durum === "Yeni Başvuru",
          };
        })
    : [];
  if (franchiseKayitlari.length) {
    bolumler.push({
      anahtar: "franchise",
      baslik: "Takibimdeki franchise başvuruları",
      simge: "📨",
      aciklama:
        "Şirket sorumlusu olarak siz yazılan, sonuçlanmamış başvurular. Eşleştirme ada göre yapılır.",
      href: "/franchise-basvurulari",
      kayitlar: franchiseKayitlari,
    });
  }

  // ── Bu haftaki planım ───────────────────────────────────────────────
  // Yalnızca sonucu işaretlenmemiş olanlar; yapıldı/yapılmadı denmişse iş bitmiş.
  const buHafta = haftaBasi(bugun);
  const planKayitlari: BekleyenKayit[] = g.planlar
    .filter((p) => p.profil_id === benimId && p.hafta.slice(0, 10) === buHafta && !p.durum)
    .map((p) => {
      const gecikme = p.gun ? gunFarki(bugun, p.gun) : null;
      return {
        id: p.id,
        baslik: p.sube_adi || p.baslik || PLAN_ETIKET[p.tur] || p.tur,
        aciklama: p.sube_adi && p.baslik ? p.baslik : "",
        href: "/haftalik-faaliyet",
        termin: p.gun?.slice(0, 10) ?? null,
        gecikme,
        rozet: PLAN_ETIKET[p.tur] ?? p.tur,
        acil: (gecikme ?? -1) > 0,
      };
    });
  if (planKayitlari.length) {
    bolumler.push({
      anahtar: "plan",
      baslik: "Bu haftaki planım",
      simge: "📅",
      aciklama: "Bu hafta için planlanıp henüz sonucu işaretlenmemiş işler",
      href: "/haftalik-faaliyet",
      kayitlar: sirala(planKayitlari),
    });
  }

  // ── Onayımı bekleyenler (yalnızca yönetim) ──────────────────────────
  if (g.yonetimMi) {
    const onayKayitlari: BekleyenKayit[] = [
      ...g.ertelemeler
        .filter((e) => e.onay_durumu === "bekliyor")
        .map((e) => ({
          id: e.id,
          baslik: e.gorev_basligi || "Görev erteleme talebi",
          aciklama: "Erteleme talebi onayınızı bekliyor",
          href: "/toplantilar",
          termin: null,
          gecikme: null,
          rozet: "erteleme",
          acil: true,
        })),
      ...g.oneriler
        .filter((o) => o.durum === "yeni")
        .map((o) => ({
          id: o.id,
          baslik: o.baslik,
          aciklama: "Öneri henüz değerlendirilmedi",
          href: "/oneriler",
          termin: null,
          gecikme: null,
          rozet: "öneri",
          acil: false,
        })),
    ];
    if (onayKayitlari.length) {
      bolumler.push({
        anahtar: "onay",
        baslik: "Kararımı bekleyenler",
        simge: "⚖️",
        aciklama: "Erteleme talepleri ve değerlendirilmemiş öneriler",
        href: "/oneriler",
        kayitlar: sirala(onayKayitlari),
      });
    }
  }

  return bolumler;
}

function sirala(k: BekleyenKayit[]): BekleyenKayit[] {
  return [...k].sort(
    (a, b) =>
      Number(b.acil) - Number(a.acil) ||
      (b.gecikme ?? -9999) - (a.gecikme ?? -9999) ||
      a.baslik.localeCompare(b.baslik, "tr"),
  );
}

/** Verilen günün içinde bulunduğu haftanın PAZARTESİsi (YYYY-AA-GG). */
export function haftaBasi(tarih: string): string {
  const d = new Date(tarih.slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return tarih.slice(0, 10);
  // getUTCDay: 0 pazar … 6 cumartesi. Pazar'ı önceki haftaya say.
  const gun = d.getUTCDay();
  const geri = gun === 0 ? 6 : gun - 1;
  d.setUTCDate(d.getUTCDate() - geri);
  return d.toISOString().slice(0, 10);
}

/** Tüm bölümlerdeki kayıt sayısı — başlıkta ve menüde gösterilir. */
export function bekleyenToplam(bolumler: BekleyenBolum[]): number {
  return bolumler.reduce((t, b) => t + b.kayitlar.length, 0);
}

/** Gecikmiş (termini geçmiş) kayıt sayısı. */
export function gecikmisToplam(bolumler: BekleyenBolum[]): number {
  return bolumler.reduce(
    (t, b) => t + b.kayitlar.filter((k) => (k.gecikme ?? -1) > 0).length,
    0,
  );
}
