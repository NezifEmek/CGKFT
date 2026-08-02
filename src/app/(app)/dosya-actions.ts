"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { KOVA, AZAMI_BOYUT, turIzinliMi, yolUret, type Dosya } from "@/lib/dosya";

type Sonuc = { hata?: string; ok?: string };

const KAPSAMLAR = ["sikayet", "sozlesme", "sube", "toplanti", "franchise"] as const;

function tabloHatasi(mesaj: string): string | null {
  if (/relation .* does not exist/i.test(mesaj) || /schema cache/i.test(mesaj)) {
    return "Dosya tabloları henüz oluşturulmamış — 0015_dosyalar.sql çalıştırılmalı.";
  }
  if (/Bucket not found/i.test(mesaj)) {
    return "Depolama kovası bulunamadı — 0015_dosyalar.sql çalıştırılmalı.";
  }
  return null;
}

/**
 * Dosya yükler.
 *
 * Yükleme service_role ile yapılıyor: kova özel ve Storage politikaları
 * kaba (giriş yapan herkes). Kayıt bazlı yetki zaten `dosyalar` tablosuna
 * yazarken RLS ile denetleniyor. Yükleme başarılı olup kayıt yazılamazsa
 * Storage'daki nesne SİLİNİYOR — yoksa kimsenin göremediği çöp dosya kalır.
 */
export async function dosyaYukle(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();

  const kapsam = String(formData.get("kapsam") ?? "").trim();
  const kayitId = String(formData.get("kayit_id") ?? "").trim();
  if (!(KAPSAMLAR as readonly string[]).includes(kapsam)) return { hata: "Geçersiz dosya kapsamı." };
  if (!kayitId) return { hata: "İlgili kayıt seçili değil." };

  const dosya = formData.get("dosya");
  if (!(dosya instanceof File) || !dosya.size) return { hata: "Dosya seçilmedi." };

  if (dosya.size > AZAMI_BOYUT) {
    return { hata: `Dosya çok büyük (${(dosya.size / 1048576).toFixed(1)} MB). Sınır 25 MB.` };
  }
  if (!turIzinliMi(dosya.name, dosya.type)) {
    return { hata: `"${dosya.name}" türü kabul edilmiyor. PDF, resim, Word, Excel ve metin dosyaları yüklenebilir.` };
  }

  const yol = yolUret(kapsam, kayitId, dosya.name);
  const admin = createAdminClient();

  const { error: yuklemeHata } = await admin.storage
    .from(KOVA)
    .upload(yol, dosya, { contentType: dosya.type || "application/octet-stream", upsert: false });

  if (yuklemeHata) {
    return { hata: tabloHatasi(yuklemeHata.message) ?? "Yüklenemedi: " + yuklemeHata.message };
  }

  const supabase = await createClient();
  const { error: kayitHata } = await supabase.from("dosyalar").insert({
    kapsam,
    kayit_id: kayitId,
    yol,
    ad: dosya.name,
    boyut: dosya.size,
    mime: dosya.type || "",
    aciklama: String(formData.get("aciklama") ?? "").trim(),
    yukleyen_id: profile.id,
  });

  if (kayitHata) {
    // Kayıt yazılamadıysa yüklenen nesneyi geri al.
    await admin.storage.from(KOVA).remove([yol]);
    return { hata: tabloHatasi(kayitHata.message) ?? "Kaydedilemedi: " + kayitHata.message };
  }

  revalidatePath("/", "layout");
  return { ok: `${dosya.name} yüklendi` };
}

/**
 * İndirme bağlantısı üretir — 5 dakika geçerli, tek kullanımlık sayılmalı.
 * Kova özel olduğu için doğrudan adresle erişilemiyor.
 */
export async function dosyaBaglantisi(dosyaId: string): Promise<{ url?: string; hata?: string }> {
  await requireProfile();

  const supabase = await createClient();
  const { data: kayit, error } = await supabase
    .from("dosyalar")
    .select("yol, ad")
    .eq("id", dosyaId)
    .maybeSingle<{ yol: string; ad: string }>();

  if (error) return { hata: tabloHatasi(error.message) ?? "Dosya okunamadı: " + error.message };
  // RLS kaydı gizlediyse burada null döner — yetkisiz kişi bağlantı alamaz.
  if (!kayit) return { hata: "Dosya bulunamadı ya da görme yetkiniz yok." };

  const admin = createAdminClient();
  const { data, error: imzaHata } = await admin.storage
    .from(KOVA)
    .createSignedUrl(kayit.yol, 300, { download: kayit.ad });

  if (imzaHata) return { hata: "Bağlantı üretilemedi: " + imzaHata.message };
  return { url: data.signedUrl };
}

export async function dosyaSil(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  await requireProfile();
  const id = String(formData.get("dosya_id") ?? "").trim();
  if (!id) return { hata: "Dosya seçili değil." };

  const supabase = await createClient();
  const { data: kayit } = await supabase
    .from("dosyalar")
    .select("yol")
    .eq("id", id)
    .maybeSingle<{ yol: string }>();

  if (!kayit) return { hata: "Dosya bulunamadı ya da silme yetkiniz yok." };

  // Önce veritabanı: RLS silmeye izin vermezse Storage'a dokunmayalım.
  const { error } = await supabase.from("dosyalar").delete().eq("id", id);
  if (error) return { hata: "Silinemedi: " + error.message };

  const admin = createAdminClient();
  await admin.storage.from(KOVA).remove([kayit.yol]);

  revalidatePath("/", "layout");
  return { ok: "Dosya silindi" };
}

/** Bir kaydın ekleri. Sunucu bileşenlerinden çağrılır. */
export async function dosyalariGetir(kapsam: string, kayitId: string): Promise<Dosya[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dosyalar")
    .select("*")
    .eq("kapsam", kapsam)
    .eq("kayit_id", kayitId)
    .order("created_at", { ascending: false })
    .returns<Dosya[]>();
  return data ?? [];
}
