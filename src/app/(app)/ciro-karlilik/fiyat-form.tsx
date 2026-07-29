"use client";

import { useActionState } from "react";
import { fiyatModeliKaydet } from "./actions";
import type { FiyatModeli } from "@/types/database";

function Alan({
  ad,
  etiket,
  deger,
  ipucu,
}: {
  ad: string;
  etiket: string;
  deger: number;
  ipucu?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1">{etiket}</label>
      <input
        name={ad}
        type="number"
        step="0.01"
        min="0"
        defaultValue={deger}
        className="w-32 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
      />
      {ipucu && <div className="text-[11px] text-neutral-400 mt-0.5">{ipucu}</div>}
    </div>
  );
}

export function FiyatForm({ model }: { model: FiyatModeli }) {
  const [state, action, pending] = useActionState(fiyatModeliKaydet, null);

  return (
    <details className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <summary className="cursor-pointer text-sm font-medium">
        ✎ Fiyat / Maliyet Modelini Düzenle (Admin/GM)
      </summary>
      <p className="text-xs text-neutral-500 mt-3">
        Bu ekrandaki ciro ve kâr rakamları gerçek fatura verisinden değil, aşağıdaki varsayımsal
        birim fiyat ve maliyetlerden hesaplanır.
      </p>
      <form action={action} className="mt-4 flex flex-wrap items-start gap-4">
        <Alan ad="fiyat_ms" etiket="MŞ satış (TL/kg)" deger={model.satis_fiyati?.MS ?? 0} />
        <Alan
          ad="fiyat_fr_dagitim"
          etiket="FR dağıtım (TL/kg)"
          deger={model.satis_fiyati?.FR_dagitim ?? 0}
        />
        <Alan
          ad="fiyat_fr_lojistik"
          etiket="FR lojistik (TL/kg)"
          deger={model.satis_fiyati?.FR_lojistik ?? 0}
        />
        <Alan
          ad="birim_maliyet"
          etiket="Birim maliyet (TL/kg)"
          deger={model.birim_maliyet_varsayilan ?? 0}
        />
        <Alan
          ad="sabit_gider"
          etiket="Aylık sabit gider (TL)"
          deger={model.sabit_gider_aylik ?? 0}
          ipucu="Net kârdan düşülür"
        />
        <div className="flex items-center gap-3 pt-5">
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
