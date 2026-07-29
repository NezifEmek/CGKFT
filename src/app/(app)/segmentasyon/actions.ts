"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Esik } from "@/lib/analytics";

export async function esiklerKaydet(_onceki: { hata?: string } | null, formData: FormData) {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Bu işlem için yetkiniz yok." };
  }

  const supabase = await createClient();

  const adlar = formData.getAll("ad") as string[];
  const minler = formData.getAll("min") as string[];
  const renkler = formData.getAll("renk") as string[];
  const baz = String(formData.get("baz") || "KÜMÜLATİF");

  const esikler: Esik[] = adlar
    .map((ad, i) => ({ ad: ad.trim(), min: Number(minler[i]) || 0, renk: renkler[i] || "#999999" }))
    .filter((e) => e.ad);

  const { error } = await supabase.from("segment_ayarlari").update({ baz, esikler }).eq("id", 1);

  if (error) return { hata: "Kaydedilemedi: " + error.message };

  revalidatePath("/segmentasyon");
  revalidatePath("/");
  revalidatePath("/top30");
  revalidatePath("/segment-takibi");
  return { hata: undefined };
}
