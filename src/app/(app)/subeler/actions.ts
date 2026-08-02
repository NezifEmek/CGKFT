"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { subeKoduUret, kodDenetle, KOD_DESENI } from "@/lib/sube-kod";
import { koordinatCoz } from "@/lib/konum";
import type { Sube } from "@/types/database";

export async function subeEkle(_onceki: { hata?: string } | null, formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const bolge =
    profile.rol === "bolge_muduru" ? profile.bolge ?? "" : String(formData.get("bolge") || "");

  const tip = String(formData.get("tip") || "MS") === "FR" ? "FR" : "MS";
  const il = String(formData.get("il") || "").trim();
  const ilce = String(formData.get("ilce") || "").trim();
  const elleKod = String(formData.get("kod") || "").trim().toUpperCase();

  // Sıra no il genelinde tek sayaç olduğu ve bir il birden fazla bölgeye
  // yayılabildiği için doğru numarayı bulmak TÜM şubeleri görmeyi gerektirir.
  // Bölge müdürünün RLS görüşü kendi bölgesiyle sınırlı, o yüzden sayacı
  // service_role ile okuyoruz — yazma yine RLS'e tabi.
  const admin = createAdminClient();
  const { data: tumSubeler } = await admin
    .from("subeler")
    .select("id, ad, kod, tip, il, ilce")
    .returns<Sube[]>();
  const hepsi = tumSubeler ?? [];

  let kod = "";
  let siraNo = "";

  if (elleKod) {
    // Elle girilen kodu kabul et ama çakışma ve format hatasını engelle.
    const denetim = kodDenetle(elleKod, tip, il, ilce, hepsi);
    const cakismaVeyaFormat = denetim.hatalar.filter(
      (h) => h.includes("kullanılıyor") || h.includes("formatı"),
    );
    if (cakismaVeyaFormat.length) {
      return { hata: cakismaVeyaFormat.join(" ") };
    }
    kod = elleKod;
    siraNo = elleKod.match(KOD_DESENI)?.[3] ?? "";
  } else if (il && ilce) {
    const uretim = subeKoduUret(tip, il, ilce, hepsi);
    if (uretim.hata) return { hata: "Kod üretilemedi: " + uretim.hata };
    kod = uretim.kod!;
    siraNo = String(uretim.siraNo).padStart(3, "0");
  }
  // il/ilçe boşsa kod da boş kalır — uydurmaktan iyidir.

  const { error } = await supabase.from("subeler").insert({
    ad: String(formData.get("ad") || "").trim(),
    tip,
    bolge,
    il,
    ilce,
    kod,
    il_sube_sirasi: siraNo,
  });

  if (error) return { hata: "Şube eklenemedi: " + error.message };

  revalidatePath("/subeler");
  return { hata: undefined };
}

/**
 * Formda canlı kod önizlemesi. İstemci tüm şubeleri göremediği için (RLS)
 * sıra no'yu güvenilir biçimde ancak sunucu hesaplayabilir.
 */
