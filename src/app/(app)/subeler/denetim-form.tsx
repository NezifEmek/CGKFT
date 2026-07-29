"use client";

import { useActionState } from "react";
import { denetimEkle } from "./actions";

export function DenetimForm({ subeId }: { subeId: string }) {
  const [state, action, pending] = useActionState(denetimEkle, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sube_id" value={subeId} />
      <div className="flex items-center gap-3">
        <label className="text-sm text-neutral-600 dark:text-neutral-400 w-20">Puan</label>
        <input
          name="puan"
          type="number"
          min={0}
          max={100}
          required
          className="w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm"
        />
        <span className="text-xs text-neutral-400">/ 100</span>
      </div>
      <div>
        <label className="text-sm text-neutral-600 dark:text-neutral-400 block mb-1">Notlar</label>
        <textarea
          name="notlar"
          rows={3}
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Kaydediliyor…" : "Denetim Kaydet"}
      </button>
      {state?.hata && <p className="text-sm text-red-600">{state.hata}</p>}
    </form>
  );
}
