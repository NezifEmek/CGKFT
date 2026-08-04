"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

// Sabitler @/lib/oneri'de: "use server" dosyasından ihraç edilen dizi/nesne
// istemcide gerçek değer olarak görünmez.
import { KATEGORILER, DURUMLAR, ONCELIKLER } from "@/lib/oneri";
import { hataMesaji } from "@/lib/hata";

type Sonuc = { hata?: string; ok?: string };
const YOL = "/oneriler";

const m = (f: FormData, a: string) => String(f.get(a) ?? "").trim();

export async function oneriEkle(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();
  const baslik = m(formData, "baslik");
  if (!baslik) return { hata: "Öneri başlığı boş olamaz." };

  const kategoriHam = m(formData, "kategori");
  const supabase = await createClient();
  const { error } = await supabase.from("oneriler").insert({
    baslik,
    aciklama: m(formData, "aciklama"),
    kategori: (KATEGORILER as readonly string[]).includes(kategoriHam) ? kategoriHam : "Diğer",
    ekleyen_id: profile.id,
  });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return { hata: "Tablo yok — 0009_oneriler.sql çalıştırılmalı." };
    }
    return { hata: hataMesaji(error.message, "Kaydedilemedi") };
  }
  revalidatePath(YOL);
  return { ok: "Öneriniz kaydedildi" };
}

/** Destek ver / geri çek. Kişi başına bir kez. */
export async function destekDegistir(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();
  const id = m(formData, "oneri_id");
  if (!id) return { hata: "Öneri seçili değil." };

  const supabase = await createClient();
  const { data: var_ } = await supabase
    .from("oneri_destekleri")
    .select("oneri_id")
    .eq("oneri_id", id)
    .eq("profil_id", profile.id)
    .maybeSingle();

  const { error } = var_
    ? await supabase.from("oneri_destekleri").delete().eq("oneri_id", id).eq("profil_id", profile.id)
    : await supabase.from("oneri_destekleri").insert({ oneri_id: id, profil_id: profile.id });

  if (error) return { hata: hataMesaji(error.message, "İşlenemedi") };
  revalidatePath(YOL);
  return { ok: var_ ? "Desteğiniz geri alındı" : "Desteklediniz" };
}

/** Durum, öncelik ve yönetim notu — yalnızca admin / genel müdür. */
export async function oneriKarar(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Öneriyi değerlendirme yetkisi admin ve genel müdürde." };
  }
  const id = m(formData, "oneri_id");
  if (!id) return { hata: "Öneri seçili değil." };

  const durum = m(formData, "durum");
  const oncelik = m(formData, "oncelik");
  if (!(DURUMLAR as readonly string[]).includes(durum)) return { hata: "Geçersiz durum." };
  if (!(ONCELIKLER as readonly string[]).includes(oncelik)) return { hata: "Geçersiz öncelik." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("oneriler")
    .update({
      durum,
      oncelik,
      yonetim_notu: m(formData, "yonetim_notu"),
      karar_veren_id: profile.id,
      karar_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { hata: hataMesaji(error.message, "Kaydedilemedi") };
  revalidatePath(YOL);
  return { ok: "Öneri güncellendi" };
}

export async function oneriSil(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  await requireProfile();
  const id = m(formData, "oneri_id");
  if (!id) return { hata: "Öneri seçili değil." };
  const supabase = await createClient();
  // RLS: yalnızca ekleyen veya yönetim silebilir.
  const { error } = await supabase.from("oneriler").delete().eq("id", id);
  if (error) return { hata: hataMesaji(error.message, "Silinemedi") };
  revalidatePath(YOL);
  return { ok: "Öneri silindi" };
}
