import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Ay, Sube, Denetim, Skor } from "@/types/database";
import { SubeGecmisPaneli, type GecmisKayit } from "@/components/sube-gecmis-paneli";
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

  const [{ data: aylar }, { data: satislar }, { data: denetimler }, { data: skorlar }] =
    await Promise.all([
      supabase.from("aylar").select("*").order("yil").returns<Ay[]>(),
      supabase.from("aylik_satislar").select("yil, ay, kg").eq("sube_id", id),
      supabase
        .from("denetimler")
        .select("*")
        .eq("sube_id", id)
        .order("tarih", { ascending: false })
        .limit(10)
        .returns<Denetim[]>(),
      supabase
        .from("skorlar")
        .select("*")
        .eq("sube_id", id)
        .order("tarih", { ascending: false })
        .limit(10)
        .returns<Skor[]>(),
    ]);

  // Denetim + hızlı skor kayıtları tek listede.
  const gecmis: GecmisKayit[] = [
    ...(denetimler ?? []).map((d) => {
      const detay = (d.detay ?? {}) as Record<string, unknown>;
      return {
        id: d.id,
        subeId: d.sube_id,
        tarih: d.tarih,
        puan: d.puan == null ? null : Number(d.puan),
        tur: typeof detay.tur === "string" ? detay.tur : "",
        kaynak: "denetim" as const,
        kisi: typeof detay.denetleyen === "string" ? detay.denetleyen : "",
      };
    }),
    ...(skorlar ?? []).map((s) => {
      const detay = (s.detay ?? {}) as Record<string, unknown>;
      return {
        id: s.id,
        subeId: s.sube_id,
        tarih: s.tarih,
        puan: s.puan == null ? null : Number(s.puan),
        tur: typeof detay.tur === "string" ? detay.tur : "",
        kaynak: "skor" as const,
        kisi: "",
      };
    }),
  ];

  const kgDuzenlenebilir = profile.rol !== "denetmen";
  const denetmenMi = profile.rol === "denetmen";

  return (
    <div>
      <Link href="/subeler" className="text-sm text-neutral-500 hover:underline">
        ← Şubeler
      </Link>
      <div className="flex flex-wrap items-baseline gap-3 mt-2 mb-1">
        <h1 className="text-xl font-semibold">{sube.ad}</h1>
        {sube.kod && (
          <span className="font-mono text-sm px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            {sube.kod}
          </span>
        )}
      </div>
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
          <h2 className="text-sm font-semibold mb-3">Denetim ve Skor Kayıtları</h2>
          <div className="mb-4">
            <SubeGecmisPaneli kayitlar={gecmis} subeId={sube.id} limit={10} />
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
