import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Sube } from "@/types/database";
import { SubeEkleForm } from "./sube-ekle-form";

export default async function SubelerSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: subeler } = await supabase
    .from("subeler")
    .select("*")
    .order("bolge")
    .order("ad")
    .returns<Sube[]>();

  const duzenleyebilir = profile.rol === "admin" || profile.rol === "genel_mudur" || profile.rol === "bolge_muduru";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Şubeler</h1>
          <p className="text-sm text-neutral-500">
            {subeler?.length ?? 0} şube görüntüleniyor (rolüne göre filtrelendi).
          </p>
        </div>
      </div>

      {duzenleyebilir && (
        <div className="space-y-3">
          <SubeEkleForm kilitliBolge={profile.rol === "bolge_muduru" ? profile.bolge : null} />
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden mt-6">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">Kod</th>
              <th className="px-4 py-2">Şube</th>
              <th className="px-4 py-2">Bölge</th>
              <th className="px-4 py-2">Tip</th>
              <th className="px-4 py-2">İl / İlçe</th>
              <th className="px-4 py-2">Durum</th>
            </tr>
          </thead>
          <tbody>
            {(subeler ?? []).map((s) => (
              <tr
                key={s.id}
                className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
              >
                <td className="px-4 py-2 font-mono text-xs text-neutral-500 whitespace-nowrap">
                  {s.kod || "—"}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/subeler/${s.id}`} className="font-medium hover:underline">
                    {s.ad}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{s.bolge}</td>
                <td className="px-4 py-2">{s.tip}</td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                  {s.il} {s.ilce ? `/ ${s.ilce}` : ""}
                </td>
                <td className="px-4 py-2">
                  {s.aktif ? (
                    <span className="text-emerald-600 text-xs font-medium">Aktif</span>
                  ) : (
                    <span className="text-neutral-400 text-xs font-medium">Pasif</span>
                  )}
                </td>
              </tr>
            ))}
            {!subeler?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  Görünür şube yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
