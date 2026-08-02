// konum.ts — Google Maps bağlantısından koordinat çıkarma.
//
// Kullanıcı haritadan "Paylaş → Bağlantıyı kopyala" ile ne kopyalarsa
// yapıştırabilsin istiyoruz. Google birkaç ayrı biçim üretiyor:
//
//   .../maps/place/Ad/@40.7659,29.9169,17z/...   → @ işaretinden sonra
//   .../maps?q=40.7659,29.9169                   → q parametresi
//   .../maps/place/40.7659,29.9169               → yol içinde
//   .../maps/...!3d40.7659!4d29.9169             → gömülü harita biçimi
//   https://maps.app.goo.gl/xxxx                 → KISA LİNK, çözülemez
//   40.7659, 29.9169                             → elle yapıştırılan koordinat
//
// Kısa linkler (goo.gl) yalnızca Google'a istek atılarak çözülebilir; bunu
// yapmıyoruz. O durumda bağlantı olduğu gibi saklanır, koordinat boş kalır —
// harita düğmesi yine çalışır, sadece mesafe hesabı yapılamaz.

export interface Koordinat {
  enlem: number;
  boylam: number;
}

const ENLEM_SINIR = 90;
const BOYLAM_SINIR = 180;

function gecerli(enlem: number, boylam: number): boolean {
  return (
    Number.isFinite(enlem) &&
    Number.isFinite(boylam) &&
    Math.abs(enlem) <= ENLEM_SINIR &&
    Math.abs(boylam) <= BOYLAM_SINIR &&
    // 0,0 Gine Körfezi'nde bir nokta; pratikte "boş" demektir.
    !(enlem === 0 && boylam === 0)
  );
}

/** Google Maps bağlantısından (veya düz "enlem, boylam" metninden) koordinat çıkarır. */
export function koordinatCoz(girdi: string): Koordinat | null {
  const s = (girdi ?? "").trim();
  if (!s) return null;

  const desenler: RegExp[] = [
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // .../@40.76,29.91,17z
    /[?&](?:q|ll|center|daddr|sll)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ?q=40.76,29.91
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, // gömülü harita
    /\/(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // /place/40.76,29.91
    /^(-?\d{1,3}\.\d+)\s*[,;]\s*(-?\d{1,3}\.\d+)$/, // elle yapıştırılan
  ];

  for (const desen of desenler) {
    const eslesme = s.match(desen);
    if (!eslesme) continue;
    const enlem = Number(eslesme[1]);
    const boylam = Number(eslesme[2]);
    if (gecerli(enlem, boylam)) {
      return { enlem: Number(enlem.toFixed(7)), boylam: Number(boylam.toFixed(7)) };
    }
  }
  return null;
}

/** Şubeyi haritada açacak bağlantı. Elde ne varsa onunla en iyisini üretir. */
export function haritaBaglantisi(kaynak: {
  harita_url?: string | null;
  enlem?: number | string | null;
  boylam?: number | string | null;
  ad?: string | null;
  adres?: string | null;
  il?: string | null;
  ilce?: string | null;
}): string | null {
  const url = (kaynak.harita_url ?? "").trim();
  if (url) return url;

  const enlem = kaynak.enlem == null ? NaN : Number(kaynak.enlem);
  const boylam = kaynak.boylam == null ? NaN : Number(kaynak.boylam);
  if (gecerli(enlem, boylam)) {
    return `https://www.google.com/maps/search/?api=1&query=${enlem},${boylam}`;
  }

  // Koordinat yoksa adresle arat.
  const parcalar = [kaynak.ad, kaynak.adres, kaynak.ilce, kaynak.il].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  if (!parcalar.length) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parcalar.join(" "))}`;
}

/** Telefonu okunur biçime getirir: 5321234567 → 0532 123 45 67 */
export function telefonBicimle(ham: string | null | undefined): string {
  const rakamlar = (ham ?? "").replace(/\D/g, "");
  if (!rakamlar) return "";

  let n = rakamlar;
  if (n.startsWith("90") && n.length === 12) n = n.slice(2);
  if (n.length === 11 && n.startsWith("0")) n = n.slice(1);
  if (n.length !== 10) return (ham ?? "").trim(); // tanımadığımız biçimi bozma

  return `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)}`;
}

/** tel: bağlantısı için sadeleştirilmiş numara. */
export function telefonLinki(ham: string | null | undefined): string {
  const rakamlar = (ham ?? "").replace(/\D/g, "");
  if (!rakamlar) return "";
  if (rakamlar.length === 10) return `+90${rakamlar}`;
  if (rakamlar.length === 11 && rakamlar.startsWith("0")) return `+90${rakamlar.slice(1)}`;
  if (rakamlar.length === 12 && rakamlar.startsWith("90")) return `+${rakamlar}`;
  return `+${rakamlar}`;
}