export async function kodOnizle(
  tip: "MS" | "FR",
  il: string,
  ilce: string,
): Promise<{ kod: string | null; siraNo: number | null; hata: string | null }> {
  await requireProfile();
  if (!il.trim() || !ilce.trim()) {
    return { kod: null, siraNo: null, hata: null };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("subeler")
    .select("id, ad, kod, tip, il, ilce")
    .returns<Sube[]>();
  return subeKoduUret(tip, il.trim(), ilce.trim(), data ?? []);
}

// ─── İletişim ve konum ────────────────────────────────────────────────────

export async function subeIletisimKaydet(
  _onceki: { hata?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ hata?: string; ok?: string }> {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return { hata: "Bu işlem için yetkiniz yok." };

  const subeId = String(formData.get("sube_id") ?? "").trim();
  if (!subeId) return { hata: "Şube seçili değil." };

  const al = (ad: string) => String(formData.get(ad) ?? "").trim();
  const haritaUrl = al("harita_url");
  const koordinat = koordinatCoz(haritaUrl);

  const supabase = await createClient();
  const { error } = await supabase
    .from("subeler")
    .update({
      telefon: al("telefon"),
      yetkili_telefon: al("yetkili_telefon"),
      eposta: al("eposta"),
      adres: al("adres"),
      harita_url: haritaUrl,
      enlem: koordinat?.enlem ?? null,
      boylam: koordinat?.boylam ?? null,
      iletisim_notu: al("iletisim_notu"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subeId);

  if (error) {
    if (/column .* does not exist/i.test(error.message)) {
      return { hata: "Alanlar henüz oluşturulmamış — 0010_sube_ana_veri.sql çalıştırılmalı." };
    }
    return { hata: "Kaydedilemedi: " + error.message };
  }

  revalidatePath(`/subeler/${subeId}`);
  revalidatePath("/sube-yonetimi");
  return {
    ok: haritaUrl && !koordinat
      ? "Kaydedildi. (Kısa bağlantı olduğu için koordinat okunamadı; harita düğmesi yine çalışır.)"
      : "Kaydedildi",
  };
}

// ─── Sorumlu değişim geçmişi ──────────────────────────────────────────────

const TARAFLAR = ["merkez", "sube"] as const;
type Taraf = (typeof TARAFLAR)[number];

function tarafOku(formData: FormData): Taraf | null {
  const t = String(formData.get("taraf") ?? "").trim();
  return (TARAFLAR as readonly string[]).includes(t) ? (t as Taraf) : null;
}

/**
 * Görevdeki sorumluyu değiştirir. Geçmiş kaydını trigger yazar: eski kişinin
 * dönemi bugün kapanır, yenisi bugün başlar. Tek yol olması önemli —
 * geçmiş ile şubedeki güncel değer asla ayrışmasın.
 */
export async function sorumluDegistir(
  _onceki: { hata?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ hata?: string; ok?: string }> {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return { hata: "Bu işlem için yetkiniz yok." };

  const subeId = String(formData.get("sube_id") ?? "").trim();
  const taraf = tarafOku(formData);
  const yeni = String(formData.get("kisi_adi") ?? "").trim();
  if (!subeId || !taraf) return { hata: "Eksik bilgi." };
  if (!yeni) return { hata: "Yeni sorumlunun adı boş olamaz." };

  const supabase = await createClient();
  const sutun = taraf === "merkez" ? "merkez_yetkilisi" : "sube_yetkilisi";
  const { error } = await supabase
    .from("subeler")
    .update({ [sutun]: yeni, updated_at: new Date().toISOString() })
    .eq("id", subeId);

  if (error) return { hata: "Değiştirilemedi: " + error.message };

  revalidatePath(`/subeler/${subeId}`);
  revalidatePath("/sube-yonetimi");
  revalidatePath("/subeler");
  return { ok: `Sorumlu ${yeni} olarak değiştirildi; önceki dönem bugün kapatıldı.` };
}

/** Geçmişe dönük kayıt ekler (bitiş tarihi zorunlu — güncel sorumlu için "Sorumluyu değiştir" kullanılır). */
export async function sorumluGecmisEkle(
  _onceki: { hata?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ hata?: string; ok?: string }> {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return { hata: "Bu işlem için yetkiniz yok." };

  const subeId = String(formData.get("sube_id") ?? "").trim();
  const taraf = tarafOku(formData);
  const kisi = String(formData.get("kisi_adi") ?? "").trim();
  const baslangic = String(formData.get("baslangic") ?? "").trim() || null;
  const bitis = String(formData.get("bitis") ?? "").trim() || null;

  if (!subeId || !taraf) return { hata: "Eksik bilgi." };
  if (!kisi) return { hata: "Kişi adı zorunlu." };
  if (!bitis) {
    return {
      hata: "Geçmiş kayıt için bitiş tarihi zorunlu. Görevdeki kişiyi değiştirmek için “Sorumluyu değiştir”i kullanın.",
    };
  }
  if (baslangic && bitis < baslangic) {
    return { hata: "Bitiş tarihi başlangıçtan önce olamaz." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sube_sorumlu_gecmisi").insert({
    sube_id: subeId,
    taraf,
    kisi_adi: kisi,
    baslangic,
    bitis,
    aciklama: String(formData.get("aciklama") ?? "").trim(),
    otomatik: false,
    kaydeden_id: profile.id,
  });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return { hata: "Tablo yok — 0010_sube_ana_veri.sql çalıştırılmalı." };
    }
    return { hata: "Eklenemedi: " + error.message };
  }

  revalidatePath(`/subeler/${subeId}`);
  return { ok: "Geçmiş kayıt eklendi" };
}

/** Var olan bir dönem kaydının tarihlerini/adını düzeltir. */
export async function sorumluGecmisGuncelle(
  _onceki: { hata?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ hata?: string; ok?: string }> {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return { hata: "Bu işlem için yetkiniz yok." };

  const id = String(formData.get("kayit_id") ?? "").trim();
  const subeId = String(formData.get("sube_id") ?? "").trim();
  const kisi = String(formData.get("kisi_adi") ?? "").trim();
  const baslangic = String(formData.get("baslangic") ?? "").trim() || null;
  const bitis = String(formData.get("bitis") ?? "").trim() || null;
  if (!id) return { hata: "Kayıt seçili değil." };
  if (!kisi) return { hata: "Kişi adı zorunlu." };
  if (baslangic && bitis && bitis < baslangic) {
    return { hata: "Bitiş tarihi başlangıçtan önce olamaz." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("sube_sorumlu_gecmisi")
    .update({
      kisi_adi: kisi,
      baslangic,
      bitis,
      aciklama: String(formData.get("aciklama") ?? "").trim(),
      otomatik: false,
      kaydeden_id: profile.id,
    })
    .eq("id", id);

  if (error) {
    if (/sube_sorumlu_gecmisi_tek_acik/.test(error.message)) {
      return { hata: "Bu tarafta zaten görevde olan bir kişi var. Önce onun bitiş tarihini girin." };
    }
    return { hata: "Güncellenemedi: " + error.message };
  }

  revalidatePath(`/subeler/${subeId}`);
  return { ok: "Kayıt güncellendi" };
}

export async function sorumluGecmisSil(
  _onceki: { hata?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ hata?: string; ok?: string }> {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Geçmiş kaydı silme yetkisi admin/genel müdürde." };
  }
  const id = String(formData.get("kayit_id") ?? "").trim();
  const subeId = String(formData.get("sube_id") ?? "").trim();
  if (!id) return { hata: "Kayıt seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("sube_sorumlu_gecmisi").delete().eq("id", id);
  if (error) return { hata: "Silinemedi: " + error.message };

  revalidatePath(`/subeler/${subeId}`);
  return { ok: "Kayıt silindi" };
}

// ─── Sözleşmeler ──────────────────────────────────────────────────────────

const SOZLESME_TURLERI = ["franchise", "kira", "marka", "diger"] as const;

export async function sozlesmeKaydet(
  _o: { hata?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ hata?: string; ok?: string }> {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return { hata: "Bu işlem için yetkiniz yok." };

  const al = (a: string) => String(formData.get(a) ?? "").trim();
  const subeId = al("sube_id");
  if (!subeId) return { hata: "Şube seçili değil." };

  const baslangic = al("baslangic") || null;
  const bitis = al("bitis") || null;
  if (baslangic && bitis && bitis < baslangic) {
    return { hata: "Bitiş tarihi başlangıçtan önce olamaz." };
  }

  const uyariHam = Number(al("uyari_gun"));
  const uyariGun = Number.isFinite(uyariHam) && uyariHam >= 0 ? Math.round(uyariHam) : 90;

  const turHam = al("tur");
  const alanlar = {
    sube_id: subeId,
    tur: (SOZLESME_TURLERI as readonly string[]).includes(turHam) ? turHam : "franchise",
    sozlesme_no: al("sozlesme_no"),
    baslangic,
    bitis,
    uyari_gun: uyariGun,
    taraf: al("taraf"),
    notlar: al("notlar"),
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const id = al("sozlesme_id");
  const { error } = id
    ? await supabase.from("sozlesmeler").update(alanlar).eq("id", id)
    : await supabase.from("sozlesmeler").insert({ ...alanlar, olusturan_id: profile.id });

  if (error) {
    if (/relation .* does not exist/i.test(error.message) || /schema cache/i.test(error.message)) {
      return { hata: "Sözleşme tablosu yok — 0015_dosyalar.sql çalıştırılmalı." };
    }
    if (/sozlesme_tarih_sirasi/.test(error.message)) {
      return { hata: "Bitiş tarihi başlangıçtan önce olamaz." };
    }
    return { hata: (id ? "Güncellenemedi: " : "Eklenemedi: ") + error.message };
  }

  revalidatePath(`/subeler/${subeId}`);
  return { ok: id ? "Sözleşme güncellendi" : "Sözleşme eklendi" };
}

export async function sozlesmeSil(
  _o: { hata?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ hata?: string; ok?: string }> {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return { hata: "Bu işlem için yetkiniz yok." };

  const id = String(formData.get("sozlesme_id") ?? "").trim();
  const subeId = String(formData.get("sube_id") ?? "").trim();
  if (!id) return { hata: "Sözleşme seçili değil." };

  const supabase = await createClient();
  // Sözleşmeye bağlı dosyalar da gitmeli; Storage nesnelerini de temizle.
  const { data: ekler } = await supabase
    .from("dosyalar")
    .select("id, yol")
    .eq("kapsam", "sozlesme")
    .eq("kayit_id", id)
    .returns<{ id: string; yol: string }[]>();

  const { error } = await supabase.from("sozlesmeler").delete().eq("id", id);
  if (error) return { hata: "Silinemedi: " + error.message };

  if (ekler?.length) {
    await supabase.from("dosyalar").delete().in("id", ekler.map((e) => e.id));
    const admin = createAdminClient();
    await admin.storage.from("belgeler").remove(ekler.map((e) => e.yol));
  }

  revalidatePath(`/subeler/${subeId}`);
  return { ok: "Sözleşme silindi" };
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
