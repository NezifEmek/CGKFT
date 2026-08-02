// Haftalık plan sabitleri.
//
// DİKKAT: bunlar bilinçli olarak actions.ts'de değil burada. "use server"
// dosyasındaki HER ihraç sunucu eylemine dönüştürülür; oradan bir dizi ya da
// nesne ihraç edilirse istemci tarafında gerçek değer değil bir eylem
// referansı görünür ve `.map(...)` çağrısı çalışma anında patlar.
//
// Aynı hata daha önce hızlı skor ekranında yaşandı (bkz. src/lib/skor.ts);
// haftalık faaliyet ve öneri ekranlarında tekrarlandı. Kural: "use server"
// dosyalarından yalnızca async fonksiyon ihraç et.

export const PLAN_TURLERI = ["ziyaret", "denetim", "toplanti", "egitim", "diger"] as const;
export type PlanTuru = (typeof PLAN_TURLERI)[number];

export const TUR_ETIKET: Record<string, string> = {
  ziyaret: "Ziyaret",
  denetim: "Denetim",
  toplanti: "Toplantı",
  egitim: "Eğitim",
  diger: "Diğer",
};
