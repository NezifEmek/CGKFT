// Öneri sayfası sabitleri.
//
// DİKKAT: bunlar bilinçli olarak actions.ts'de değil burada. "use server"
// dosyasındaki HER ihraç sunucu eylemine dönüştürülür; oradan dizi/nesne
// ihraç edilirse istemcide gerçek değer değil eylem referansı görünür ve
// `.map(...)` çalışma anında patlar. Bkz. src/lib/plan.ts, src/lib/skor.ts.

export const KATEGORILER = [
  "Yazılım / Panel",
  "Süreç",
  "Şube Operasyonu",
  "Üretim",
  "Pazarlama",
  "İnsan Kaynakları",
  "Diğer",
] as const;

export const DURUMLAR = ["yeni", "inceleniyor", "planlandi", "yapildi", "reddedildi"] as const;
export const ONCELIKLER = ["dusuk", "orta", "yuksek"] as const;
