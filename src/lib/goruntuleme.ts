// goruntuleme.ts — "Şu kullanıcı gibi görüntüle" modu.
//
// Talep (Nezif): "Admin kullanıcısı olarak diğer kullanıcıların ekranlarının
// nasıl göründüğünü ve nasıl çalıştığını görmek istiyorum… hangi kişinin
// ekranını görüyorsam prim dahil her şeyi onun gördüğü gibi göreyim."
//
// ── Nasıl çalışıyor ───────────────────────────────────────────────────
// Admin bir kişi seçiyor, kimliği bir çerezde tutuluyor ve sunucu tarafı
// o kişinin profiliyle çalışıyor. Ekranlar, menü, kapsam ve prim — hepsi
// o kişinin gördüğü gibi geliyor.
//
// ── Neden SALT OKUNUR ─────────────────────────────────────────────────
// Oturum hâlâ admin'in oturumu; veritabanına giden her yazma admin
// kimliğiyle gider ama ekranda başkasının adı yazar. Bu durumda yapılan
// bir kayıt "kim yaptı" sorusunu kirletir. O yüzden bu moddayken TÜM
// yazma işlemleri kapalı.
//
// Engelleme tek noktadan yapılıyor: proxy (middleware) katmanında POST
// istekleri reddediliyor. Server action'ların hepsi POST olduğu için
// otuz küsur eylem dosyasına ayrı ayrı kontrol koymaya gerek kalmıyor —
// birini atlamak sessiz bir açık bırakırdı.

export const GORUNTULEME_CEREZI = "panel-goruntulenen";

/** Bu yollar görüntüleme modunda da POST kabul eder (moddan çıkış ve oturum). */
export const POST_SERBEST_YOLLAR = ["/goruntuleme", "/login", "/auth"];

export function postSerbestMi(yol: string): boolean {
  return POST_SERBEST_YOLLAR.some((y) => yol === y || yol.startsWith(y + "/"));
}

export interface GoruntulemeDurumu {
  /** Görüntülenen kişinin profil kimliği */
  hedefId: string;
  hedefAd: string;
  /** Gerçekte giriş yapmış admin */
  gercekId: string;
  gercekAd: string;
}
