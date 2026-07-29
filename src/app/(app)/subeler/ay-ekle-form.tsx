"use client";

import { useActionState } from "react";
import { ayEkle } from "./actions";
import { AYLAR_12 } from "@/types/database";

export function AyEkleForm() {
  const [state, action, pending] = useActionState(ayEkle, null);
  const buYil = new Date().getFullYear();

  return (
    <details className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <summary className="cursor-pointer text-sm font-medium">＋ Yeni Ay Tanımla (Admin/GM)</summary>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Yıl</label>
          <input
            name="yil"
            type="number"
            defaultValue={buYil}
            required
            className="w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Ay</label>
          <select
            name="ay"
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          >
            {AYLAR_12.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Gün Sayısı</label>
          <input
            name="gun_sayisi"
            type="number"
            defaultValue={30}
            className="w-20 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Ekleniyor…" : "Ay Ekle"}
        </button>
        {state?.hata && <span className="text-sm text-red-600">{state.hata}</span>}
      </form>
    </details>
  );
}
