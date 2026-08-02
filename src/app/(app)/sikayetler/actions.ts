"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  KANALLAR, BASVURAN_TURLERI, KATEGORILER, DURUMLAR, ONCELIKLER,
  DEPARTMANLAR, HAREKET_TURLERI,
} from "@/lib/sikayet";
import { yetkiCoz, durumIcinYetkiVar, KAPATMA_DURUMLARI } from "@/lib/sikayet-rol";

type Sonuc = { hata?: string; ok?: string };
const YOL = "/sikayetler";

const m = (f: FormData, a: string) => String(f.get(a) ?? "").trim();
const secim = (deger: string, liste: readonly string[], varsayilan: string) =>
  liste.includes(deger) ? deger : varsayilan;

function tabloHatasi(mesaj: string): string | null {
  if (/relation .* does not exist/i.test(mesaj) || /schema cache/i.test(mesaj)) {
    return "Şikayet tabloları henüz oluşturulmamış — 0012_sikayet.sql çalıştırılmalı.";
  }
  return null;
}

/** Kişinin şikayet yetkileri. Ekran gizlese de sunucu ayrıca denetler. */
async function yetkim() {
  const profile = await requireProfile();
  return { profile, y: yetkiCoz(profile.sikayet_rolu, profile.rol) };
}

