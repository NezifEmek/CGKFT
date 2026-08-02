"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SAYFALAR } from "@/lib/yetkiler";
import { SIKAYET_ROLLERI } from "@/lib/sikayet-rol";

type Sonuc = { hata?: string; ok?: string };

const KAPSAMLAR = ["rol", "tum", "bolge", "tip", "secili", "yetkili"];
const GECERLI_ANAHTARLAR = new Set(SAYFALAR.map((s) => s.anahtar));

async function adminOl() {
  const profile = await requireProfile();
  if (profile.rol !== "admin") throw new Error("Bu işlem için admin yetkisi gerekir.");
  return profile;
}

export async function yetkiKaydet(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const ben = await adminOl();
  const admin = createAdminClient();

  const id = String(formData.get("kullanici_id") || "");
  if (!id) return { hata: "Kullanıcı seçili değil." };

  const kapsamTuru = String(formData.get("kapsam_turu") || "rol");
  if (!KAPSAMLAR.includes(kapsamTuru)) return { hata: "Geçersiz kapsam." };

  const kapsamTipiHam = String(formData.get("kapsam_tipi") || "");
  const kapsamTipi = kapsamTipiHam === "MS" || kapsamTipiHam === "FR" ? kapsamTipiHam : null;
  if (kapsamTuru === "tip" && !kapsamTipi) {
    return { hata: "Şube tipine göre kapsam için MŞ veya FR seçmelisiniz." };
  }

  const bolge = String(formData.get("bolge") || "").trim();
  if (kapsamTuru === "bolge" && !bolge) {
    return { hata: "Bölge kapsamı için bir bölge seçmelisiniz." };
  }

  const kapsamYetkilisi = String(formData.get("kapsam_yetkilisi") || "").trim();
  if (kapsamTuru === "yetkili" && !kapsamYetkilisi) {
    return { hata: "Sorumluluk kapsamı için bir şube sorumlusu seçmelisiniz." };
  }

  const yazabilir = formData.get("yazabilir") === "1";

  // Sayfa yetkileri: hiç işaretlenmemişse boş dizi = rolün varsayılanı.
  const sayfalar = formData
    .getAll("sayfa")
    .map((x) => String(x))
    .filter((x) => GECERLI_ANAHTARLAR.has(x));

  // Kendi adminliğini kısıtlayıp paneli kilitleme.
  if (id === ben.id && sayfalar.length && !sayfalar.includes("kullanicilar")) {
    return {
      hata: "Kendi yetkilerinizden Kullanıcılar ekranını çıkaramazsınız — yetkilendirmeye erişiminizi kaybedersiniz.",
    };
  }

  // Şikayet rolü: boş bırakılabilir, o zaman genel rolden türetilir.
  const sikayetRoluHam = String(formData.get("sikayet_rolu") || "").trim();
  if (sikayetRoluHam && !(SIKAYET_ROLLERI as readonly string[]).includes(sikayetRoluHam)) {
    return { hata: "Geçersiz şikayet rolü." };
  }

  const { error } = await admin
    .from("profiles")
    .update({
      kapsam_turu: kapsamTuru,
      kapsam_tipi: kapsamTuru === "tip" ? kapsamTipi : null,
      kapsam_yetkilisi: kapsamTuru === "yetkili" ? kapsamYetkilisi : null,
      pozisyon_id: String(formData.get("pozisyon_id") || "").trim() || null,
      bolge: kapsamTuru === "bolge" ? bolge : (bolge || null),
      sikayet_rolu: sikayetRoluHam || null,
      yazabilir,
      sayfa_yetkileri: sayfalar,
    })
    .eq("id", id);

  if (error) {
    if (/sikayet_rolu/.test(error.message)) {
      return { hata: "Şikayet rolü alanı veritabanında yok. 0016_sikayet_rol.sql çalıştırılmalı." };
    }
    if (/column .* does not exist/i.test(error.message)) {
      return {
        hata: "Yetki alanları veritabanında yok. 0004_yetkilendirme.sql çalıştırılmalı.",
      };
    }
    return { hata: "Kaydedilemedi: " + error.message };
  }

  revalidatePath("/kullanicilar");
  revalidatePath("/", "layout");
  return { ok: "Yetkiler kaydedildi" };
}

/** kapsam_turu = 'secili' için kullanıcının görebileceği şubeler. */
export async function subeKapsamiKaydet(
  _onceki: Sonuc | null,
  formData: FormData,
): Promise<Sonuc> {
  await adminOl();
  const admin = createAdminClient();

  const id = String(formData.get("kullanici_id") || "");
  if (!id) return { hata: "Kullanıcı seçili değil." };

  const subeIdler = formData.getAll("sube").map((x) => String(x)).filter(Boolean);

  const { error: silHata } = await admin.from("sube_erisim").delete().eq("profil_id", id);
  if (silHata) return { hata: "Eski kapsam temizlenemedi: " + silHata.message };

  if (subeIdler.length) {
    const { error } = await admin
      .from("sube_erisim")
      .insert(subeIdler.map((sid) => ({ profil_id: id, sube_id: sid })));
    if (error) return { hata: "Şube kapsamı kaydedilemedi: " + error.message };
  }

  revalidatePath("/kullanicilar");
  return { ok: `${subeIdler.length} şube atandı` };
}
