"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { haftaBasi } from "@/lib/hafta";
// Sabitler @/lib/plan'da: "use server" dosyasından ihraç edilen dizi/nesne
// istemcide gerçek değer olarak görünmez.
import { PLAN_TURLERI } from "@/lib/plan";

type Sonuc = { hata?: string; ok?: string };
const YOL = "/haftalik-faaliyet";

const m = (f: FormData, a: string) => String(f.get(a) ?? "").trim();

/** Başkasının planına ancak yönetim ve bölge müdürü dokunabilir. */
async function yetkiKontrol(hedefProfilId: string) {
  const profile = await requireProfile();
  const yonetim =
    profile.rol === "admin" || profile.rol === "genel_mudur" || profile.rol === "bolge_muduru";
  if (hedefProfilId !== profile.id && !yonetim) {
    return { profile, hata: "Yalnızca kendi planınızı düzenleyebilirsiniz." };
  }
  return { profile, hata: null };
}

export async function planEkle(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const hedef = m(formData, "profil_id");
  const { profile, hata } = await yetkiKontrol(hedef);
  if (hata) return { hata };

  const hafta = m(formData, "hafta");
  if (!hafta) return { hata: "Hafta seçili değil." };

  const subeId = m(formData, "sube_id") || null;
  const baslik = m(formData, "baslik");
  if (!subeId && !baslik) {
    return { hata: "Şube seçin ya da yapılacak işi yazın." };
  }

  const turHam = m(formData, "tur");
  const gun = m(formData, "gun") || null;

  // Gün seçildiyse gerçekten o haftaya ait olmalı; yoksa plan başka haftada
  // görünmeden kaybolur.
  if (gun && haftaBasi(gun) !== hafta) {
    return { hata: "Seçilen gün bu haftanın içinde değil." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("haftalik_plan").insert({
    profil_id: hedef,
    hafta,
    gun,
    tur: (PLAN_TURLERI as readonly string[]).includes(turHam) ? turHam : "ziyaret",
    sube_id: subeId,
    baslik: subeId ? "" : baslik,
    aciklama: m(formData, "aciklama"),
    olusturan_id: profile.id,
  });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return { hata: "Tablo yok — 0011_haftalik_plan.sql çalıştırılmalı." };
    }
    if (/haftalik_plan_tekil/.test(error.message)) {
      return { hata: "Bu şube o hafta için zaten planlanmış." };
    }
    return { hata: "Eklenemedi: " + error.message };
  }

  revalidatePath(YOL);
  return { ok: "Plana eklendi" };
}

/** Gerçekleşme durumunu elle işaretler. Boş değer = otomatik hesaba dön. */
export async function planDurum(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const hedef = m(formData, "profil_id");
  const { hata } = await yetkiKontrol(hedef);
  if (hata) return { hata };

  const id = m(formData, "plan_id");
  if (!id) return { hata: "Plan satırı seçili değil." };

  const durumHam = m(formData, "durum");
  const durum = ["gerceklesti", "gerceklesmedi", "ertelendi"].includes(durumHam)
    ? durumHam
    : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("haftalik_plan")
    .update({
      durum,
      durum_notu: m(formData, "durum_notu"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { hata: "Kaydedilemedi: " + error.message };
  revalidatePath(YOL);
  return { ok: durum ? "İşaretlendi" : "Otomatik hesaba döndürüldü" };
}

export async function planSil(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const hedef = m(formData, "profil_id");
  const { hata } = await yetkiKontrol(hedef);
  if (hata) return { hata };

  const id = m(formData, "plan_id");
  if (!id) return { hata: "Plan satırı seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("haftalik_plan").delete().eq("id", id);
  if (error) return { hata: "Silinemedi: " + error.message };

  revalidatePath(YOL);
  return { ok: "Plandan çıkarıldı" };
}

/**
 * Geçen haftanın planını bu haftaya kopyalar. Bölge müdürleri her hafta
 * benzer rotayı gezdiği için sıfırdan girmek zaman kaybı.
 */
export async function planKopyala(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const hedef = m(formData, "profil_id");
  const { profile, hata } = await yetkiKontrol(hedef);
  if (hata) return { hata };

  const hafta = m(formData, "hafta");
  const kaynakHafta = m(formData, "kaynak_hafta");
  if (!hafta || !kaynakHafta) return { hata: "Hafta seçili değil." };

  const supabase = await createClient();
  const { data: kaynak, error: okumaHata } = await supabase
    .from("haftalik_plan")
    .select("tur, sube_id, baslik, aciklama")
    .eq("profil_id", hedef)
    .eq("hafta", kaynakHafta);

  if (okumaHata) return { hata: "Okunamadı: " + okumaHata.message };
  if (!kaynak?.length) return { hata: "Önceki haftada kopyalanacak plan yok." };

  // Hedef haftada zaten olanları ayıkla. Tekillik indeksi ifade tabanlı
  // olduğu için upsert/onConflict ile hedeflenemiyor; ayıklama burada.
  const { data: mevcut } = await supabase
    .from("haftalik_plan")
    .select("tur, sube_id, baslik")
    .eq("profil_id", hedef)
    .eq("hafta", hafta);

  const anahtar = (k: { tur: string; sube_id: string | null; baslik: string }) =>
    `${k.tur}|${k.sube_id ?? ""}|${k.sube_id ? "" : k.baslik}`;
  const varOlan = new Set((mevcut ?? []).map(anahtar));

  // Gün bilgisi taşınmaz: geçen haftanın günleri bu haftaya denk gelmez.
  const yeni = kaynak
    .filter((k) => !varOlan.has(anahtar(k)))
    .map((k) => ({ ...k, profil_id: hedef, hafta, gun: null, olusturan_id: profile.id }));

  if (!yeni.length) return { ok: "Kopyalanacak yeni satır yok — hepsi zaten planda." };

  const { error } = await supabase.from("haftalik_plan").insert(yeni);
  if (error) return { hata: "Kopyalanamadı: " + error.message };

  revalidatePath(YOL);
  const atlanan = kaynak.length - yeni.length;
  return {
    ok: `${yeni.length} satır kopyalandı${atlanan ? ` (${atlanan} tanesi zaten vardı)` : ""} — günleri siz belirleyin.`,
  };
}
