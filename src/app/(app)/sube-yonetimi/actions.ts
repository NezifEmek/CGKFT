"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

/** Formdan gelen şube alanlarını okur (ekle ve güncelle ortak). */
function alanlariOku(formData: FormData, bolgeKilidi: string | null) {
  const metin = (ad: string) => String(formData.get(ad) ?? "").trim();
  const tarih = (ad: string) => {
    const v = metin(ad);
    return v ? v : null;
  };

  const tip = metin("tip") === "MS" ? "MS" : "FR";
  const fiyatGrubuHam = metin("fiyat_grubu");

  return {
    ad: metin("ad"),
    tip,
    bolge: bolgeKilidi ?? metin("bolge") ?? "",
    il: metin("il"),
    ilce: metin("ilce"),
    kod: metin("kod"),
    merkez_yetkilisi: metin("merkez_yetkilisi"),
    sube_yetkilisi: metin("sube_yetkilisi"),
    il_sube_sirasi: metin("il_sube_sirasi"),
    aktif: formData.get("aktif") === "on",
    acilis_tarihi: tarih("acilis_tarihi"),
    kapanis_tarihi: tarih("kapanis_tarihi"),
    acilis_tahmini: formData.get("acilis_tahmini") === "on",
    // fiyat_grubu yalnızca FR için anlamlı; MŞ'de null olmalı (şema check kısıtı).
    fiyat_grubu:
      tip === "FR" ? (fiyatGrubuHam === "lojistik" ? "lojistik" : "dagitim") : null,
  };
}

export async function subeKaydet(_onceki: { hata?: string; ok?: boolean } | null, formData: FormData) {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") {
    return { hata: "Bu işlem için yetkiniz yok." };
  }

  const supabase = await createClient();
  const bolgeKilidi = profile.rol === "bolge_muduru" ? profile.bolge : null;
  const alanlar = alanlariOku(formData, bolgeKilidi);

  if (!alanlar.ad) return { hata: "Şube adı zorunlu." };
  if (!alanlar.bolge) return { hata: "Bölge zorunlu." };

  const subeId = String(formData.get("sube_id") ?? "").trim();

  const { error } = subeId
    ? await supabase.from("subeler").update({ ...alanlar, updated_at: new Date().toISOString() }).eq("id", subeId)
    : await supabase.from("subeler").insert(alanlar);

  if (error) return { hata: (subeId ? "Güncellenemedi: " : "Eklenemedi: ") + error.message };

  revalidatePath("/sube-yonetimi");
  revalidatePath("/subeler");
  revalidatePath("/");
  return { hata: undefined, ok: true };
}

export async function subeSil(_onceki: { hata?: string; ok?: boolean } | null, formData: FormData) {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Şube silme yetkisi yalnızca Admin/Genel Müdür'dedir." };
  }

  const subeId = String(formData.get("sube_id") ?? "").trim();
  if (!subeId) return { hata: "Şube seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("subeler").delete().eq("id", subeId);
  if (error) return { hata: "Silinemedi: " + error.message };

  revalidatePath("/sube-yonetimi");
  revalidatePath("/subeler");
  revalidatePath("/");
  return { hata: undefined, ok: true };
}
