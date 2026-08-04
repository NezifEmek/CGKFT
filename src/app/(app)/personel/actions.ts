"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PRIM_GRUPLARI } from "@/lib/kadro";
import { hataMesaji } from "@/lib/hata";

type Sonuc = { hata?: string; ok?: string };
const YOL = "/personel";

const m = (f: FormData, a: string) => String(f.get(a) ?? "").trim();

function tabloHatasi(mesaj: string): string | null {
  if (/relation .* does not exist/i.test(mesaj) || /schema cache/i.test(mesaj)) {
    return "Kadro tabloları henüz oluşturulmamış — 0018_kadro.sql çalıştırılmalı.";
  }
  return null;
}

async function yonetimOl() {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { profile, hata: "Kadro işlemleri admin ve genel müdür yetkisindedir." };
  }
  return { profile, hata: null };
}

// ─── Personel ─────────────────────────────────────────────────────────────

export async function personelKaydet(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { hata } = await yonetimOl();
  if (hata) return { hata };

  const ad = m(formData, "ad_soyad");
  if (!ad) return { hata: "Ad soyad zorunlu." };

  const iseGiris = m(formData, "ise_giris") || null;
  const ayrilis = m(formData, "ayrilis") || null;
  if (iseGiris && ayrilis && ayrilis < iseGiris) {
    return { hata: "Ayrılış tarihi işe giriş tarihinden önce olamaz." };
  }

  const alanlar = {
    ad_soyad: ad,
    telefon: m(formData, "telefon"),
    eposta: m(formData, "eposta"),
    ise_giris: iseGiris,
    ayrilis: ayrilis,
    profil_id: m(formData, "profil_id") || null,
    notlar: m(formData, "notlar"),
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const id = m(formData, "personel_id");
  const { error } = id
    ? await supabase.from("personeller").update(alanlar).eq("id", id)
    : await supabase.from("personeller").insert(alanlar);

  if (error) {
    return { hata: tabloHatasi(error.message) ?? hataMesaji(error.message, id ? "Güncellenemedi" : "Eklenemedi") };
  }

  revalidatePath(YOL);
  revalidatePath("/prim-hakedis");
  return {
    ok: ayrilis
      ? `Kaydedildi. ${ad} ${ayrilis} tarihinde ayrılmış işaretlendi; açık görevleri o tarihte kapatıldı.`
      : "Kaydedildi",
  };
}

export async function personelSil(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { hata } = await yonetimOl();
  if (hata) return { hata };

  const id = m(formData, "personel_id");
  if (!id) return { hata: "Personel seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("personeller").delete().eq("id", id);
  if (error) return { hata: hataMesaji(error.message, "Silinemedi") };

  revalidatePath(YOL);
  return {
    ok: "Personel silindi. Geçmiş primler etkilenmez ama kayıt silme günlüğüne yazıldı — ayrılış tarihi girmek genelde silmekten daha doğrudur.",
  };
}

// ─── Görev atamaları ──────────────────────────────────────────────────────

export async function atamaEkle(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { hata } = await yonetimOl();
  if (hata) return { hata };

  const personelId = m(formData, "personel_id");
  const pozisyonId = m(formData, "pozisyon_id");
  if (!personelId) return { hata: "Personel seçili değil." };
  if (!pozisyonId) return { hata: "Görev tanımı seçilmeli." };

  const grupHam = m(formData, "prim_grubu");
  const baslangic = m(formData, "baslangic") || null;
  const bitis = m(formData, "bitis") || null;
  if (baslangic && bitis && bitis < baslangic) {
    return { hata: "Bitiş tarihi başlangıçtan önce olamaz." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("pozisyon_atamalari").insert({
    personel_id: personelId,
    pozisyon_id: pozisyonId,
    baslangic,
    bitis,
    prim_grubu: (PRIM_GRUPLARI as readonly string[]).includes(grupHam) ? grupHam : "yok",
    aciklama: m(formData, "aciklama"),
  });

  if (error) {
    if (/atama_tek_acik/.test(error.message)) {
      return { hata: "Bu kişi zaten bu görevde. Önce mevcut görevi bitirin." };
    }
    return { hata: tabloHatasi(error.message) ?? hataMesaji(error.message, "Atanamadı") };
  }

  revalidatePath(YOL);
  revalidatePath("/prim-hakedis");
  return {
    ok: baslangic
      ? `Görev atandı. Prim ${baslangic.slice(0, 7)} ayından SONRAKİ aydan itibaren başlar.`
      : "Görev atandı",
  };
}

export async function atamaGuncelle(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { hata } = await yonetimOl();
  if (hata) return { hata };

  const id = m(formData, "atama_id");
  if (!id) return { hata: "Atama seçili değil." };

  const baslangic = m(formData, "baslangic") || null;
  const bitis = m(formData, "bitis") || null;
  if (baslangic && bitis && bitis < baslangic) {
    return { hata: "Bitiş tarihi başlangıçtan önce olamaz." };
  }
  const grupHam = m(formData, "prim_grubu");

  const supabase = await createClient();
  const { error } = await supabase
    .from("pozisyon_atamalari")
    .update({
      baslangic,
      bitis,
      prim_grubu: (PRIM_GRUPLARI as readonly string[]).includes(grupHam) ? grupHam : "yok",
      aciklama: m(formData, "aciklama"),
    })
    .eq("id", id);

  if (error) {
    if (/atama_tek_acik/.test(error.message)) {
      return { hata: "Bu kişinin bu görevde zaten açık bir kaydı var." };
    }
    return { hata: hataMesaji(error.message, "Güncellenemedi") };
  }

  revalidatePath(YOL);
  revalidatePath("/prim-hakedis");
  return { ok: "Atama güncellendi" };
}

export async function atamaSil(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { hata } = await yonetimOl();
  if (hata) return { hata };

  const id = m(formData, "atama_id");
  if (!id) return { hata: "Atama seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("pozisyon_atamalari").delete().eq("id", id);
  if (error) return { hata: hataMesaji(error.message, "Silinemedi") };

  revalidatePath(YOL);
  revalidatePath("/prim-hakedis");
  return { ok: "Atama silindi" };
}
