"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  POZISYON_ALANLARI,
  VARSAYILAN_POZISYONLAR,
  pozisyonlariNormalize,
  type Pozisyon,
} from "@/lib/dokuman";

type Sonuc = { hata?: string; ok?: string };

/** Yalnızca admin ve genel müdür görev tanımlarını değiştirebilir (RLS ile aynı kural). */
async function yazmaYetkisi() {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") return null;
  return profile;
}

async function mevcutPozisyonlar() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dokuman_ayarlari")
    .select("pozisyonlar")
    .eq("id", 1)
    .maybeSingle<{ pozisyonlar: unknown }>();
  return pozisyonlariNormalize(data?.pozisyonlar);
}

async function yaz(pozisyonlar: Pozisyon[], profilId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("dokuman_ayarlari")
    .update({
      pozisyonlar,
      guncelleyen_id: profilId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  return error ? error.message : null;
}

export async function pozisyonKaydet(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazmaYetkisi();
  if (!profile) return { hata: "Görev tanımlarını değiştirme yetkiniz yok." };

  const id = String(formData.get("pozisyon_id") ?? "").trim();
  if (!id) return { hata: "Pozisyon seçili değil." };

  const unvan = String(formData.get("unvan") ?? "").trim();
  if (!unvan) return { hata: "Unvan boş olamaz." };

  const pozlar = await mevcutPozisyonlar();
  const idx = pozlar.findIndex((p) => p.id === id);
  if (idx < 0) return { hata: "Pozisyon bulunamadı." };

  const guncel: Pozisyon = { ...pozlar[idx], unvan };
  for (const alan of POZISYON_ALANLARI) {
    const deger = formData.get(alan.key);
    if (deger !== null) (guncel[alan.key] as string) = String(deger);
  }
  pozlar[idx] = guncel;

  const hata = await yaz(pozlar, profile.id);
  if (hata) return { hata: "Kaydedilemedi: " + hata };

  revalidatePath("/dokuman");
  return { ok: `“${unvan}” kaydedildi` };
}

export async function pozisyonSifirla(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazmaYetkisi();
  if (!profile) return { hata: "Görev tanımlarını değiştirme yetkiniz yok." };

  const id = String(formData.get("pozisyon_id") ?? "").trim();
  const varsayilan = VARSAYILAN_POZISYONLAR.find((v) => v.id === id);
  if (!varsayilan) {
    return { hata: "Bu pozisyon sonradan eklenmiş, sıfırlanacak orijinal içeriği yok." };
  }

  const pozlar = await mevcutPozisyonlar();
  const idx = pozlar.findIndex((p) => p.id === id);
  if (idx < 0) return { hata: "Pozisyon bulunamadı." };
  pozlar[idx] = { ...varsayilan };

  const hata = await yaz(pozlar, profile.id);
  if (hata) return { hata: "Sıfırlanamadı: " + hata };

  revalidatePath("/dokuman");
  return { ok: `“${varsayilan.unvan}” orijinal içeriğine döndürüldü` };
}

export async function pozisyonSil(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazmaYetkisi();
  if (!profile) return { hata: "Görev tanımlarını değiştirme yetkiniz yok." };

  const id = String(formData.get("pozisyon_id") ?? "").trim();
  const pozlar = await mevcutPozisyonlar();
  if (pozlar.length <= 1) return { hata: "En az 1 pozisyon kalmalı." };

  const silinen = pozlar.find((p) => p.id === id);
  if (!silinen) return { hata: "Pozisyon bulunamadı." };

  const hata = await yaz(
    pozlar.filter((p) => p.id !== id),
    profile.id,
  );
  if (hata) return { hata: "Silinemedi: " + hata };

  revalidatePath("/dokuman");
  return { ok: `“${silinen.unvan}” silindi` };
}

export async function pozisyonEkle(_onceki: Sonuc | null): Promise<Sonuc> {
  const profile = await yazmaYetkisi();
  if (!profile) return { hata: "Görev tanımlarını değiştirme yetkiniz yok." };

  const pozlar = await mevcutPozisyonlar();
  const yeniSira = pozlar.length ? Math.max(...pozlar.map((p) => p.sira)) + 1 : 1;
  const bos = Object.fromEntries(POZISYON_ALANLARI.map((a) => [a.key, ""]));

  pozlar.push({
    ...(bos as Omit<Pozisyon, "id" | "sira" | "unvan">),
    id: "p" + Date.now(),
    sira: yeniSira,
    unvan: "Yeni Pozisyon",
  });

  const hata = await yaz(pozlar, profile.id);
  if (hata) return { hata: "Eklenemedi: " + hata };

  revalidatePath("/dokuman");
  return { ok: "Yeni pozisyon eklendi" };
}
