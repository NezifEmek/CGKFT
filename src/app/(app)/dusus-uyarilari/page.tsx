import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import { aySirala, gunSayisiMap, dususUyarilariHesapla, yuzdeFmt } from "@/lib/analytics";

const CARI_YIL = 2026;

export default async function DususUyarilariSayfasi() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: subeler }, satislar, { data: aylar }] = await Promise.all([
    supabase.from("subeler").select("*").returns<Sube[]>(),
    tumSatirlariGetir<AylikSatis>((from, to) =>
      supabase.from("aylik_satislar").select("*").range(from, to),
    ),
    supabase.from("aylar").select("*").returns<Ay[]>(),
  ]);

  const gunMap = gunSayisiMap(aylar ?? []);
  const aktifAylar = aySirala((aylar ?? []).filter((a) => a.yil === CARI_YIL).map((a) => a.ay));

  const uyarilar = dususUyarilariHesapla(
    subeler ?? [],
    satislar,
    CARI_YIL,
    aktifAylar,
    gunMap,
    3,
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1">Düşüş Uyarıları</h1>
        <p className="text-sm text-neutral-500">
          En az 3 ay üst üste kesintisiz kg/gün düşüşü gösteren şubeler (zirveden son aya göre % düşüş
          ile birlikte).
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">Şube</th>
              <th className="px-4 py-2">Bölge</th>
              <th className="px-4 py-2 text-right">Düşüş Süresi</th>
              <th className="px-4 py-2 text-right">Zirve (kg/gün)</th>
              <th className="px-4 py-2 text-right">Son Ay (kg/gün)</th>
              <th className="px-4 py-2 text-right">% Düşüş</th>
            </tr>
          </thead>
          <tbody>
            {uyarilar.map((u) => (
              <tr
                key={u.subeId}
                className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
              >
                <td className="px-4 py-2 font-medium">{u.subeAd}</td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{u.bolge}</td>
                <td className="px-4 py-2 text-right">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                    {u.streakUzunluk} ay
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-neutral-600 dark:text-neutral-400">
                  {u.zirveAy}: {u.zirveKgGunluk.toFixed(1)}
                </td>
                <td className="px-4 py-2 text-right text-neutral-600 dark:text-neutral-400">
                  {u.sonAy}: {u.sonKgGunluk.toFixed(1)}
                </td>
                <td className="px-4 py-2 text-right text-red-600 font-medium">
                  {yuzdeFmt(u.dususYuzde)}
                </td>
              </tr>
            ))}
            {!uyarilar.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  Düşüş uyarısı yok — tüm görünür şubeler stabil ya da artış eğiliminde.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
