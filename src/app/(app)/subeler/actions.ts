"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { subeKoduUret, kodDenetle, KOD_DESENI } from "@/lib/sube-kod";
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
