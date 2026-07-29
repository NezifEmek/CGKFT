import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Sube } from "@/types/database";
import { ROL_ETIKET } from "@/types/database";
import { KullaniciEkleForm } from "./kullanici-ekle-form";

export default async function KullanicilarSayfasi() {
  const profile = await requireProfile();
  if (profile.rol !== "admin") redirect("/");

  const supabase = await createClient();
  const [{ data: kullanicilar }, { data: subeler }] = await Promise.all([
    supabase.from("profiles").select("*").order("ad_soyad").returns<Profile[]>(),
    supabase.from("subeler").select("*").order("ad").returns<Sube[]>(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Kullanıcılar</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Yeni kullanıcı oluştur, rol ve kapsam (bölge/şube) ata.
      </p>

      <KullaniciEkleForm subeler={subeler ?? []} />

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden mt-6">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">Ad Soyad</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Bölge</th>
            </tr>
          </thead>
          <tbody>
            {(kullanicilar ?? []).map((k) => (
              <tr key={k.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2">{k.ad_soyad || "—"}</td>
                <td className="px-4 py-2">{ROL_ETIKET[k.rol]}</td>
                <td className="px-4 py-2 text-neutral-500">{k.bolge || "—"}</td>
              </tr>
            ))}
            {!kullanicilar?.length && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-neutral-400">
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
