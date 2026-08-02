// hafta.ts — Hafta hesapları.
//
// Şirkette hafta PAZARTESİ başlar, PAZAR biter. Haftalık plan cumartesi
// yapılıp gelecek hafta için girildiğinden, "bu hafta" ve "gelecek hafta"
// ayrımı ekranın merkezinde.
//
// Tarihler her yerde "YYYY-MM-DD" metni olarak taşınır. Date nesnesiyle
// saat dilimi kaydırması yaşamamak için karşılaştırmalar metin üzerinde
// yapılır; ISO biçimi zaten sözlük sırasıyla kronolojik sıradadır.

export interface Hafta {
  /** Pazartesi, YYYY-MM-DD */
  baslangic: string;
  /** Pazar, YYYY-MM-DD */
  bitis: string;
  /** "30 Haz – 6 Tem 2026" */
  etiket: string;
  /** ISO hafta numarası */
  no: number;
  yil: number;
}

const AY_KISA = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

function tariheCevir(gun: string): Date {
  // UTC olarak kur; yerel saat dilimi gün kaydırmasın.
  const [y, a, g] = gun.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (a ?? 1) - 1, g ?? 1));
}

function metneCevir(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Verilen günün içinde bulunduğu haftanın pazartesisi. */
export function haftaBasi(gun: string): string {
  const d = tariheCevir(gun);
  // getUTCDay: 0 pazar … 6 cumartesi. Pazartesi'ye kaç gün geri gidilecek?
  const geri = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - geri);
  return metneCevir(d);
}

export function gunEkle(gun: string, adet: number): string {
  const d = tariheCevir(gun);
  d.setUTCDate(d.getUTCDate() + adet);
  return metneCevir(d);
}

/** ISO 8601 hafta numarası (perşembe kuralı). */
export function haftaNo(gun: string): { no: number; yil: number } {
  const d = tariheCevir(haftaBasi(gun));
  // Haftanın perşembesi hangi yıla düşüyorsa hafta o yılındır.
  d.setUTCDate(d.getUTCDate() + 3);
  const yil = d.getUTCFullYear();
  const ocak4 = new Date(Date.UTC(yil, 0, 4));
  const ilkPerşembe = tariheCevir(haftaBasi(metneCevir(ocak4)));
  ilkPerşembe.setUTCDate(ilkPerşembe.getUTCDate() + 3);
  const fark = (d.getTime() - ilkPerşembe.getTime()) / (7 * 24 * 3600 * 1000);
  return { no: Math.round(fark) + 1, yil };
}

export function haftaKur(gun: string): Hafta {
  const baslangic = haftaBasi(gun);
  const bitis = gunEkle(baslangic, 6);
  const b = tariheCevir(baslangic);
  const s = tariheCevir(bitis);
  const { no, yil } = haftaNo(baslangic);

  const solAy = AY_KISA[b.getUTCMonth()];
  const sagAy = AY_KISA[s.getUTCMonth()];
  const etiket =
    b.getUTCFullYear() === s.getUTCFullYear()
      ? `${b.getUTCDate()} ${solAy} – ${s.getUTCDate()} ${sagAy} ${s.getUTCFullYear()}`
      : `${b.getUTCDate()} ${solAy} ${b.getUTCFullYear()} – ${s.getUTCDate()} ${sagAy} ${s.getUTCFullYear()}`;

  return { baslangic, bitis, etiket, no, yil };
}

/** Tarih bu haftanın içinde mi? (sınırlar dahil) */
export function haftadaMi(tarih: string | null | undefined, hafta: Hafta): boolean {
  if (!tarih) return false;
  const t = tarih.slice(0, 10);
  return t >= hafta.baslangic && t <= hafta.bitis;
}

export const GUN_ADLARI = [
  "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar",
];

/** Haftanın yedi günü, sırayla. */
export function haftaGunleri(hafta: Hafta): { tarih: string; ad: string }[] {
  return GUN_ADLARI.map((ad, i) => ({ tarih: gunEkle(hafta.baslangic, i), ad }));
}

/** "15.06.2026" */
export function tarihYaz(t: string | null | undefined): string {
  if (!t) return "";
  const [y, a, g] = t.slice(0, 10).split("-");
  return g && a && y ? `${g}.${a}.${y}` : t;
}

/** Seçici için son N hafta + gelecek hafta, en yeniden eskiye. */
export function haftaSecenekleri(bugun: string, geriye = 12): Hafta[] {
  const bu = haftaBasi(bugun);
  const liste: Hafta[] = [haftaKur(gunEkle(bu, 7))]; // gelecek hafta (plan için)
  for (let i = 0; i < geriye; i++) liste.push(haftaKur(gunEkle(bu, -7 * i)));
  return liste;
}
