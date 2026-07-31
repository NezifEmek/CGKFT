import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Sube } from "@/types/database";
import { KullaniciEkleForm } from "./kullanici-ekle-form";
import { KullaniciSatiri, type KullaniciSatiriVerisi } from "./kullanici-satiri";

export default async function KullanicilarSayfasi() {
  const profile = await requireProfile();
  if (profile.rol !== "admin") redirect("/");

  const supabase = await createClient();
  const admin = createAdminClient();

  // E-posta, son giriş ve engel durumu profiles'ta değil auth şemasında;
  // oraya yalnızca service_role erişebiliyor.
  const [{ data: kullanicilar }, { data: subeler }, authSonuc, denetimler, skorlar, erisimler] =
    await Promise.all([
      supabase.from("profiles").select("*").order("ad_soyad").returns<Profile[]>(),
      supabase.from("subeler").select("*").order("ad").returns<Sube[]>(),
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("denetimler").select("denetmen_id"),
      admin.from("skorlar").select("olusturan_id"),
      admin.from("sube_erisim").select("profil_id, sube_id"),
    ]);

  const erisimMap = new Map<string, string[]>();
  for (const e of erisimler.data ?? []) {
    if (!erisimMap.has(e.profil_id)) erisimMap.set(e.profil_id, []);
    erisimMap.get(e.profil_id)!.push(e.sube_id);
  }

  const authBilgi = new Map(
    (authSonuc.data?.users ?? []).map((u) => [
      u.id,
      {
        eposta: u.email ?? "",
        sonGiris: u.last_sign_in_at ?? null,
        // banned_until geçmişte değilse kullanıcı engelli sayılır.
        engelliMi: Boolean(
          (u as { banned_until?: string }).banned_until &&
            new Date((u as { banned_until?: string }).banned_until!).getTime() > Date.now(),
        ),
      },
    ]),
  );

  const denetimSay = new Map<string, number>();
  for (const d of denetimler.data ?? []) {
    denetimSay.set(d.denetmen_id, (denetimSay.get(d.denetmen_id) ?? 0) + 1);
  }
  const skorSay = new Map<string, number>();
  for (const s of skorlar.data ?? []) {
    skorSay.set(s.olusturan_id, (skorSay.get(s.olusturan_id) ?? 0) + 1);
  }

  const satirlar: KullaniciSatiriVerisi[] = (kullanicilar ?? []).map((k) => {
    const a = authBilgi.get(k.id);
    return {
      id: k.id,
      adSoyad: k.ad_soyad,
      rol: k.rol,
      bolge: k.bolge,
      eposta: a?.eposta ?? "",
      sonGiris: a?.sonGiris ?? null,
      engelliMi: a?.engelliMi ?? false,
      denetimSayisi: denetimSay.get(k.id) ?? 0,
      skorSayisi: skorSay.get(k.id) ?? 0,
      yetki: {
        id: k.id,
        adSoyad: k.ad_soyad,
        rol: k.rol,
        bolge: k.bolge,
        kapsamTuru: k.kapsam_turu ?? "rol",
        kapsamTipi: k.kapsam_tipi ?? null,
        kapsamYetkilisi: k.kapsam_yetkilisi ?? null,
        yazabilir: k.yazabilir ?? false,
        sayfaYetkileri: Array.isArray(k.sayfa_yetkileri) ? k.sayfa_yetkileri : [],
        seciliSubeIdler: erisimMap.get(k.id) ?? [],
      },
    };
  });

  const yetkiSubeler = (subeler ?? []).map((s) => ({
    id: s.id,
    ad: s.ad,
    kod: s.kod ?? "",
    bolge: s.bolge,
    tip: s.tip,
    yetkili: s.merkez_yetkilisi ?? "",
  }));

  const bolgeler = [
    ...new Set((subeler ?? []).map((s) => s.bolge).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "tr"));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Kullanıcılar</h1>
        <p className="text-sm text-neutral-500">
          {satirlar.length} kullanıcı · ada tıklayarak e-posta, rol, şifre ve erişim işlemlerini
          açın
        </p>
      </div>

      <KullaniciEkleForm subeler={subeler ?? []} />

      {authSonuc.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          E-posta ve giriş bilgileri okunamadı ({authSonuc.error.message}). Diğer alanlar
          çalışmaya devam eder.
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">Ad Soyad</th>
              <th className="px-4 py-2">E-posta</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Bölge</th>
              <th className="px-4 py-2">Son giriş</th>
              <th className="px-4 py-2">Durum</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((k) => (
              <KullaniciSatiri
                key={k.id}
                k={k}
                bolgeler={bolgeler}
                subeler={yetkiSubeler}
                benMiyim={k.id === profile.id}
              />
            ))}
            {!satirlar.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  Henüz kullanıcı yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
