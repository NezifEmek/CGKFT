"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DURUMLAR, KANALLAR, KAYIP_NEDENLERI, MEMNUNIYET, PUANLI_ALANLAR } from "@/lib/franchise";

type Sonuc = { hata?: string; ok?: string };

const izinli = (liste: readonly string[], v: string) => (liste.includes(v) ? v : "");

async function yazabilirMi() {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return null;
  return profile;
}

function alanlariOku(formData: FormData) {
  const s = (ad: string) => String(formData.get(ad) ?? "").trim();
  const tarih = (ad: string) => {
    const v = s(ad);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };

  const puanli: Record<string, string> = {};
  for (const alan of PUANLI_ALANLAR) {
    puanli[alan.key] = izilenSecenek(alan.secenekler.map((x) => x.deger), s(alan.key));
  }

  return {
    isim: s("isim"),
    telefon: s("telefon"),
    il: s("il"),
    ilce: s("ilce"),
    ilave_iller: s("ilave_iller"),
    ilave_ilceler: s("ilave_ilceler"),
    kanal: izinli(KANALLAR, s("kanal")),
    ...puanli,
    sirket_sorumlusu: s("sirket_sorumlusu"),
    son_durum: izinli(DURUMLAR, s("son_durum")) || "Yeni Başvuru",
    sorumlu_arama_tarihi: tarih("sorumlu_arama_tarihi"),
    kaybetme_nedeni: izinli(KAYIP_NEDENLERI, s("kaybetme_nedeni")),
    gorusme_notu: s("gorusme_notu"),
    memnuniyet_arama_tarihi: tarih("memnuniyet_arama_tarihi"),
    memnuniyet_neticesi: izinli(MEMNUNIYET, s("memnuniyet_neticesi")),
    memnuniyet_notu: s("memnuniyet_notu"),
    tarihAlani: tarih("tarih"),
  };
}

/** Seçenek listesinde yoksa boş döner — serbest metin sızmasın. */
function izilenSecenek(liste: string[], v: string) {
  return liste.includes(v) ? v : "";
}

export async function basvuruEkle(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazabilirMi();
  if (!profile) return { hata: "Başvuru girme yetkiniz yok." };

  const a = alanlariOku(formData);
  if (!a.isim) return { hata: "İsim zorunlu." };
  if (!a.tarihAlani) return { hata: "Geçerli bir başvuru tarihi girin." };

  const supabase = await createClient();

  // Başvuru no: FRN-#### — mevcut en büyüğün bir fazlası.
  const { data: son } = await supabase
    .from("franchise_basvurulari")
    .select("basvuru_no")
    .like("basvuru_no", "FRN-%")
    .order("basvuru_no", { ascending: false })
    .limit(1);
  const sonNo = Number((son?.[0]?.basvuru_no ?? "FRN-1000").slice(4));
  const yeniNo = `FRN-${(Number.isFinite(sonNo) ? sonNo : 1000) + 1}`;

  const { tarihAlani, ...kalan } = a;
  const { error } = await supabase.from("franchise_basvurulari").insert({
    ...kalan,
    basvuru_no: yeniNo,
    tarih: tarihAlani,
    olusturan_id: profile.id,
    guncelleyen_id: profile.id,
  });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return { hata: "Tablo yok — 0005_franchise_basvuru.sql çalıştırılmalı." };
    }
    return { hata: "Kaydedilemedi: " + error.message };
  }

  revalidatePath("/franchise-basvurulari");
  return { ok: `${yeniNo} — ${a.isim} eklendi` };
}

export async function basvuruGuncelle(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazabilirMi();
  if (!profile) return { hata: "Güncelleme yetkiniz yok." };

  const id = String(formData.get("basvuru_id") ?? "");
  if (!id) return { hata: "Kayıt seçili değil." };

  const a = alanlariOku(formData);
  if (!a.isim) return { hata: "İsim zorunlu." };

  const supabase = await createClient();
  const { tarihAlani, ...kalan } = a;
  const { error } = await supabase
    .from("franchise_basvurulari")
    .update({
      ...kalan,
      ...(tarihAlani ? { tarih: tarihAlani } : {}),
      guncelleyen_id: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { hata: "Güncellenemedi: " + error.message };

  revalidatePath("/franchise-basvurulari");
  return { ok: "Başvuru güncellendi" };
}

export async function basvuruSil(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Silme yetkisi yalnızca admin ve genel müdürde." };
  }
  const id = String(formData.get("basvuru_id") ?? "");
  if (!id) return { hata: "Kayıt seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("franchise_basvurulari").delete().eq("id", id);
  if (error) return { hata: "Silinemedi: " + error.message };

  revalidatePath("/franchise-basvurulari");
  return { ok: "Başvuru silindi" };
}
