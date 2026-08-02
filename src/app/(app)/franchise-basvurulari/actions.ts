"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { subeKoduUret, kodDenetle, KOD_DESENI } from "@/lib/sube-kod";
import type { Sube } from "@/types/database";
import { DURUMLAR, KANALLAR, KAYIP_NEDENLERI, MEMNUNIYET, PUANLI_ALANLAR } from "@/lib/franchise";
import { koordinatCoz } from "@/lib/konum";

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
    adres: s("adres"),
    // Konum: kullanıcı Google Maps bağlantısını yapıştırır, koordinatı biz
    // çıkarırız. Kısa link (goo.gl) çözülemez; bağlantı yine saklanır.
    harita_url: s("harita_url"),
    enlem: koordinatCoz(s("harita_url"))?.enlem ?? null,
    boylam: koordinatCoz(s("harita_url"))?.boylam ?? null,
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
  if (!profile) return { hata: "Görüşme ekleme yetkiniz yok." };
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

// ─── Başvurudan şube açma ─────────────────────────────────────────────────

/**
 * Şube kodu önizlemesi. Sıra no il genelinde tek sayaç olduğu için doğru
 * numarayı bulmak TÜM şubeleri görmeyi gerektirir; bölge müdürünün RLS
 * görüşü kendi bölgesiyle sınırlı olduğundan sayaç service_role ile okunur.
 */
export async function acilisKoduOnizle(
  il: string,
  ilce: string,
): Promise<{ kod: string | null; hata: string | null }> {
  await requireProfile();
  if (!il.trim() || !ilce.trim()) return { kod: null, hata: null };

  const admin = createAdminClient();
  const { data } = await admin.from("subeler").select("id, ad, kod, tip, il, ilce").returns<Sube[]>();
  const sonuc = subeKoduUret("FR", il.trim(), ilce.trim(), data ?? []);
  return { kod: sonuc.kod, hata: sonuc.hata };
}

/**
 * Onaylanan başvurudan şube açar ve ikisini birbirine bağlar.
 *
 * Başvurunun bilgileri şubeye taşınır: başvuran kişi şube yetkilisi,
 * telefonu yetkili cebi olur. Böylece aynı bilgi ikinci kez girilmez.
 *
 * Sorumlu geçmişi (0010) trigger'ı kendiliğinden çalışır — açılışta
 * kimin görevli olduğu geçmişe düşer.
 */
