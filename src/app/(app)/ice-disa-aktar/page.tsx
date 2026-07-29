import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import { AktarArayuz, type AktarSube, type AktarSatis } from "./aktar-arayuz";

const CARI_YIL = 2026;

export default async function IceDisaAktarSayfasi({
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
    supabase.from("aylar").select("*").returns<Ay[]>(),
  ]);

  const tumAylar = aylar ?? [];
  const yillar = [...new Set(tumAylar.map((a) => a.yil))].sort((a, b) => b - a);
  const secilenYil = Number(sp.yil) || (yillar.includes(CARI_YIL) ? CARI_YIL : (yillar[0] ?? CARI_YIL));

  const aktarSubeler: AktarSube[] = (subeler ?? []).map((s) => ({
    id: s.id,
    ad: s.ad,
    kod: s.kod,
    bolge: s.bolge,
    tip: s.tip,
    il: s.il,
    ilce: s.ilce,
  }));

  const aktarSatislar: AktarSatis[] = satislar.map((s) => ({
    sube_id: s.sube_id,
    yil: s.yil,
    ay: s.ay,
    kg: Number(s.kg) || 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">İçe / Dışa Aktar</h1>
        <p className="text-sm text-neutral-500">
          Verilerinizi Excel veya JSON olarak indirin, doldurduğunuz Excel dosyasını geri yükleyin.
        </p>
      </div>

      <form method="get" className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">Yıl:</span>
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

      <AktarArayuz
        subeler={aktarSubeler}
        satislar={aktarSatislar}
        aylar={tumAylar}
        varsayilanYil={secilenYil}
        yazabilir={profile.rol !== "denetmen"}
      />
    </div>
  );
}
