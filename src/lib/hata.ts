// hata.ts — Veritabanı hatalarını kullanıcının anlayacağı Türkçeye çevirir.
//
// ── Neden var ────────────────────────────────────────────────────────────
// Nezif: "Tüm ekranlarda kullanıcılara verilen hata uyarıları çok net
// Türkçe ve anlaşılır olmalı. Sürekli bana sormak zorunda kalmasınlar ve
// esas hatayı anlayıp düzeltsinler."
//
// Ekranlar hataları "Kaydedilemedi: " + error.message diye gösteriyordu.
// Kullanıcının gördüğü şey şuydu:
//
//   Kaydedilemedi: new row violates row-level security policy for table "subeler"
//   Kaydedilemedi: duplicate key value violates unique constraint "subeler_kod_key"
//
// Bu mesajlar kullanıcıya ne yapacağını söylemiyor. 2026-08-04'te "yeni
// şube ekleyemiyorlar" sorunu tam olarak bu yüzden günlerce teşhis
// edilemedi — ekran sebebi biliyordu ama anlatmıyordu.
//
// ── Tasarım kuralı ───────────────────────────────────────────────────────
// Her mesaj üç şeyi söyler: NE OLDU, NEDEN, NE YAPILMALI. Teknik ayrıntı
// (kısıt adı, tablo adı) parantez içinde en sonda kalır — kullanıcı
// gerekirse bize iletebilsin diye; ama cümlenin başında durup okunmayı
// engellemez.

/**
 * Hangi işlem yapılırken hata aldık — tanınmayan hatada mesajın başına geçer.
 * Yaygın değerler: "Kaydedilemedi", "Güncellenemedi", "Silinemedi",
 * "Eklenemedi", "Okunamadı". Ekrana özel metin de verilebilir
 * ("Denetim kaydedilemedi" gibi).
 */
export type Islem = string;

/** Kısıt adından okunabilir alan adı türetmeye çalışır. */
function kisitAdi(ham: string): string | null {
  const m = /constraint "([^"]+)"/i.exec(ham);
  return m ? m[1] : null;
}

function tabloAdi(ham: string): string | null {
  const m = /(?:table|relation) "([^"]+)"/i.exec(ham);
  return m ? m[1] : null;
}

/** Teknik ayrıntıyı cümlenin sonuna, parantez içine koyar. */
function teknik(ham: string): string {
  const k = kisitAdi(ham);
  const t = tabloAdi(ham);
  const parca = [k && `kural: ${k}`, !k && t && `tablo: ${t}`].filter(Boolean);
  return parca.length ? ` (${parca.join(", ")})` : "";
}

/**
 * Bilinen veritabanı hatalarını Türkçeye çevirir.
 * Tanımadığı hatada null döner; çağıran ham mesajı gösterebilir.
 */
