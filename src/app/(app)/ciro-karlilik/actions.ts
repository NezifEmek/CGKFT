"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { hataMesaji } from "@/lib/hata";

export async function fiyatModeliKaydet(
  _onceki: { hata?: string } | null,
  formData: FormData,
) {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Bu işlem için yetkiniz yok." };
  }

  const sayi = (ad: string) => {
    const ham = String(formData.get(ad) ?? "").replace(",", ".");
    const n = Number(ham);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("fiyat_modeli")
    .update({
      satis_fiyati: {
        MS: sayi("fiyat_ms"),
        FR_dagitim: sayi("fiyat_fr_dagitim"),
        FR_lojistik: sayi("fiyat_fr_lojistik"),
      },
      birim_maliyet_varsayilan: sayi("birim_maliyet"),
      sabit_gider_aylik: sayi("sabit_gider"),
    })
    .eq("id", 1);

  if (error) return { hata: hataMesaji(error.message, "Kaydedilemedi") };

  revalidatePath("/ciro-karlilik");
  return { hata: undefined };
}
