import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import { aySirala } from "@/lib/analytics";
import { AyYonetim } from "./ay-yonetim";
import { KgGrid, type GridSube } from "./kg-grid";

const CARI_YIL = 2026;

export default async function AylarVeriSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

  const [{ data: subeler }, satislar, { data: aylar }] = await Promise.all([
    supabase.from("subeler").select("*").order("bolge").order("ad").returns<Sube[]>(),
    tumSatirlariGetir<AylikSatis>((from, to) =>
      supabase.from("aylik_satislar").select("*").range(from, to),
    ),
    supabase.from("aylar").select("*").order("yil").returns<Ay[]>(),
  ]);

  const tumAylar = aylar ?? [];
  const yillar = [...new Set(tumAylar.map((a) => a.yil))].sort((a, b) => b - a);
  const secilenYil = Number(sp.yil) || (yillar.includes(CARI_YIL) ? CARI_YIL : (yillar[0] ?? CARI_YIL));

  const yilAylari = aySirala(tumAylar.filter((a) => a.yil === secilenYil).map((a) => a.ay));

  const gridSubeler: GridSube[] = (subeler ?? []).map((s) => ({
    id: s.id,
    ad: s.ad,
    bolge: s.bolge,
    tip: s.tip,
  }));

  const baslangicDegerler: Record<string, number> = {};
  for (const s of satislar) {
    if (s.yil !== secilenYil) continue;
    baslangicDegerler[`${s.sube_id}|${s.ay}`] = Number(s.kg) || 0;
  }

  const yonetebilir = profile.rol === "admin" || profile.rol === "genel_mudur";
  const duzenlenebilir = profile.rol !== "denetmen";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Aylar & Veri</h1>
        <p className="text-sm text-neutral-500">
          Ay tanımlarını yönetin ve şubelerin aylık kg satışlarını doğrudan tabloya girin.
        </p>
      </div>

      {yonetebilir ? (
        <AyYonetim aylar={tumAylar} yil={secilenYil} />
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 text-sm text-neutral-500">
          Ay ekleme/silme yalnızca Admin ve Genel Müdür içindir.
        </div>
      )}

      <form method="get" className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">Veri girişi yılı:</span>
        <select
          name="yil"
          defaultValue={String(secilenYil)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
        >
          {(yillar.length ? yillar : [CARI_YIL]).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-1.5 text-sm font-medium"
        >
          Göster
        </button>
      </form>

      {yilAylari.length ? (
        <KgGrid
          subeler={gridSubeler}
          aylar={yilAylari}
          yil={secilenYil}
          baslangicDegerler={baslangicDegerler}
          duzenlenebilir={duzenlenebilir}
        />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          {secilenYil} yılı için tanımlı ay yok. Yukarıdan ay ekleyin.
        </div>
      )}
    </div>
  );
}
