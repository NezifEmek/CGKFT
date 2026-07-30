// Hızlı Skor Girişi sabitleri — eski panelin assets/js/ui/skorgiris.js karşılığı.
//
// DİKKAT: bunlar bilinçli olarak actions.ts'de değil burada. "use server"
// dosyasındaki her ihraç sunucu eylemi olarak dönüştürülür; oradan bir dizi
// ihraç edilirse istemci tarafında dizi değil bir eylem referansı görünür
// (SKOR_TURLERI.map is not a function hatası bu yüzden çıkıyordu).

export const SKOR_TURLERI = ["Gizli Müşteri", "Denetim", "Ziyaret"] as const;

export type SkorTuru = (typeof SKOR_TURLERI)[number];

export const TUR_IKON: Record<string, string> = {
  "Gizli Müşteri": "🕵️",
  Denetim: "📋",
  Ziyaret: "👋",
};

export const TUR_RENK: Record<string, string> = {
  "Gizli Müşteri": "#6366f1",
  Denetim: "#f59e0b",
  Ziyaret: "#10b981",
};

/** Eski paneldeki puanRenk() eşikleri. */
export function puanRenk(p: number): string {
  return p >= 85 ? "#10b981" : p >= 70 ? "#22c55e" : p >= 55 ? "#f59e0b" : "#ef4444";
}
