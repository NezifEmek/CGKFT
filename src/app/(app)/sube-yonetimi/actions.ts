"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { koordinatCoz } from "@/lib/konum";
import { hataMesaji } from "@/lib/hata";

/** Formdan gelen şube alanlarını okur (ekle ve güncelle ortak). */
function alanlariOku(formData: FormData, bolgeKilidi: string | null) {
  const metin = (ad: string) => String(formData.get(ad) ?? "").trim();
  const tarih = (ad: string) => {
    const v = metin(ad);
    return v ? v : null;
  };

  const tip = metin("tip") === "MS" ? "MS" : "FR";
  const fiyatGrubuHam = metin("fiyat_grubu");

  // İletişim alanları yalnızca formda VARSA yazılır. Aksi halde bu alanları
  // içermeyen bir kayıt işlemi (ör. eski bir form, içe aktarma) mevcut
  // telefon/adres bilgisini boşa çekerdi — sessiz veri kaybı.
  const iletisim: Record<string, unknown> = {};
  if (formData.has("harita_url")) {
    // Kullanıcı Google Maps bağlantısını yapıştırır, koordinatı biz çıkarırız.
    // Çıkaramazsak (kısa link) bağlantı yine saklanır.
    const haritaUrl = metin("harita_url");
    const koordinat = koordinatCoz(haritaUrl);
    iletisim.harita_url = haritaUrl;
    iletisim.enlem = koordinat?.enlem ?? null;
    iletisim.boylam = koordinat?.boylam ?? null;
  }
  for (const alan of ["telefon", "yetkili_telefon", "eposta", "adres", "iletisim_notu"]) {
    if (formData.has(alan)) iletisim[alan] = metin(alan);
  }

  return {
    ...iletisim,
    ad: metin("ad"),
    tip,
    bolge: bolgeKilidi ?? metin("bolge") ?? "",
    il: metin("il"),
    ilce: metin("ilce"),
    kod: metin("kod"),
    merkez_yetkilisi: metin("merkez_yetkilisi"),
    sube_yetkilisi: metin("sube_yetkilisi"),
    il_sube_sirasi: metin("il_sube_sirasi"),
    aktif: formData.get("aktif") === "on",
    acilis_tarihi: tarih("acilis_tarihi"),
    kapanis_tarihi: tarih("kapanis_tarihi"),
    acilis_tahmini: formData.get("acilis_tahmini") === "on",
    // fiyat_grubu yalnızca FR için anlamlı; MŞ'de null olmalı (şema check kısıtı).
    fiyat_grubu:
      tip === "FR" ? (fiyatGrubuHam === "lojistik" ? "lojistik" : "dagitim") : null,
  };
}

/**
 * Veritabanı hatasını kullanıcının anlayacağı dile çevirir.
 *
 * Yetki reddi "new row violates row-level security policy" diye geliyordu;
 * kullanıcı bundan ne yapması gerektiğini çıkaramıyor. 2026-08-04'te
 * "yeni şube ekleyemiyorlar" sorunu tam olarak bu yüzden günlerce
 * teşhis edilemedi.
 */
function subeHatasi(
  mesaj: string,
  guncelleme: boolean,
  alanlar: { bolge: string; merkez_yetkilisi: string; kod: string },
): string {
  if (/row-level security|row level security/i.test(mesaj)) {
    return (
      `Bu şubeyi ${guncelleme ? "güncelleme" : "ekleme"} yetkiniz yok. ` +
      `Şube "${alanlar.bolge}" bölgesine, merkez yetkilisi "${
        alanlar.merkez_yetkilisi || "(boş)"
      }" olarak kaydedilmek isteniyor. ` +
      `Sık görülen iki sebep: (1) kullanıcı ayarlarınızda yazma izni kapalı olabilir, ` +
      `(2) kapsamınız o bölgeyi kapsamıyor olabilir. ` +
      `Yeni şube açıyorsanız "Merkez Yetkilisi" alanına kendi adınızı yazmak çoğu durumda yeterlidir. ` +
      `Yetkiler Kullanıcılar ekranından yönetilir.`
    );
  }
  if (/duplicate key/i.test(mesaj)) {
    return `"${alanlar.kod}" kodu başka bir şubede kullanılıyor. Kodu değiştirin.`;
  }
  // Geri kalan her şey ortak çeviriciye — zorunlu alan, biçim, bağlı kayıt…
  return hataMesaji(mesaj, guncelleme ? "Güncellenemedi" : "Eklenemedi");
}

export async function subeKaydet(_onceki: { hata?: string; ok?: boolean } | null, formData: FormData) {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") {
    return { hata: "Bu işlem için yetkiniz yok." };
  }

  const supabase = await createClient();
  const bolgeKilidi = profile.rol === "bolge_muduru" ? profile.bolge : null;
  const alanlar = alanlariOku(formData, bolgeKilidi);

  if (!alanlar.ad) return { hata: "Şube adı zorunlu." };
  if (!alanlar.bolge) return { hata: "Bölge zorunlu." };

  const subeId = String(formData.get("sube_id") ?? "").trim();

  const { error } = subeId
    ? await supabase.from("subeler").update({ ...alanlar, updated_at: new Date().toISOString() }).eq("id", subeId)
    : await supabase.from("subeler").insert(alanlar);

  if (error) return { hata: subeHatasi(error.message, Boolean(subeId), alanlar) };

  revalidatePath("/sube-yonetimi");
  revalidatePath("/subeler");
  revalidatePath("/");
  return { hata: undefined, ok: true };
}

export async function subeSil(_onceki: { hata?: string; ok?: boolean } | null, formData: FormData) {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Şube silme yetkisi yalnızca Admin/Genel Müdür'dedir." };
  }

  const subeId = String(formData.get("sube_id") ?? "").trim();
  if (!subeId) return { hata: "Şube seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("subeler").delete().eq("id", subeId);
  if (error) return { hata: hataMesaji(error.message, "Silinemedi") };

  revalidatePath("/sube-yonetimi");
  revalidatePath("/subeler");
  revalidatePath("/");
  return { hata: undefined, ok: true };
}