function ceviri(ham: string): string | null {
  const h = ham.toLowerCase();

  // ── Yetki ───────────────────────────────────────────────────────────
  if (h.includes("row-level security") || h.includes("row level security")) {
    return (
      "Bu kaydı değiştirme yetkiniz yok. Kaydın bağlı olduğu şube ya da bölge " +
      "sizin yetki kapsamınızın dışında olabilir; ya da kullanıcı ayarlarınızda " +
      "yazma izni kapalı olabilir. Yetkiler Kullanıcılar ekranından yönetilir."
    );
  }
  if (h.includes("permission denied")) {
    return (
      "Bu işlem için veritabanı izniniz yok. Yöneticinize bildirin — " +
      "kullanıcı yetkilerinin gözden geçirilmesi gerekiyor."
    );
  }
  if (h.includes("jwt") && (h.includes("expired") || h.includes("invalid"))) {
    return "Oturumunuzun süresi dolmuş. Çıkış yapıp yeniden giriş yapın.";
  }

  // ── Eksik tablo / sütun: migration çalıştırılmamış ──────────────────
  if (/relation .* does not exist/i.test(ham) || h.includes("schema cache")) {
    const t = tabloAdi(ham);
    return (
      `Bu ekranın kullandığı veritabanı tablosu henüz oluşturulmamış${
        t ? ` (${t})` : ""
      }. Kurulum SQL dosyalarından biri çalıştırılmamış olabilir; yöneticinize bildirin.`
    );
  }
  if (/column .* does not exist/i.test(ham) || /could not find the '.*' column/i.test(ham)) {
    return (
      "Veritabanında olması gereken bir alan eksik. Yazılım güncellendi ama " +
      "veritabanı güncellemesi çalıştırılmamış olabilir; yöneticinize bildirin." +
      teknik(ham)
    );
  }

  // ── Benzersizlik ────────────────────────────────────────────────────
  if (h.includes("duplicate key")) {
    const k = kisitAdi(ham) ?? "";
    if (/kod/i.test(k)) {
      return "Bu kod başka bir kayıtta kullanılıyor. Farklı bir kod girin.";
    }
    if (/eposta|email/i.test(k)) {
      return "Bu e-posta adresi zaten kayıtlı. Farklı bir e-posta girin.";
    }
    if (/tekil|unique/i.test(k)) {
      return (
        "Aynı kayıt zaten var. Aynı dönem/kişi için ikinci bir kayıt açılamaz; " +
        "mevcut kaydı düzenleyin." + teknik(ham)
      );
    }
    return "Bu kayıt zaten var. Aynı bilgilerle ikinci bir kayıt eklenemez." + teknik(ham);
  }

  // ── Zorunlu alan ────────────────────────────────────────────────────
  if (h.includes("not-null constraint") || h.includes("null value in column")) {
    const m = /column "([^"]+)"/i.exec(ham);
    return `Zorunlu bir alan boş bırakılmış${m ? `: "${m[1]}"` : ""}. Doldurup tekrar deneyin.`;
  }

  // ── Değer kuralları ─────────────────────────────────────────────────
  if (h.includes("check constraint")) {
    return (
      "Girilen değerlerden biri kabul edilen aralığın dışında ya da seçeneklerden " +
      "biri değil. Alanları gözden geçirip tekrar deneyin." + teknik(ham)
    );
  }
  if (h.includes("foreign key constraint")) {
    // Silme mi ekleme mi olduğu mesajdan anlaşılıyor.
    if (h.includes("still referenced") || h.includes("update or delete")) {
      return (
        "Bu kayıt başka kayıtlarda kullanıldığı için silinemiyor. Önce ona bağlı " +
        "kayıtları silin ya da başka bir kayda taşıyın." + teknik(ham)
      );
    }
    return (
      "Seçilen ilgili kayıt bulunamadı (silinmiş olabilir). Listeyi yenileyip " +
      "yeniden seçin." + teknik(ham)
    );
  }

  // ── Biçim ───────────────────────────────────────────────────────────
  if (h.includes("invalid input syntax")) {
    if (h.includes("numeric") || h.includes("integer") || h.includes("double")) {
      return "Sayı beklenen bir alana sayı olmayan bir değer girilmiş. Rakam girin.";
    }
    if (h.includes("date") || h.includes("timestamp")) {
      return "Tarih alanı okunamadı. Tarihi gg.aa.yyyy biçiminde seçin.";
    }
    if (h.includes("uuid")) {
      return "Seçim geçersiz. Listeyi yenileyip yeniden seçin.";
    }
    return "Girilen değerlerden biri beklenen biçimde değil. Alanları gözden geçirin.";
  }
  if (h.includes("value too long")) {
    return "Girdiğiniz metin çok uzun. Kısaltıp tekrar deneyin.";
  }
  if (h.includes("numeric field overflow")) {
    return "Girilen sayı çok büyük. Değeri kontrol edin.";
  }

  // ── Depolama ────────────────────────────────────────────────────────
  if (h.includes("bucket not found")) {
    return "Dosya deposu bulunamadı. Kurulum tamamlanmamış; yöneticinize bildirin.";
  }
  if (h.includes("payload too large") || h.includes("entity too large")) {
    return "Dosya çok büyük. Daha küçük bir dosya seçin.";
  }

  // ── Hesap işlemleri (Supabase Auth İngilizce döner) ─────────────────
  if (h.includes("user already registered") || h.includes("email address is already")) {
    return "Bu e-posta adresiyle zaten bir kullanıcı var. Mevcut kullanıcıyı düzenleyin.";
  }
  if (h.includes("password should be at least") || h.includes("password is too short")) {
    return "Şifre çok kısa. En az 6 karakter olmalı.";
  }
  if (h.includes("weak password") || h.includes("password is known to be weak")) {
    return "Şifre çok kolay tahmin edilebilir. Harf, rakam ve işaret karıştırın.";
  }
  if (h.includes("invalid email") || h.includes("unable to validate email")) {
    return "E-posta adresi geçersiz görünüyor. Yazımını kontrol edin.";
  }
  if (h.includes("invalid login credentials")) {
    return "E-posta ya da şifre hatalı.";
  }
  if (h.includes("email rate limit") || h.includes("too many requests") || h.includes("rate limit")) {
    return "Çok sık denendi. Birkaç dakika bekleyip tekrar deneyin.";
  }
  if (h.includes("user not found")) {
    return "Kullanıcı bulunamadı. Listeyi yenileyip tekrar deneyin.";
  }

  // ── Ağ ──────────────────────────────────────────────────────────────
  if (h.includes("failed to fetch") || h.includes("network") || h.includes("timeout")) {
    return "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
  }

  return null;
}

/**
 * Kullanıcıya gösterilecek hata metni.
 *
 * @param ham   Veritabanından gelen özgün mesaj.
 * @param islem Ne yapılmaya çalışılıyordu.
 *
 * Tanınan hatalarda işlem adı BAŞA EKLENMEZ: "Silinemedi: Bu kayıt başka
 * kayıtlarda kullanıldığı için silinemiyor" gibi tekrar okunmasın diye.
 * Tanınmayan hatada işlem adı + ham mesaj gösterilir; kullanıcı en azından
 * ne yapmaya çalıştığını ve ham metni bize iletebilir.
 */
export function hataMesaji(ham: string | null | undefined, islem: Islem = "İşlenemedi"): string {
  const metin = String(ham ?? "").trim();
  if (!metin) return `${islem}. Sebep belirlenemedi, lütfen tekrar deneyin.`;

  const cevrilmis = ceviri(metin);
  if (cevrilmis) return cevrilmis;

  return `${islem}. Teknik ayrıntı: ${metin}`;
}
