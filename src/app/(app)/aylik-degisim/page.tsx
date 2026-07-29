import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import {
  aySirala,
  gunSayisiMap,
  subeKgOzetleri,
  kirilimHesapla,
  kgFmt,
  type SubeKgOzet,
} from "@/lib/analytics";

const CARI_YIL = 2026;
const ONCEKI_YIL = 2025;

export default async function AylikDegisimSayfasi({
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

  const secilenAy = sp.ay ?? tumAylar[tumAylar.length - 1];
  const kapsam = sp.kapsam === "kumulatif" ? "kumulatif" : "tek";
  const baz = sp.baz === "mom" ? "mom" : "yoy";
  const lfl = sp.lfl === "1";

  const ayIdx = Math.max(0, tumAylar.indexOf(secilenAy));
  const donemAAylar = kapsam === "kumulatif" ? tumAylar.slice(0, ayIdx + 1) : [secilenAy];

  let donemBAylar: string[];
  let donemBYil: number;
  let momMevcut = true;
  if (baz === "yoy") {
    donemBAylar = donemAAylar;
    donemBYil = ONCEKI_YIL;
  } else {
    if (ayIdx === 0) {
      momMevcut = false;
      donemBAylar = [];
    } else {
      donemBAylar = [tumAylar[ayIdx - 1]];
    }
    donemBYil = CARI_YIL;
  }

  const ozetA = subeKgOzetleri(subeler ?? [], satislar, CARI_YIL, donemAAylar, gunMap);
  const ozetB: Map<string, SubeKgOzet> = momMevcut
    ? subeKgOzetleri(subeler ?? [], satislar, donemBYil, donemBAylar, gunMap)
    : new Map();

  let idler = (subeler ?? []).map((s) => s.id);
  if (lfl) {
    idler = idler.filter((id) => (ozetA.get(id)?.toplamKg ?? 0) > 0 && (ozetB.get(id)?.toplamKg ?? 0) > 0);
  }

  const acilanlar = (subeler ?? []).filter(
    (s) => (ozetA.get(s.id)?.toplamKg ?? 0) > 0 && !(ozetB.get(s.id)?.toplamKg ?? 0),
  );
  const kapananlar = (subeler ?? []).filter(
    (s) => (ozetB.get(s.id)?.toplamKg ?? 0) > 0 && !(ozetA.get(s.id)?.toplamKg ?? 0),
  );

  const bolgeA = kirilimHesapla(subeler ?? [], ozetA, (s) => s.bolge);
  const bolgeB = kirilimHesapla(subeler ?? [], ozetB, (s) => s.bolge);
  const bolgeBMap = new Map(bolgeB.map((b) => [b.anahtar, b]));
  const bolgeDeltalar = bolgeA
    .map((a) => {
      const b = bolgeBMap.get(a.anahtar);
      const fark = a.toplamKg - (b?.toplamKg ?? 0);
      return { anahtar: a.anahtar, cari: a.toplamKg, onceki: b?.toplamKg ?? 0, fark };
    })
    .sort((x, y) => y.fark - x.fark);

  const degisimler = (subeler ?? [])
    .filter((s) => idler.includes(s.id))
    .map((s) => {
      const a = ozetA.get(s.id)?.toplamKg ?? 0;
      const b = ozetB.get(s.id)?.toplamKg ?? 0;
      return { sube: s, fark: a - b };
    })
    .filter((r) => r.fark !== 0);

  const kazananlar = [...degisimler].sort((a, b) => b.fark - a.fark).slice(0, 8);
  const kaybedenler = [...degisimler].sort((a, b) => a.fark - b.fark).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Aylık Değişim Analizi</h1>
        <p className="text-sm text-neutral-500">
          Bir ay seçip önceki yılın aynı dönemiyle (YoY) ya da bir önceki ayla (MoM) karşılaştırın.
        </p>
      </div>

      <form
        method="get"
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Analiz Ayı</label>
          <select name="ay" defaultValue={secilenAy} className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm">
            {tumAylar.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Kapsam</label>
          <select name="kapsam" defaultValue={kapsam} className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm">
            <option value="tek">Tek Ay</option>
            <option value="kumulatif">Kümülatif (Ocak → seçilen ay)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Karşılaştırma</label>
          <select name="baz" defaultValue={baz} className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm">
            <option value="yoy">YoY (geçen yıl aynı dönem)</option>
            <option value="mom">MoM (bir önceki ay, sadece Tek Ay)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-1.5">
          <input type="checkbox" name="lfl" value="1" defaultChecked={lfl} />
          LFL
        </label>
        <button type="submit" className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium">
          Uygula
        </button>
      </form>

      {!momMevcut && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          {secilenAy} için MoM karşılaştırması yapılamıyor (bu, listedeki ilk ay).
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 font-medium text-sm">
            Yeni Açılanlar ({acilanlar.length})
          </div>
          <div className="max-h-56 overflow-y-auto">
            {acilanlar.map((s) => (
              <div key={s.id} className="px-4 py-1.5 text-sm border-b border-neutral-50 dark:border-neutral-800/50 last:border-0">
                {s.ad} <span className="text-neutral-400 text-xs">({s.bolge})</span>
              </div>
            ))}
            {!acilanlar.length && <div className="px-4 py-4 text-sm text-neutral-400">Yok.</div>}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 font-medium text-sm">
            Kapananlar ({kapananlar.length})
          </div>
          <div className="max-h-56 overflow-y-auto">
            {kapananlar.map((s) => (
              <div key={s.id} className="px-4 py-1.5 text-sm border-b border-neutral-50 dark:border-neutral-800/50 last:border-0">
                {s.ad} <span className="text-neutral-400 text-xs">({s.bolge})</span>
              </div>
            ))}
            {!kapananlar.length && <div className="px-4 py-4 text-sm text-neutral-400">Yok.</div>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 font-medium text-sm">
          Bölge Kırılımı (Fark)
        </div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">Bölge</th>
              <th className="px-4 py-2 text-right">Seçilen Dönem</th>
              <th className="px-4 py-2 text-right">Karşılaştırma</th>
              <th className="px-4 py-2 text-right">Fark</th>
            </tr>
          </thead>
          <tbody>
            {bolgeDeltalar.map((b) => (
              <tr key={b.anahtar} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium">{b.anahtar}</td>
                <td className="px-4 py-2 text-right">{kgFmt(b.cari)}</td>
                <td className="px-4 py-2 text-right">{kgFmt(b.onceki)}</td>
                <td className={`px-4 py-2 text-right ${b.fark >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {kgFmt(b.fark)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 font-medium text-sm">
            En Çok Yükselenler
          </div>
          {kazananlar.map((k) => (
            <div key={k.sube.id} className="px-4 py-1.5 text-sm flex items-center justify-between border-b border-neutral-50 dark:border-neutral-800/50 last:border-0">
              <span>{k.sube.ad}</span>
              <span className="text-emerald-600 font-medium">{kgFmt(k.fark)}</span>
            </div>
          ))}
          {!kazananlar.length && <div className="px-4 py-4 text-sm text-neutral-400">Veri yok.</div>}
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 font-medium text-sm">
            En Çok Düşenler
          </div>
          {kaybedenler.map((k) => (
            <div key={k.sube.id} className="px-4 py-1.5 text-sm flex items-center justify-between border-b border-neutral-50 dark:border-neutral-800/50 last:border-0">
              <span>{k.sube.ad}</span>
              <span className="text-red-600 font-medium">{kgFmt(k.fark)}</span>
            </div>
          ))}
          {!kaybedenler.length && <div className="px-4 py-4 text-sm text-neutral-400">Veri yok.</div>}
        </div>
      </div>
    </div>
  );
}
