"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function subeEkle(_onceki: { hata?: string } | null, formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const bolge =
    profile.rol === "bolge_muduru" ? profile.bolge ?? "" : String(formData.get("bolge") || "");

  const { error } = await supabase.from("subeler").insert({
    ad: String(formData.get("ad") || "").trim(),
    tip: String(formData.get("tip") || "MS"),
    bolge,
    il: String(formData.get("il") || ""),
    ilce: String(formData.get("ilce") || ""),
    kod: String(formData.get("kod") || ""),
  });

  if (error) return { hata: "Şube eklenemedi: " + error.message };

  revalidatePath("/subeler");
  return { hata: undefined };
}

export async function kgKaydet(subeId: string, yil: number, ay: string, kg: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("aylik_satislar")
    .upsert({ sube_id: subeId, yil, ay, kg }, { onConflict: "sube_id,yil,ay" });

  if (error) return { hata: error.message };
  revalidatePath(`/subeler/${subeId}`);
  return { hata: null };
}

// Ay ekleme/silme artık /aylar-veri ekranında (yetki kontrolü + doğrulama ile).

export async function denetimEkle(_onceki: { hata?: string } | null, formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const subeId = String(formData.get("sube_id") || "");
  const puan = Number(formData.get("puan") || 0);
  const notlar = String(formData.get("notlar") || "");

  const { error } = await supabase.from("denetimler").insert({
    sube_id: subeId,
    denetmen_id: profile.id,
    puan,
    notlar,
  });

  if (error) return { hata: "Denetim kaydedilemedi: " + error.message };

  revalidatePath(`/subeler/${subeId}`);
  return { hata: undefined };
}
