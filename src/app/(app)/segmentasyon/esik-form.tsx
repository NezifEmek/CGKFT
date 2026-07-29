"use client";

import { useActionState, useState } from "react";
import { esiklerKaydet } from "./actions";
import type { Esik } from "@/lib/analytics";

export function EsikForm({ esikler, baz }: { esikler: Esik[]; baz: string }) {
  const [state, action, pending] = useActionState(esiklerKaydet, null);
  const [satirlar, setSatirlar] = useState<Esik[]>(esikler.length ? esikler : [{ ad: "", min: 0, renk: "#999999" }]);

  function satirGuncelle(i: number, alan: keyof Esik, deger: string) {
    setSatirlar((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [alan]: alan === "min" ? Number(deger) : deger } : s)),
    );
  }

  return (
    <details className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <summary className="cursor-pointer text-sm font-medium">✎ Eşikleri Düzenle (Admin/GM)</summary>
      <form action={action} className="mt-4 space-y-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Baz</label>
          <select
            name="baz"
            defaultValue={baz}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="KÜMÜLATİF">Kümülatif (tüm aylar)</option>
          </select>
        </div>

        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr>
              <th className="py-1">Segment Adı</th>
              <th className="py-1">Min Kg/Gün</th>
              <th className="py-1">Renk</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input
                    name="ad"
                    value={s.ad}
                    onChange={(e) => satirGuncelle(i, "ad", e.target.value)}
                    className="w-20 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    name="min"
                    type="number"
                    step="0.01"
                    value={s.min}
                    onChange={(e) => satirGuncelle(i, "min", e.target.value)}
                    className="w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-1">
                  <input
                    name="renk"
                    type="color"
                    value={s.renk}
                    onChange={(e) => satirGuncelle(i, "renk", e.target.value)}
                    className="h-7 w-12 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSatirlar((prev) => [...prev, { ad: "", min: 0, renk: "#999999" }])}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm"
          >
            ＋ Satır Ekle
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {state?.hata && <span className="text-sm text-red-600">{state.hata}</span>}
        </div>
      </form>
    </details>
  );
}
