"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { AYLAR_12 } from "@/types/database";
import { hataMesaji } from "@/lib/hata";

async function yonetebilirMi() {
  const profile = await requireProfile();
  return profile.rol === "admin" || profile.rol === "genel_mudur";
}

export async function ayEkle(_onceki: { hata?: string; ok?: boolean } | null, formData: FormData) {
  if (!(await yonetebilirMi())) return { hata: "Bu işlem için Admin/Genel Müdür yetkisi gerekir." };

  const yil = Number(formData.get("yil"));
  const ay = String(formData.get("ay") ?? "");
  const gunSayisi = Number(formData.get("gun_sayisi"));

  if (!Number.isInteger(yil) || yil < 2000 || yil > 2100) return { hata: "Geçersiz yıl." };
  if (!AYLAR_12.includes(ay as (typeof AYLAR_12)[number])) return { hata: "Geçersiz ay." };
  if (!Number.isInteger(gunSayisi) || gunSayisi < 1 || gunSayisi > 31) {
    return { hata: "Gün sayısı 1–31 arasında olmalı." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("aylar")
    .upsert({ yil, ay, gun_sayisi: gunSayisi }, { onConflict: "yil,ay" });

  if (error) return { hata: hataMesaji(error.message, "Ay eklenemedi") };

  revalidatePath("/aylar-veri");
  revalidatePath("/");
  return { hata: undefined, ok: true };
}

export async function aySil(_onceki: { hata?: string; ok?: boolean } | null, formData: FormData) {
  if (!(await yonetebilirMi())) return { hata: "Bu işlem için Admin/Genel Müdür yetkisi gerekir." };

  const yil = Number(formData.get("yil"));
  const ay = String(formData.get("ay") ?? "");
  if (!yil || !ay) return { hata: "Ay seçili değil." };

  const supabase = await createClient();

  // Önce o aya ait satış kayıtlarını sil (aylar tablosuna FK yok, elle temizlik).
  const { error: satisHata } = await supabase
    .from("aylik_satislar")
    .delete()
    .eq("yil", yil)
    .eq("ay", ay);
  if (satisHata) return { hata: hataMesaji(satisHata.message, "Aya ait satışlar silinemedi") };

  const { error } = await supabase.from("aylar").delete().eq("yil", yil).eq("ay", ay);
  if (error) return { hata: hataMesaji(error.message, "Ay silinemedi") };

  revalidatePath("/aylar-veri");
  revalidatePath("/");
  return { hata: undefined, ok: true };
}

/** Tek hücre kaydı — kg grid'inde bir input blur olduğunda çağrılır. */
export async function kgKaydet(subeId: string, yil: number, ay: string, kg: number | null) {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return { hata: "Kg girişi yetkiniz yok." };

  const supabase = await createClient();

  // Boş bırakılan hücre "veri yok" demektir — kaydı siliyoruz (0 kg'dan farklı).
  if (kg === null) {
    const { error } = await supabase
      .from("aylik_satislar")
      .delete()
      .eq("sube_id", subeId)
      .eq("yil", yil)
      .eq("ay", ay);
    if (error) return { hata: hataMesaji(error.message, "Kaydedilemedi") };
    revalidatePath("/aylar-veri");
    return { hata: null };
  }

  if (!Number.isFinite(kg) || kg < 0) return { hata: "Geçersiz kg değeri." };

  const { error } = await supabase
    .from("aylik_satislar")
    .upsert(
      { sube_id: subeId, yil, ay, kg, guncelleyen_id: profile.id, updated_at: new Date().toISOString() },
      { onConflict: "sube_id,yil,ay" },
    );

  if (error) return { hata: hataMesaji(error.message, "Kaydedilemedi") };

  revalidatePath("/aylar-veri");
  revalidatePath("/");
  return { hata: null };
}
