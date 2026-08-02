"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { VARSAYILAN_PRIM_AYARLARI, primAyarlariNormalize } from "@/lib/dokuman";
import type { PrimAyarlari, PrimPersonel } from "@/lib/dokuman-varsayilan";

type Sonuc = { hata?: string; ok?: string };

async function yazmaYetkisi() {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") return null;
  return profile;
}

/** "Ad | Unvan" satırlarını personel listesine çevirir (eski parsePersonel). */
function personelAyristir(ham: string): PrimPersonel[] {
  return ham
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((satir) => {
      const [ad, unvan] = satir.split("|").map((x) => x.trim());
      return { ad: ad || "", unvan: unvan || "" };
    });
}

export async function primAyarlariKaydet(
  _onceki: Sonuc | null,
  formData: FormData,
): Promise<Sonuc> {
  const profile = await yazmaYetkisi();
  if (!profile) return { hata: "Prim ayarlarını değiştirme yetkiniz yok." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("dokuman_ayarlari")
    .select("prim_ayarlari")
    .eq("id", 1)
    .maybeSingle<{ prim_ayarlari: unknown }>();
  const mevcut = primAyarlariNormalize(data?.prim_ayarlari);

  // Sayısal alan: boş/geçersizse mevcut değeri korur, sıfıra düşmez.
  const sayi = (ad: string, varsayilan: number) => {
    const ham = formData.get(ad);
    if (ham === null || String(ham).trim() === "") return varsayilan;
    const n = Number(String(ham).replace(",", "."));
    return Number.isFinite(n) ? n : varsayilan;
  };
  const metin = (ad: string, varsayilan: string) => {
    const ham = formData.get(ad);
    return ham === null ? varsayilan : String(ham).trim();
  };
  // Dağıtım oranları ekranda yüzde olarak girilir, oran olarak saklanır.
  const oran = (ad: string, varsayilan: number) => sayi(ad, varsayilan * 100) / 100;

  const yeni: PrimAyarlari = {
    ...mevcut,
    merkez_taban_kg: sayi("merkez_taban_kg", mevcut.merkez_taban_kg),
    bolge1_taban_kg: sayi("bolge1_taban_kg", mevcut.bolge1_taban_kg),
    bolge2_taban_kg: sayi("bolge2_taban_kg", mevcut.bolge2_taban_kg),
    merkez_sube_hedef_kg: sayi("merkez_sube_hedef_kg", mevcut.merkez_sube_hedef_kg),
    bolge1_sube_hedef_kg: sayi("bolge1_sube_hedef_kg", mevcut.bolge1_sube_hedef_kg),
    bolge2_sube_hedef_kg: sayi("bolge2_sube_hedef_kg", mevcut.bolge2_sube_hedef_kg),
    uretim_katsayi_tl: sayi("uretim_katsayi_tl", mevcut.uretim_katsayi_tl),
    merkez_katsayi_tl: sayi("merkez_katsayi_tl", mevcut.merkez_katsayi_tl),
    bolge_katsayi_tl: sayi("bolge_katsayi_tl", mevcut.bolge_katsayi_tl),
    uretim_dagilim: {
      merkez: oran("ud_merkez", mevcut.uretim_dagilim.merkez),
      bolge: oran("ud_bolge", mevcut.uretim_dagilim.bolge),
      uretim: oran("ud_uretim", mevcut.uretim_dagilim.uretim),
    },
    merkez_dagilim: {
      uretim: oran("md_uretim", mevcut.merkez_dagilim.uretim),
      bolge: oran("md_bolge", mevcut.merkez_dagilim.bolge),
      merkez: oran("md_merkez", mevcut.merkez_dagilim.merkez),
    },
    bolge_dagilim: {
      sorumlu: oran("bd_sorumlu", mevcut.bolge_dagilim.sorumlu),
      merkez: oran("bd_merkez", mevcut.bolge_dagilim.merkez),
      uretim: oran("bd_uretim", mevcut.bolge_dagilim.uretim),
    },
    bolge1_ad: metin("bolge1_ad", mevcut.bolge1_ad),
    bolge2_ad: metin("bolge2_ad", mevcut.bolge2_ad),
    merkez_sorumlu_ad: metin("merkez_sorumlu_ad", mevcut.merkez_sorumlu_ad),
    personel_uretim: personelAyristir(String(formData.get("personel_uretim") ?? "")),
    personel_merkez: personelAyristir(String(formData.get("personel_merkez") ?? "")),
  };

  if (!yeni.personel_uretim.length || !yeni.personel_merkez.length) {
    return { hata: "Üretim ve merkez personel listeleri boş bırakılamaz." };
  }

  const { error } = await supabase
    .from("dokuman_ayarlari")
    .update({
      prim_ayarlari: yeni,
      guncelleyen_id: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { hata: "Kaydedilemedi: " + error.message };

  revalidatePath("/prim-hakedis");
  revalidatePath("/prim-projeksiyon");
  return { ok: "Prim ayarları kaydedildi" };
}

export async function primAyarlariSifirla(_: Sonuc | null): Promise<Sonuc> {
  const profile = await yazmaYetkisi();
  if (!profile) return { hata: "Prim ayarlarını değiştirme yetkiniz yok." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dokuman_ayarlari")
    .update({
      prim_ayarlari: VARSAYILAN_PRIM_AYARLARI,
      guncelleyen_id: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { hata: "Sıfırlanamadı: " + error.message };

  revalidatePath("/prim-hakedis");
  revalidatePath("/prim-projeksiyon");
  return { ok: "Prim ayarları Word belgesindeki orijinal değerlere döndürüldü" };
}
