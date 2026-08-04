"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { KOVA, type Dosya } from "@/lib/dosya";
import { dosyalariKaydet, formdanDosyalar } from "@/lib/dosya-kaydet";
import { hataMesaji } from "@/lib/hata";

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

  // Tek alandan birden çok dosya seçilebiliyor (telefondan çoklu fotoğraf).
  const dosyalar = formdanDosyalar(formData.getAll("dosya"));
  if (!dosyalar.length) return { hata: "Dosya seçilmedi." };

  const supabase = await createClient();
  const { yuklenen, hatalar } = await dosyalariKaydet(supabase, {
    kapsam,
    kayitId,
    dosyalar,
    yukleyenId: profile.id,
  });

  revalidatePath("/", "layout");

  if (!yuklenen) return { hata: hatalar[0] ?? "Yüklenemedi." };
  return {
    ok:
      `${yuklenen} dosya yüklendi` +
      (hatalar.length ? ` · ${hatalar.length} tanesi eklenemedi: ${hatalar[0]}` : ""),
  };
}

/**
 * Birden çok dosya için tek seferde imzalı bağlantı üretir.
 *
 * Görsel önizlemeleri için var: her küçük resim ayrı ayrı bağlantı
 * isteseydi bir kayıtta on ayrı gidiş-dönüş olurdu. Yetki denetimi
 * değişmiyor — RLS'in gösterdiği kayıtlar için bağlantı üretiliyor.
 */
export async function dosyaBaglantilari(
  dosyaIdleri: string[],
): Promise<{ url: Record<string, string>; hata?: string }> {
  await requireProfile();
  const idler = dosyaIdleri.filter(Boolean).slice(0, 60);
  if (!idler.length) return { url: {} };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dosyalar")
    .select("id, yol")
    .in("id", idler)
    .returns<{ id: string; yol: string }[]>();

  if (error) return { url: {}, hata: tabloHatasi(error.message) ?? hataMesaji(error.message, "Okunamadı") };
  if (!data?.length) return { url: {} };

  const admin = createAdminClient();
  const { data: imzalar, error: imzaHata } = await admin.storage
    .from(KOVA)
    .createSignedUrls(data.map((d) => d.yol), 300);

  if (imzaHata) return { url: {}, hata: hataMesaji(imzaHata.message, "Bağlantı üretilemedi") };

  const url: Record<string, string> = {};
  imzalar?.forEach((imza, i) => {
    if (imza.signedUrl && data[i]) url[data[i].id] = imza.signedUrl;
  });
  return { url };
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

  if (error) return { hata: tabloHatasi(error.message) ?? hataMesaji(error.message, "Dosya okunamadı") };
  // RLS kaydı gizlediyse burada null döner — yetkisiz kişi bağlantı alamaz.
  if (!kayit) return { hata: "Dosya bulunamadı ya da görme yetkiniz yok." };

  const admin = createAdminClient();
  const { data, error: imzaHata } = await admin.storage
    .from(KOVA)
    .createSignedUrl(kayit.yol, 300, { download: kayit.ad });

  if (imzaHata) return { hata: hataMesaji(imzaHata.message, "Bağlantı üretilemedi") };
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
  if (error) return { hata: hataMesaji(error.message, "Silinemedi") };

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
