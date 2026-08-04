"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Rol } from "@/types/database";
import { hataMesaji } from "@/lib/hata";

type Sonuc = { hata?: string; ok?: string };

const ROLLER: Rol[] = ["admin", "genel_mudur", "bolge_muduru", "denetmen"];

/** Süresiz engelleme — Supabase'de "devre dışı kullanıcı" bunun karşılığı. */
const SURESIZ_ENGEL = "876000h"; // ~100 yıl

async function adminOl() {
  const profile = await requireProfile();
  if (profile.rol !== "admin") throw new Error("Bu işlem için admin yetkisi gerekir.");
  return profile;
}

/** Son admini kaybetmemek için: bu kullanıcı dışında admin kalıyor mu? */
async function baskaAdminVarMi(haricId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id").eq("rol", "admin");
  return (data ?? []).some((p) => p.id !== haricId);
}

export async function profilGuncelle(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const ben = await adminOl();
  const admin = createAdminClient();

  const id = String(formData.get("kullanici_id") || "");
  if (!id) return { hata: "Kullanıcı seçili değil." };

  const adSoyad = String(formData.get("ad_soyad") || "").trim();
  const rolHam = String(formData.get("rol") || "");
  const rol = (ROLLER as string[]).includes(rolHam) ? (rolHam as Rol) : null;
  if (!rol) return { hata: "Geçersiz rol." };

  const bolge = String(formData.get("bolge") || "").trim();

  // Kendini adminlikten çıkarma: paneli kilitleyebilir.
  if (id === ben.id && rol !== "admin") {
    return { hata: "Kendi admin yetkinizi kaldıramazsınız — başka bir admin bunu yapabilir." };
  }
  // Son admin korunur.
  if (rol !== "admin" && !(await baskaAdminVarMi(id))) {
    return { hata: "Sistemde en az bir admin kalmalı." };
  }

  const { error } = await admin
    .from("profiles")
    .update({
      ad_soyad: adSoyad,
      rol,
      bolge: rol === "bolge_muduru" ? bolge || null : null,
    })
    .eq("id", id);

  if (error) return { hata: hataMesaji(error.message, "Güncellenemedi") };

  revalidatePath("/kullanicilar");
  return { ok: "Kullanıcı bilgileri güncellendi" };
}

export async function epostaGuncelle(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  await adminOl();
  const admin = createAdminClient();

  const id = String(formData.get("kullanici_id") || "");
  const eposta = String(formData.get("eposta") || "").trim().toLowerCase();

  if (!id) return { hata: "Kullanıcı seçili değil." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) return { hata: "Geçerli bir e-posta girin." };

  // email_confirm: kullanıcı doğrulama beklemeden yeni adresle girebilsin.
  const { error } = await admin.auth.admin.updateUserById(id, {
    email: eposta,
    email_confirm: true,
  });
  if (error) return { hata: hataMesaji(error.message, "E-posta değiştirilemedi") };

  revalidatePath("/kullanicilar");
  return { ok: `E-posta ${eposta} olarak güncellendi` };
}

export async function sifreBelirle(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  await adminOl();
  const admin = createAdminClient();

  const id = String(formData.get("kullanici_id") || "");
  const sifre = String(formData.get("yeni_sifre") || "");

  if (!id) return { hata: "Kullanıcı seçili değil." };
  if (sifre.length < 8) return { hata: "Şifre en az 8 karakter olmalı." };

  const { error } = await admin.auth.admin.updateUserById(id, { password: sifre });
  if (error) return { hata: hataMesaji(error.message, "Şifre değiştirilemedi") };

  revalidatePath("/kullanicilar");
  return {
    ok: "Şifre değiştirildi. Kullanıcıya bu şifreyi güvenli bir kanaldan iletin ve girişten sonra değiştirmesini isteyin.",
  };
}

/** Kullanıcının kendi şifresini belirlemesi için e-posta gönderir (tercih edilen yol). */
export async function sifreSifirlamaGonder(
  _onceki: Sonuc | null,
  formData: FormData,
): Promise<Sonuc> {
  await adminOl();
  const admin = createAdminClient();

  const eposta = String(formData.get("eposta") || "").trim();
  if (!eposta) return { hata: "Bu kullanıcının e-posta adresi yok." };

  const { error } = await admin.auth.resetPasswordForEmail(eposta, {
    redirectTo: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://cgkft.vercel.app") + "/login",
  });
  if (error) return { hata: hataMesaji(error.message, "E-posta gönderilemedi") };

  return { ok: `Şifre belirleme bağlantısı ${eposta} adresine gönderildi` };
}

/**
 * Erişimi kapatır/açar. Silmek yerine bunu öneriyoruz: denetim ve skor
 * kayıtları kullanıcıya bağlı olduğu için silme geçmişi bozar.
 */
export async function erisimDegistir(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const ben = await adminOl();
  const admin = createAdminClient();

  const id = String(formData.get("kullanici_id") || "");
  const kapat = String(formData.get("kapat") || "") === "1";

  if (!id) return { hata: "Kullanıcı seçili değil." };
  if (id === ben.id && kapat) return { hata: "Kendi erişiminizi kapatamazsınız." };
  if (kapat && !(await baskaAdminVarMi(id))) {
    return { hata: "Sistemde erişimi açık en az bir admin kalmalı." };
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: kapat ? SURESIZ_ENGEL : "none",
  });
  if (error) return { hata: hataMesaji(error.message, "İşlem başarısız") };

  revalidatePath("/kullanicilar");
  return { ok: kapat ? "Kullanıcının girişi kapatıldı" : "Kullanıcının girişi açıldı" };
}

export async function kullaniciSil(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const ben = await adminOl();
  const admin = createAdminClient();

  const id = String(formData.get("kullanici_id") || "");
  if (!id) return { hata: "Kullanıcı seçili değil." };
  if (id === ben.id) return { hata: "Kendi hesabınızı silemezsiniz." };
  if (!(await baskaAdminVarMi(id))) return { hata: "Sistemde en az bir admin kalmalı." };

  // Silmeden önce bağlı kayıtları say: denetimler.denetmen_id NOT NULL olduğu
  // için silme veritabanı seviyesinde reddedilir. Ham FK hatası yerine
  // anlaşılır bir açıklama verip erişim kapatmayı öneriyoruz.
  const [{ count: denetimSayisi }, { count: skorSayisi }] = await Promise.all([
    admin.from("denetimler").select("id", { count: "exact", head: true }).eq("denetmen_id", id),
    admin.from("skorlar").select("id", { count: "exact", head: true }).eq("olusturan_id", id),
  ]);

  const bagli = (denetimSayisi ?? 0) + (skorSayisi ?? 0);
  if (bagli > 0) {
    return {
      hata:
        `Bu kullanıcı silinemez: adına kayıtlı ${denetimSayisi ?? 0} denetim ve ` +
        `${skorSayisi ?? 0} skor var. Silinirse bu kayıtlar da giderdi. ` +
        `Bunun yerine "Girişi kapat" ile erişimini kesin — geçmiş korunur.`,
    };
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { hata: hataMesaji(error.message, "Kullanıcı silinemedi") };

  revalidatePath("/kullanicilar");
  return { ok: "Kullanıcı silindi" };
}
