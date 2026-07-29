"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Rol } from "@/types/database";

async function adminOl() {
  const profile = await requireProfile();
  if (profile.rol !== "admin") {
    throw new Error("Bu işlem için admin yetkisi gerekir.");
  }
  return profile;
}

export async function kullaniciOlustur(_onceki: { hata?: string } | null, formData: FormData) {
  await adminOl();
  const admin = createAdminClient();

  const eposta = String(formData.get("eposta") || "").trim();
  const sifre = String(formData.get("sifre") || "");
  const adSoyad = String(formData.get("ad_soyad") || "").trim();
  const rol = String(formData.get("rol") || "denetmen") as Rol;
  const bolge = String(formData.get("bolge") || "") || null;
  const subeId = String(formData.get("sube_id") || "") || null;

  if (!eposta || sifre.length < 8) {
    return { hata: "E-posta gerekli, şifre en az 8 karakter olmalı." };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: eposta,
    password: sifre,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return { hata: "Kullanıcı oluşturulamadı: " + (createError?.message ?? "bilinmeyen hata") };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    ad_soyad: adSoyad,
    rol,
    bolge: rol === "bolge_muduru" ? bolge : null,
  });

  if (profileError) {
    return { hata: "Profil oluşturulamadı: " + profileError.message };
  }

  if (rol === "denetmen" && subeId) {
    await admin.from("sube_erisim").insert({ profil_id: created.user.id, sube_id: subeId });
  }

  revalidatePath("/kullanicilar");
  return { hata: undefined };
}
