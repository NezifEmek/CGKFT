"use client";

import { useActionState, useState } from "react";
import { ayEkle, aySil } from "./actions";
import { AYLAR_12, type Ay } from "@/types/database";

/** Artık yıl dahil, seçilen ay/yıl için varsayılan gün sayısı. */
function varsayilanGun(ay: string, yil: number): number {
  const index = AYLAR_12.indexOf(ay as (typeof AYLAR_12)[number]);
  const gunler = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (index === 1 && (yil % 4 === 0 && (yil % 100 !== 0 || yil % 400 === 0))) return 29;
  return gunler[index] ?? 30;
}

export function AyYonetim({ aylar, yil }: { aylar: Ay[]; yil: number }) {
  const [ekleDurum, ekleAction, eklePending] = useActionState(ayEkle, null);
  const [silDurum, silAction, silPending] = useActionState(aySil, null);

  const [seciliAy, setSeciliAy] = useState<string>(AYLAR_12[0]);
  const [seciliYil, setSeciliYil] = useState<number>(yil);

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-4">
      <div>
        <h3 className="font-medium text-sm mb-2">Tanımlı Aylar</h3>
        {aylar.length ? (
          <div className="flex flex-wrap gap-2">
            {aylar.map((a) => (
              <form key={`${a.yil}-${a.ay}`} action={silAction} className="inline-flex">
                <input type="hidden" name="yil" value={a.yil} />
                <input type="hidden" name="ay" value={a.ay} />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 pl-3 pr-1.5 py-1 text-xs">
                  <span>
                    {a.ay} <span className="text-neutral-400">{a.yil}</span>
                    <span className="text-neutral-400"> · {a.gun_sayisi} gün</span>
                  </span>
                  <button
                    type="submit"
                    disabled={silPending}
                    title="Ayı ve o aya ait tüm satış kayıtlarını sil"
                    className="w-5 h-5 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </span>
              </form>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">Henüz tanımlı ay yok.</p>
        )}
        {silDurum?.hata && <div className="text-sm text-red-600 mt-2">{silDurum.hata}</div>}
      </div>

      <form action={ekleAction} className="flex flex-wrap items-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Yıl</label>
          <input
            name="yil"
            type="number"
            value={seciliYil}
            onChange={(e) => setSeciliYil(Number(e.target.value))}
            className="w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Ay</label>
          <select
            name="ay"
            value={seciliAy}
            onChange={(e) => setSeciliAy(e.target.value)}
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
            min={1}
            max={31}
            key={`${seciliAy}-${seciliYil}`}
            defaultValue={varsayilanGun(seciliAy, seciliYil)}
            className="w-20 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={eklePending}
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {eklePending ? "Ekleniyor…" : "＋ Ay Ekle"}
        </button>
        {ekleDurum?.ok && <span className="text-sm text-emerald-600">Eklendi ✓</span>}
        {ekleDurum?.hata && <span className="text-sm text-red-600">{ekleDurum.hata}</span>}
      </form>
    </div>
  );
}
