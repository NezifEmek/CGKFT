"use client";

import { useActionState, useRef } from "react";
import { subeEkle } from "./actions";

export function SubeEkleForm({ kilitliBolge }: { kilitliBolge: string | null }) {
  const [state, action, pending] = useActionState(subeEkle, null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <details className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <summary className="cursor-pointer text-sm font-medium">＋ Yeni Şube Ekle</summary>
      <form
        ref={formRef}
        action={async (fd) => {
          await action(fd);
          formRef.current?.reset();
        }}
        className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3"
      >
        <input
          name="ad"
          placeholder="Şube adı"
          required
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <select
          name="tip"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        >
          <option value="MS">Merkez Şube (MŞ)</option>
          <option value="FR">Franchise (FR)</option>
        </select>
        {kilitliBolge ? (
          <input type="hidden" name="bolge" value={kilitliBolge} />
        ) : (
          <input
            name="bolge"
            placeholder="Bölge"
            required
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          />
        )}
        <input
          name="il"
          placeholder="İl"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <input
          name="ilce"
          placeholder="İlçe"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <input
          name="kod"
          placeholder="Şube kodu (ops.)"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <div className="col-span-full flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Ekleniyor…" : "Şube Ekle"}
          </button>
          {kilitliBolge && (
            <span className="text-xs text-neutral-500">Bölge: {kilitliBolge} (otomatik)</span>
          )}
          {state?.hata && <span className="text-sm text-red-600">{state.hata}</span>}
        </div>
      </form>
    </details>
  );
}
