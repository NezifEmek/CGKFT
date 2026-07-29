import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import {
  aySirala,
  gunSayisiMap,
  subeKgOzetleri,
  periyotOzetKarsilastir,
  kgFmt,
  yuzdeFmt,
} from "@/lib/analytics";

const CARI_YIL = 2026;
const ONCEKI_YIL = 2025;

export default async function YoyKarsilastirmaSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

  const [{ data: subeler }, satislar, { data: aylar }] = await Promise.all([
    supabase.from("subeler").select("*").returns<Sube[]>(),
    tumSatirlariGetir<AylikSatis>((from, to) =>
      supabase.from("aylik_satislar").select("*").range(from, to),
    ),
    supabase.from("aylar").select("*").returns<Ay[]>(),
  ]);

  const gunMap = gunSayisiMap(aylar ?? []);
  const tumAylar = aySirala((aylar ?? []).filter((a) => a.yil === CARI_YIL).map((a) => a.ay));

  const scope = sp.scope ?? "genel";
  const deger = sp.deger ?? "";
  const baslangic = sp.baslangic ?? tumAylar[0];
  const bitis = sp.bitis ?? tumAylar[tumAylar.length - 1];
  const lfl = sp.lfl === "1";

  const baslangicIdx = Math.max(0, tumAylar.indexOf(baslangic));
  const bitisIdx = Math.max(baslangicIdx, tumAylar.indexOf(bitis));
  const secilenAylar = tumAylar.slice(baslangicIdx, bitisIdx + 1);

  let scopedSubeler = subeler ?? [];
  if (scope === "bolge" && deger) scopedSubeler = scopedSubeler.filter((s) => s.bolge === deger);
  else if (scope === "il" && deger) scopedSubeler = scopedSubeler.filter((s) => s.il === deger);
  else if (scope === "sube" && deger) scopedSubeler = scopedSubeler.filter((s) => s.id === deger);

  const ozetCari = subeKgOzetleri(scopedSubeler, satislar, CARI_YIL, secilenAylar, gunMap);
  const ozetOnceki = subeKgOzetleri(scopedSubeler, satislar, ONCEKI_YIL, secilenAylar, gunMap);

  const karsilastirma = periyotOzetKarsilastir(scopedSubeler, ozetCari, ozetOnceki, lfl);

  const bolgeler = [...new Set((subeler ?? []).map((s) => s.bolge))].sort();
  const iller = [...new Set((subeler ?? []).map((s) => s.il).filter(Boolean))].sort();

  const subeSatirlari = scopedSubeler
    .map((s) => {
      const a = ozetCari.get(s.id);
      const b = ozetOnceki.get(s.id);
      if (lfl && (!a?.toplamKg || !b?.toplamKg)) return null;
      if (!a?.toplamKg && !b?.toplamKg) return null;
      const fark = (a?.toplamKg ?? 0) - (b?.toplamKg ?? 0);
      const farkYuzde = b?.toplamKg ? (fark / b.toplamKg) * 100 : null;
      return { sube: s, cari: a?.toplamKg ?? 0, onceki: b?.toplamKg ?? 0, fark, farkYuzde };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((x, y) => y.cari - x.cari);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">{CARI_YIL} vs {ONCEKI_YIL}</h1>
        <p className="text-sm text-neutral-500">Yıldan yıla kg karşılaştırması.</p>
      </div>

      <form
        method="get"
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Kapsam</label>
          <select name="scope" defaultValue={scope} className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm">
            <option value="genel">Genel</option>
            <option value="bolge">Bölge</option>
            <option value="il">İl</option>
            <option value="sube">Şube</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Değer</label>
          <select name="deger" defaultValue={deger} className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm min-w-40">
            <option value="">—</option>
            {scope === "bolge" && bolgeler.map((b) => <option key={b} value={b}>{b}</option>)}
            {scope === "il" && iller.map((i) => <option key={i} value={i}>{i}</option>)}
            {scope === "sube" && (subeler ?? []).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Başlangıç Ay</label>
          <select name="baslangic" defaultValue={baslangic} className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm">
            {tumAylar.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Bitiş Ay</label>
          <select name="bitis" defaultValue={bitis} className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm">
            {tumAylar.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-1.5">
          <input type="checkbox" name="lfl" value="1" defaultChecked={lfl} />
          LFL (sadece her iki yılda da veri olan şubeler)
        </label>
        <button type="submit" className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium">
          Uygula
        </button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="text-xs text-neutral-500 mb-1">{CARI_YIL}</div>
          <div className="text-lg font-semibold">{kgFmt(karsilastirma.a.toplamKg)}</div>
          <div className="text-xs text-neutral-400">{karsilastirma.a.subeSayisi} şube</div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="text-xs text-neutral-500 mb-1">{ONCEKI_YIL}</div>
          <div className="text-lg font-semibold">{kgFmt(karsilastirma.b.toplamKg)}</div>
          <div className="text-xs text-neutral-400">{karsilastirma.b.subeSayisi} şube</div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="text-xs text-neutral-500 mb-1">Fark</div>
          <div className={`text-lg font-semibold ${karsilastirma.farkKg >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {kgFmt(karsilastirma.farkKg)}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="text-xs text-neutral-500 mb-1">% Değişim</div>
          <div className={`text-lg font-semibold ${karsilastirma.farkYuzde >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {yuzdeFmt(karsilastirma.farkYuzde)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">Şube</th>
              <th className="px-4 py-2">Bölge</th>
              <th className="px-4 py-2 text-right">{CARI_YIL}</th>
              <th className="px-4 py-2 text-right">{ONCEKI_YIL}</th>
              <th className="px-4 py-2 text-right">Fark</th>
              <th className="px-4 py-2 text-right">% Değişim</th>
            </tr>
          </thead>
          <tbody>
            {subeSatirlari.map((s) => (
              <tr key={s.sube.id} className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                <td className="px-4 py-2 font-medium">{s.sube.ad}</td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{s.sube.bolge}</td>
                <td className="px-4 py-2 text-right">{kgFmt(s.cari)}</td>
                <td className="px-4 py-2 text-right">{kgFmt(s.onceki)}</td>
                <td className={`px-4 py-2 text-right ${s.fark >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {kgFmt(s.fark)}
                </td>
                <td className={`px-4 py-2 text-right ${(s.farkYuzde ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {s.farkYuzde != null ? yuzdeFmt(s.farkYuzde) : "—"}
                </td>
              </tr>
            ))}
            {!subeSatirlari.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">Görünür veri yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
