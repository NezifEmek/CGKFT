"use client";

import { useMemo, useState, useTransition } from "react";
import { kgKaydet } from "./actions";

export interface GridSube {
  id: string;
  ad: string;
  bolge: string;
  tip: "MS" | "FR";
}

type Durum = "bekliyor" | "kaydedildi" | "hata";

const sayiFmt = new Intl.NumberFormat("tr-TR");

export function KgGrid({
  subeler,
  aylar,
  yil,
  baslangicDegerler,
  duzenlenebilir,
}: {
  subeler: GridSube[];
  aylar: string[];
  yil: number;
  /** "subeId|ay" -> kg */
  baslangicDegerler: Record<string, number>;
  duzenlenebilir: boolean;
}) {
  const [degerler, setDegerler] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries(baslangicDegerler)) d[k] = String(v);
    return d;
  });
  const [durumlar, setDurumlar] = useState<Record<string, Durum>>({});
  const [, basla] = useTransition();

  const [arama, setArama] = useState("");
  const [bolgeFiltre, setBolgeFiltre] = useState("");

  const bolgeler = useMemo(
    () => [...new Set(subeler.map((s) => s.bolge))].sort(),
    [subeler],
  );

  const listelenen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    return subeler.filter((s) => {
      if (bolgeFiltre && s.bolge !== bolgeFiltre) return false;
      if (!q) return true;
      return s.ad.toLocaleLowerCase("tr").includes(q);
    });
  }, [subeler, arama, bolgeFiltre]);

  function anahtar(subeId: string, ay: string) {
    return `${subeId}|${ay}`;
  }

  function hucreKaydet(subeId: string, ay: string, ham: string) {
    const k = anahtar(subeId, ay);
    const eskiHam = baslangicDegerler[k] !== undefined ? String(baslangicDegerler[k]) : "";
    const temiz = ham.trim().replace(",", ".");

    // Değişmediyse sunucuya gitme.
    if (temiz === eskiHam) return;

    const kg = temiz === "" ? null : Number(temiz);
    if (kg !== null && (!Number.isFinite(kg) || kg < 0)) {
      setDurumlar((d) => ({ ...d, [k]: "hata" }));
      return;
    }

    setDurumlar((d) => ({ ...d, [k]: "bekliyor" }));
    basla(async () => {
      const sonuc = await kgKaydet(subeId, yil, ay, kg);
      setDurumlar((d) => ({ ...d, [k]: sonuc?.hata ? "hata" : "kaydedildi" }));
      if (!sonuc?.hata) baslangicDegerler[k] = kg ?? Number.NaN;
    });
  }

  function satirToplam(subeId: string) {
    let t = 0;
    for (const ay of aylar) {
      const v = Number(degerler[anahtar(subeId, ay)]);
      if (Number.isFinite(v)) t += v;
    }
    return t;
  }

  const sutunToplam = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ay of aylar) {
      let t = 0;
      for (const s of listelenen) {
        const v = Number(degerler[anahtar(s.id, ay)]);
        if (Number.isFinite(v)) t += v;
      }
      m[ay] = t;
    }
    return m;
  }, [aylar, listelenen, degerler]);

  function hucreSinif(k: string) {
    const d = durumlar[k];
    if (d === "bekliyor") return "border-amber-400";
    if (d === "kaydedildi") return "border-emerald-500";
    if (d === "hata") return "border-red-500";
    return "border-neutral-200 dark:border-neutral-700";
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-2 items-center">
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Şube ara…"
          className="flex-1 min-w-40 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm"
        />
        <select
          value={bolgeFiltre}
          onChange={(e) => setBolgeFiltre(e.target.value)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">Tüm bölgeler</option>
          {bolgeler.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">{listelenen.length} şube</span>
      </div>

      {duzenlenebilir && (
        <div className="px-3 py-2 text-[11px] text-neutral-500 border-b border-neutral-100 dark:border-neutral-800">
          Hücreden çıkınca otomatik kaydedilir. Boş bırakmak &quot;o ay veri yok&quot; anlamına gelir
          (0 kg&apos;dan farklıdır).
        </div>
      )}

      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-neutral-50 dark:bg-neutral-800 text-left text-xs text-neutral-500">
              <th className="px-3 py-2 sticky left-0 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                Şube
              </th>
              {aylar.map((ay) => (
                <th
                  key={ay}
                  className="px-2 py-2 text-right border-b border-neutral-200 dark:border-neutral-700"
                >
                  {ay}
                </th>
              ))}
              <th className="px-3 py-2 text-right border-b border-neutral-200 dark:border-neutral-700">
                Toplam
              </th>
            </tr>
          </thead>
          <tbody>
            {listelenen.map((s) => (
              <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                <td className="px-3 py-1 sticky left-0 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="block text-[13px] font-medium truncate max-w-56">{s.ad}</span>
                  <span className="block text-[10px] text-neutral-400">
                    {s.bolge} · {s.tip === "MS" ? "MŞ" : "FR"}
                  </span>
                </td>
                {aylar.map((ay) => {
                  const k = anahtar(s.id, ay);
                  return (
                    <td
                      key={ay}
                      className="px-1 py-1 border-b border-neutral-100 dark:border-neutral-800"
                    >
                      <input
                        type="number"
                        min="0"
                        step="1"
                        disabled={!duzenlenebilir}
                        value={degerler[k] ?? ""}
                        onChange={(e) => setDegerler((d) => ({ ...d, [k]: e.target.value }))}
                        onBlur={(e) => hucreKaydet(s.id, ay, e.target.value)}
                        className={`w-20 rounded border bg-transparent px-1.5 py-1 text-right text-[13px] disabled:opacity-60 ${hucreSinif(k)}`}
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-1 text-right font-medium border-b border-neutral-100 dark:border-neutral-800">
                  {sayiFmt.format(Math.round(satirToplam(s.id)))}
                </td>
              </tr>
            ))}
            {!listelenen.length && (
              <tr>
                <td colSpan={aylar.length + 2} className="px-3 py-8 text-center text-neutral-400">
                  Eşleşen şube yok.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-neutral-100 dark:bg-neutral-800 font-bold text-[13px]">
              <td className="px-3 py-2 sticky left-0 bg-neutral-100 dark:bg-neutral-800">TOPLAM</td>
              {aylar.map((ay) => (
                <td key={ay} className="px-2 py-2 text-right">
                  {sayiFmt.format(Math.round(sutunToplam[ay] ?? 0))}
                </td>
              ))}
              <td className="px-3 py-2 text-right">
                {sayiFmt.format(
                  Math.round(Object.values(sutunToplam).reduce((t, v) => t + v, 0)),
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
