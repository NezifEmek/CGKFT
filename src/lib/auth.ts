import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GORUNTULEME_CEREZI, type GoruntulemeDurumu } from "@/lib/goruntuleme";
import type { Profile } from "@/types/database";

/**
 * Son hareket damgası bu süreden eskiyse yenilenir (5 dakika).
 *
 * Her sayfa açılışında yazmak gereksiz yük olurdu; 5 dakika hem "şu an
 * kullanıyor mu" sorusunu cevaplayacak kadar hassas, hem de yazma sayısını
 * kişi başına saatte 12'yle sınırlıyor.
 */
const HAREKET_ARALIGI = 5 * 60 * 1000;

/**
 * Giriş yapmış kullanıcının profilini getirir; yoksa /login'e yönlendirir.
 *
 * "Şu kullanıcı gibi görüntüle" modu açıksa HEDEF kişinin profili döner —
 * böylece menü, kapsam, yetki ve prim ekranları onun gördüğü gibi çalışır.
 * Mod yalnızca admin tarafından açılabilir; yazma işlemleri proxy katmanında
 * kapatılıyor.
 */
export async function requireProfile(): Promise<Profile> {
  return (await profilVeGoruntuleme()).profile;
}

/** Profil + görüntüleme durumu. Bandı çizen layout bunu kullanır. */
export async function profilVeGoruntuleme(): Promise<{
  profile: Profile;
  goruntuleme: GoruntulemeDurumu | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: gercekProfil, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !gercekProfil) {
    redirect("/login?hata=profil_bulunamadi");
  }

  const gercek = gercekProfil as Profile;

  // ── Son hareket damgası ───────────────────────────────────────────────
  // "Son giriş" (last_sign_in_at) yalnızca şifreyle girişte değişiyor;
  // oturum açık kalan kullanıcı haftalarca çalışsa bile eski görünüyordu
  // (bkz. 0026). Burada gerçek kullanım işaretleniyor.
  //
  // Her sayfa açılışında yazmıyoruz: HAREKET_ARALIGI'ndan daha yeniyse
  // dokunulmuyor. Böylece yoğun kullanımda bile kişi başına birkaç
  // dakikada bir tek yazma oluyor.
  //
  // Görüntüleme modunda da GERÇEK kullanıcının damgası güncelleniyor:
  // fonksiyon auth.uid() ile çalışıyor, hedef kişinin değil.
  const sonHareket = gercek.son_hareket ? Date.parse(gercek.son_hareket) : 0;
  if (!sonHareket || Date.now() - sonHareket > HAREKET_ARALIGI) {
    // Başarısız olursa sessiz geçiliyor: damga tutulamadı diye kullanıcının
    // sayfası açılmamazlık etmemeli. Sütun/fonksiyon yoksa (0026
    // çalıştırılmamışsa) burası da hata vermeden geçer.
    await supabase.rpc("hareket_kaydet").then(
      () => undefined,
      () => undefined,
    );
  }

  // Görüntüleme modu yalnızca admin için. Çerez elle kurcalansa bile
  // admin olmayan biri başkasının ekranını göremez.
  if (gercek.rol !== "admin") return { profile: gercek, goruntuleme: null };

  const cerezler = await cookies();
  const hedefId = cerezler.get(GORUNTULEME_CEREZI)?.value;
  if (!hedefId || hedefId === gercek.id) return { profile: gercek, goruntuleme: null };

  // Hedef profili service_role ile okunuyor: admin'in RLS görüşü altında
  // bazı profiller görünmeyebilir ve mod sessizce çalışmaz olurdu.
  const admin = createAdminClient();
  const { data: hedef } = await admin
    .from("profiles")
    .select("*")
    .eq("id", hedefId)
    .maybeSingle<Profile>();

  if (!hedef) return { profile: gercek, goruntuleme: null };

  return {
    profile: hedef,
    goruntuleme: {
      hedefId: hedef.id,
      hedefAd: hedef.ad_soyad || "(adsız)",
      gercekId: gercek.id,
      gercekAd: gercek.ad_soyad || "(adsız)",
    },
  };
}