export async function sikayetKaydet(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { profile, y } = await yetkim();
  if (!y.kayitAcar) return { hata: "Şikayet kaydı açma yetkiniz yok." };
  const supabase = await createClient();

  const id = m(formData, "sikayet_id");
  const aciklama = m(formData, "aciklama");
  const adSoyad = m(formData, "ad_soyad");
  const firma = m(formData, "firma");

  if (!aciklama) return { hata: "Şikayet açıklaması boş olamaz." };
  if (!adSoyad && !firma) return { hata: "Ad soyad ya da firma yazılmalı." };

  const alanlar = {
    basvuru_tarihi: m(formData, "basvuru_tarihi") || new Date().toISOString().slice(0, 10),
    kanal: secim(m(formData, "kanal"), KANALLAR, "Telefon"),
    basvuran_turu: secim(m(formData, "basvuran_turu"), BASVURAN_TURLERI, "Müşteri"),
    ad_soyad: adSoyad,
    firma,
    telefon: m(formData, "telefon"),
    eposta: m(formData, "eposta"),
    sube_id: m(formData, "sube_id") || null,
    urun: m(formData, "urun"),
    kategori: secim(m(formData, "kategori"), KATEGORILER, "Diğer"),
    aciklama,
    oncelik: secim(m(formData, "oncelik"), ONCELIKLER, "orta"),
    departman: secim(m(formData, "departman"), [...DEPARTMANLAR, ""], ""),
    son_cozum_tarihi: m(formData, "son_cozum_tarihi") || null,
    guncelleyen_id: profile.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = id
    ? await supabase.from("sikayetler").update(alanlar).eq("id", id).select("id").maybeSingle()
    : await supabase
        .from("sikayetler")
        .insert({ ...alanlar, olusturan_id: profile.id })
        .select("id")
        .maybeSingle();

  if (error) {
    return { hata: tabloHatasi(error.message) ?? ((id ? "Güncellenemedi: " : "Kaydedilemedi: ") + error.message) };
  }

  revalidatePath(YOL);
  return { ok: id ? "Şikayet güncellendi" : `Şikayet kaydedildi${data?.id ? "" : ""}` };
}

/** Durum değişimi. Geçmiş kaydını trigger yazar. */
export async function durumDegistir(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { profile, y } = await yetkim();
  const id = m(formData, "sikayet_id");
  const durum = m(formData, "durum");
  if (!id) return { hata: "Şikayet seçili değil." };
  if (!(DURUMLAR as readonly string[]).includes(durum)) return { hata: "Geçersiz durum." };

  if (!durumIcinYetkiVar(y, durum)) {
    return {
      hata: (KAPATMA_DURUMLARI as readonly string[]).includes(durum)
        ? "Şikayeti kapatma yetkiniz yok. Kapatma kararını Kalite, Operasyon, Bölge Müdürü ya da Yönetim verir."
        : "Şikayetin durumunu değiştirme yetkiniz yok.",
    };
  }

  const cozumNotu = m(formData, "cozum_notu");
  const kokNeden = y.kokNedenYazar ? m(formData, "kok_neden") : "";

  // Çözüm/kapanış için gerekçe iste: boş kapanan kayıt kök neden analizini
  // işe yaramaz hâle getirir.
  if ((durum === "cozuldu" || durum === "kapatildi") && !cozumNotu) {
    return { hata: "Çözüm notu yazmadan bu duruma geçilemez." };
  }

  const supabase = await createClient();
  const guncelleme: Record<string, unknown> = {
    durum,
    guncelleyen_id: profile.id,
    updated_at: new Date().toISOString(),
  };
  if (cozumNotu) guncelleme.cozum_notu = cozumNotu;
  if (kokNeden) guncelleme.kok_neden = kokNeden;

  const { error } = await supabase.from("sikayetler").update(guncelleme).eq("id", id);
  if (error) return { hata: tabloHatasi(error.message) ?? "Değiştirilemedi: " + error.message };

  revalidatePath(YOL);
  return { ok: "Durum güncellendi" };
}

/** İletişim geçmişine satır ekler (görüşme, telefon notu, e-posta, iç not). */
export async function hareketEkle(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  // Not yazmak her rolde serbest: franchise işletmecisi de kendi kaydına
  // yanıt yazabilmeli. Kaydı görüp göremediğini RLS zaten belirliyor.
  const { profile } = await yetkim();
  const id = m(formData, "sikayet_id");
  const metin = m(formData, "metin");
  if (!id) return { hata: "Şikayet seçili değil." };
  if (!metin) return { hata: "Not boş olamaz." };

  const supabase = await createClient();
  const { error } = await supabase.from("sikayet_hareketleri").insert({
    sikayet_id: id,
    tur: secim(m(formData, "tur"), HAREKET_TURLERI, "ic_not"),
    metin,
    kaydeden_id: profile.id,
  });

  if (error) return { hata: tabloHatasi(error.message) ?? "Eklenemedi: " + error.message };
  revalidatePath(YOL);
  return { ok: "Not eklendi" };
}

/** Görevlendirme. Birden fazla kişi atanabilir. */
export async function atamaDegistir(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { profile, y } = await yetkim();
  if (!y.atar) return { hata: "Görevlendirme yetkiniz yok." };
  const id = m(formData, "sikayet_id");
  const kisiId = m(formData, "profil_id");
  if (!id || !kisiId) return { hata: "Eksik bilgi." };

  const supabase = await createClient();
  const kaldir = m(formData, "kaldir") === "1";

  if (kaldir) {
    const { error } = await supabase
      .from("sikayet_atamalari")
      .delete()
      .eq("sikayet_id", id)
      .eq("profil_id", kisiId);
    if (error) return { hata: "Kaldırılamadı: " + error.message };
    revalidatePath(YOL);
    return { ok: "Görevlendirme kaldırıldı" };
  }

  const { error } = await supabase
    .from("sikayet_atamalari")
    .insert({ sikayet_id: id, profil_id: kisiId, atayan_id: profile.id });

  if (error) {
    if (/duplicate key/i.test(error.message)) return { hata: "Bu kişi zaten görevli." };
    return { hata: tabloHatasi(error.message) ?? "Atanamadı: " + error.message };
  }

  // Atama da geçmişe düşsün.
  const { data: kisi } = await supabase
    .from("profiles").select("ad_soyad").eq("id", kisiId).maybeSingle<{ ad_soyad: string }>();
  await supabase.from("sikayet_hareketleri").insert({
    sikayet_id: id,
    tur: "atama",
    metin: `${kisi?.ad_soyad ?? "Kullanıcı"} görevlendirildi`,
    kaydeden_id: profile.id,
  });

  // Kayıt hâlâ "yeni" ise atama yapılınca durumu ilerlet.
  await supabase
    .from("sikayetler")
    .update({ durum: "atandi", guncelleyen_id: profile.id })
    .eq("id", id)
    .eq("durum", "yeni");

  revalidatePath(YOL);
  return { ok: "Görevlendirildi" };
}

export async function sikayetSil(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { y } = await yetkim();
  if (!y.siler) return { hata: "Şikayet silme yetkisi Admin ve Yönetim rolündedir." };
  const id = m(formData, "sikayet_id");
  if (!id) return { hata: "Şikayet seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("sikayetler").delete().eq("id", id);
  if (error) return { hata: "Silinemedi: " + error.message };

  revalidatePath(YOL);
  return { ok: "Şikayet silindi" };
}
