import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Ay, Sube, Denetim } from "@/types/database";
import { KgGrid } from "../kg-grid";
import { DenetimForm } from "../denetim-form";

export default async function SubeDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: sube } = await supabase
    .from("subeler")
    .select("*")
    .eq("id", id)
    .maybeSingle<Sube>();

  if (!sube) notFound();

  const [{ data: aylar }, { data: satislar }, { data: denetimler }] = await Promise.all([
    supabase.from("aylar").select("*").order("yil").returns<Ay[]>(),
    supabase.from("aylik_satislar").select("yil, ay, kg").eq("sube_id", id),
    supabase
      .from("denetimler")
      .select("*")
      .eq("sube_id", id)
      .order("tarih", { ascending: false })
      .limit(10)
      .returns<Denetim[]>(),
  ]);

  const kgDuzenlenebilir = profile.rol !== "denetmen";
  const denetmenMi = profile.rol === "denetmen";

  return (
    <div>
      <Link href="/subeler" className="text-sm text-neutral-500 hover:underline">
        ← Şubeler
      </Link>
      <h1 className="text-xl font-semibold mt-2 mb-1">{sube.ad}</h1>
      <p className="text-sm text-neutral-500 mb-6">
        {sube.bolge} · {sube.tip === "MS" ? "Merkez Şube" : "Franchise"}
        {sube.il ? ` · ${sube.il}` : ""}
        {sube.ilce ? ` / ${sube.ilce}` : ""}
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <h2 className="text-sm font-semibold mb-3">Aylık Satış (kg)</h2>
          <KgGrid
            subeId={sube.id}
            aylar={aylar ?? []}
            baslangicVeri={satislar ?? []}
            duzenlenebilir={kgDuzenlenebilir}
          />
          {!kgDuzenlenebilir && (
            <p className="text-xs text-neutral-400 mt-3">
              Denetmen rolü satış verisini görüntüler, düzenleyemez.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <h2 className="text-sm font-semibold mb-3">Denetim Kayıtları</h2>
          <div className="space-y-2 mb-4">
            {(denetimler ?? []).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between text-sm border-b border-neutral-100 dark:border-neutral-800 pb-2"
              >
                <span className="text-neutral-500">{d.tarih}</span>
                <span className="font-medium">{d.puan}/100</span>
              </div>
            ))}
            {!denetimler?.length && (
              <p className="text-sm text-neutral-400">Henüz denetim kaydı yok.</p>
            )}
          </div>

          {denetmenMi && (
            <>
              <h3 className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
                Yeni Denetim Ekle
              </h3>
              <DenetimForm subeId={sube.id} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
