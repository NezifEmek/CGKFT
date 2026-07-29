"use client";

import { useState, useTransition } from "react";
import { kgKaydet } from "./actions";
import type { Ay } from "@/types/database";

interface Satir {
  yil: number;
  ay: string;
  kg: number;
}

export function KgGrid({
  subeId,
  aylar,
  baslangicVeri,
  duzenlenebilir,
}: {
  subeId: string;
  aylar: Ay[];
  baslangicVeri: Satir[];
  duzenlenebilir: boolean;
}) {
  const [veri, setVeri] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const s of baslangicVeri) m[`${s.yil}-${s.ay}`] = s.kg;
    return m;
  });
  const [pending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  function kaydet(yil: number, ay: string, deger: string) {
    const kg = Number(deger || 0);
    setVeri((v) => ({ ...v, [`${yil}-${ay}`]: kg }));
    startTransition(async () => {
      const sonuc = await kgKaydet(subeId, yil, ay, kg);
      setHata(sonuc?.hata ?? null);
    });
  }

  if (!aylar.length) {
    return (
      <p className="text-sm text-neutral-500">
        Henüz sisteme tanımlı ay yok. Admin/Genel Müdür &quot;Ay Ekle&quot; ile yeni ay
        tanımlayabilir.
      </p>
    );
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-neutral-500">
          <tr>
            <th className="py-1 pr-4">Yıl</th>
            <th className="py-1 pr-4">Ay</th>
            <th className="py-1 pr-4">Gün</th>
            <th className="py-1">Kg</th>
          </tr>
        </thead>
        <tbody>
          {aylar.map((a) => {
            const key = `${a.yil}-${a.ay}`;
            return (
              <tr key={key} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="py-1.5 pr-4 text-neutral-500">{a.yil}</td>
                <td className="py-1.5 pr-4">{a.ay}</td>
                <td className="py-1.5 pr-4 text-neutral-500">{a.gun_sayisi}</td>
                <td className="py-1.5">
                  {duzenlenebilir ? (
                    <input
                      type="number"
                      defaultValue={veri[key] ?? ""}
                      onBlur={(e) => kaydet(a.yil, a.ay, e.target.value)}
                      className="w-28 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm"
                    />
                  ) : (
                    <span>{veri[key] ?? 0}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pending && <p className="text-xs text-neutral-400 mt-2">Kaydediliyor…</p>}
      {hata && <p className="text-xs text-red-600 mt-2">{hata}</p>}
    </div>
  );
}