export async function basvurudanSubeAc(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazabilirMi();
  if (!profile) return { hata: "Şube açma yetkiniz yok." };

  const s = (ad: string) => String(formData.get(ad) ?? "").trim();
  const basvuruId = s("basvuru_id");
  if (!basvuruId) return { hata: "Başvuru seçili değil." };

  const supabase = await createClient();
  const { data: basvuru, error: okumaHata } = await supabase
    .from("franchise_basvurulari")
    .select("id, isim, telefon, il, ilce, sube_id")
    .eq("id", basvuruId)
    .maybeSingle<{
      id: string;
      isim: string;
      telefon: string | null;
      il: string | null;
      ilce: string | null;
      sube_id: string | null;
    }>();

  if (okumaHata) {
    if (/column .* sube_id .* does not exist/i.test(okumaHata.message)) {
      return { hata: "Bağlantı sütunu yok — 0014_franchise_sube.sql çalıştırılmalı." };
    }
    return { hata: "Başvuru okunamadı: " + okumaHata.message };
  }
  if (!basvuru) return { hata: "Başvuru bulunamadı." };
  if (basvuru.sube_id) return { hata: "Bu başvurudan zaten bir şube açılmış." };

  const ad = s("ad") || basvuru.isim;
  const il = s("il") || basvuru.il || "";
  const ilce = s("ilce") || basvuru.ilce || "";
  const bolge = s("bolge");

  if (!ad) return { hata: "Şube adı zorunlu." };
  if (!bolge) return { hata: "Bölge seçilmeli." };
  if (!il || !ilce) return { hata: "İl ve ilçe olmadan şube kodu üretilemez." };

  // Kod: elle girildiyse doğrula, girilmediyse üret.
  const admin = createAdminClient();
  const { data: tumSubeler } = await admin
    .from("subeler")
    .select("id, ad, kod, tip, il, ilce")
    .returns<Sube[]>();
  const hepsi = tumSubeler ?? [];

  const elleKod = s("kod").toLocaleUpperCase("tr");
  let kod = "";
  let siraNo = "";

  if (elleKod) {
    const denetim = kodDenetle(elleKod, "FR", il, ilce, hepsi);
    const engelleyen = denetim.hatalar.filter(
      (h) => h.includes("kullanılıyor") || h.includes("formatı"),
    );
    if (engelleyen.length) return { hata: engelleyen.join(" ") };
    kod = elleKod;
    siraNo = elleKod.match(KOD_DESENI)?.[3] ?? "";
  } else {
    const uretim = subeKoduUret("FR", il, ilce, hepsi);
    if (uretim.hata) return { hata: "Kod üretilemedi: " + uretim.hata };
    kod = uretim.kod!;
    siraNo = String(uretim.siraNo).padStart(3, "0");
  }

  const acilisTarihi = /^\d{4}-\d{2}-\d{2}$/.test(s("acilis_tarihi")) ? s("acilis_tarihi") : null;

  const { data: yeniSube, error: subeHata } = await supabase
    .from("subeler")
    .insert({
      ad,
      tip: "FR",
      bolge,
      il,
      ilce,
      kod,
      il_sube_sirasi: siraNo,
      merkez_yetkilisi: s("merkez_yetkilisi"),
      // Başvuran kişi şubenin işletmecisi olur.
      sube_yetkilisi: basvuru.isim,
      yetkili_telefon: basvuru.telefon ?? "",
      aktif: true,
      acilis_tarihi: acilisTarihi,
      acilis_tahmini: formData.get("acilis_tahmini") === "on",
      fiyat_grubu: s("fiyat_grubu") === "lojistik" ? "lojistik" : "dagitim",
    })
    .select("id, kod")
    .maybeSingle<{ id: string; kod: string }>();

  if (subeHata) {
    if (/column .* does not exist/i.test(subeHata.message)) {
      return { hata: "Şube alanları eksik — 0010_sube_ana_veri.sql çalıştırılmalı." };
    }
    return { hata: "Şube açılamadı: " + subeHata.message };
  }
  if (!yeniSube) return { hata: "Şube oluşturuldu ama kaydı okunamadı." };

  // Başvuruyu şubeye bağla. Bu adım başarısız olursa şube ortada kalır —
  // kullanıcıya açıkça söylenmeli, sessizce geçilmemeli.
  const { error: bagHata } = await supabase
    .from("franchise_basvurulari")
    .update({
      sube_id: yeniSube.id,
      sube_acilis_at: new Date().toISOString(),
      son_durum: "Sözleşme / Açılış",
      guncelleyen_id: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", basvuruId);

  revalidatePath("/franchise-basvurulari");
  revalidatePath("/subeler");
  revalidatePath("/sube-yonetimi");
  revalidatePath("/");

  if (bagHata) {
    return {
      hata: `Şube ${yeniSube.kod} koduyla açıldı ancak başvuruya bağlanamadı (${bagHata.message}). Şubeler ekranından kontrol edin.`,
    };
  }

  return { ok: `Şube açıldı: ${ad} — ${yeniSube.kod}` };
}

/** Yanlışlıkla kurulan bağı kaldırır. Şubeyi SİLMEZ. */
export async function subeBagiKaldir(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Bağlantıyı kaldırma yetkisi admin/genel müdürde." };
  }
  const id = String(formData.get("basvuru_id") ?? "");
  if (!id) return { hata: "Başvuru seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("franchise_basvurulari")
    .update({ sube_id: null, sube_acilis_at: null, guncelleyen_id: profile.id })
    .eq("id", id);

  if (error) return { hata: "Kaldırılamadı: " + error.message };
  revalidatePath("/franchise-basvurulari");
  return { ok: "Bağlantı kaldırıldı — şube silinmedi, duruyor." };
}

/**
 * Toplu sorumlu atama.
 *
 * 745 başvurunun 662'sinde sorumlu olarak kişi değil "Genel Ekip" yazıyordu;
 * bunlar temizlenince tek tek atama yapmak pratik olmadığı için toplu araç
 * gerekti. Filtre ekranda uygulanıyor, buraya yalnızca sonuçtaki kimlikler
 * geliyor — böylece kullanıcı neyi değiştirdiğini görerek onaylıyor.
 */
export async function topluSorumluAta(
  kimlikler: string[],
  yeniSorumlu: string,
): Promise<{ guncellenen: number; hata?: string }> {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return { guncellenen: 0, hata: "Bu işlem için yetkiniz yok." };

  const temiz = [...new Set(kimlikler.filter((k) => typeof k === "string" && k))];
  if (!temiz.length) return { guncellenen: 0, hata: "Hiç kayıt seçilmedi." };

  // Atanacak kişi gerçekten sistemde olmalı; yoksa "Genel Ekip" sorunu
  // başka bir adla geri gelir.
  const supabase = await createClient();
  const ad = yeniSorumlu.trim();
  if (ad) {
    const { data: kisi } = await supabase
      .from("profiles")
      .select("ad_soyad")
      .eq("ad_soyad", ad)
      .maybeSingle<{ ad_soyad: string }>();
    if (!kisi) return { guncellenen: 0, hata: `"${ad}" sistemde kayıtlı bir kişi değil.` };
  }

  // Büyük listelerde tek istekte URL sınırına takılmamak için parçalıyoruz.
  const PARCA = 200;
  let toplam = 0;
  for (let i = 0; i < temiz.length; i += PARCA) {
    const { data, error } = await supabase
      .from("franchise_basvurulari")
      .update({ sirket_sorumlusu: ad, guncelleyen_id: profile.id, updated_at: new Date().toISOString() })
      .in("id", temiz.slice(i, i + PARCA))
      .select("id");
    if (error) return { guncellenen: toplam, hata: "Güncellenemedi: " + error.message };
    toplam += data?.length ?? 0;
  }

  revalidatePath("/franchise-basvurulari");
  return { guncellenen: toplam };
}

// ─── Görüşmeler ───────────────────────────────────────────────────────────
// Önceden tek bir gorusme_notu alanı vardı ve ikinci görüşme birincinin
// üstüne yazılıyordu. Artık her görüşme ayrı satır.

const GORUSME_TURLERI = ["telefon", "yuz_yuze", "video", "saha_ziyareti", "diger"];

export async function gorusmeEkle(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazabilirMi();
  if (!profile) return { hata: "Görüşme ekleme yetkiniz yok." };
  const al = (a: string) => String(formData.get(a) ?? "").trim();

  const basvuruId = al("basvuru_id");
  const notlar = al("notlar");
  if (!basvuruId) return { hata: "Başvuru seçili değil." };
  if (!notlar) return { hata: "Görüşme notu boş olamaz." };

  const turHam = al("tur");
  const supabase = await createClient();
  const { error } = await supabase.from("franchise_gorusmeleri").insert({
    basvuru_id: basvuruId,
    tarih: al("tarih") || new Date().toISOString().slice(0, 10),
    tur: GORUSME_TURLERI.includes(turHam) ? turHam : "telefon",
    gorusen: al("gorusen"),
    notlar,
    sonraki_adim: al("sonraki_adim"),
    sonraki_tarih: al("sonraki_tarih") || null,
    olusturan_id: profile.id,
  });

  if (error) {
    if (/relation .* does not exist/i.test(error.message) || /schema cache/i.test(error.message)) {
      return { hata: "Görüşme tablosu yok — 0020_franchise_adres_gorusme.sql çalıştırılmalı." };
    }
    return { hata: "Kaydedilemedi: " + error.message };
  }

  revalidatePath("/franchise-basvurulari");
  return { ok: "Görüşme kaydedildi" };
}

export async function gorusmeSil(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Görüşme silme yetkisi admin/genel müdürdedir — kayıt tutanak niteliğinde." };
  }

  const id = String(formData.get("gorusme_id") ?? "").trim();
  if (!id) return { hata: "Görüşme seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("franchise_gorusmeleri").delete().eq("id", id);
  if (error) return { hata: "Silinemedi: " + error.message };

  revalidatePath("/franchise-basvurulari");
  return { ok: "Görüşme silindi" };
}
