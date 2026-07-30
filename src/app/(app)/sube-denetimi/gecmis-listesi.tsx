"use client";

import { useActionState, useMemo, useState } from "react";
import { denetimSil } from "./actions";
import { KATEGORILER, grupBul } from "@/lib/denetim-sorulari";

export interface GecmisKaydi {
  id: string;
  subeId: string;
  subeAd: string;
  bolge: string;
  tarih: string;
  puan: number | null;
  notlar: string;
  tur: string;
  denetleyen: string;
  bolumPuanlar: Record<string, number>;
}

export function GecmisListesi({
  kayitlar,
  silebilir,
}: {
  kayitlar: GecmisKaydi[];
  silebilir: boolean;
}) {
  const [silDurum, silAction, silPending] = useActionState(denetimSil, null);
  const [subeFiltre, setSubeFiltre] = useState("");
  const [turFiltre, setTurFiltre] = useState("");
  const [acikId, setAcikId] = useState<string | null>(null);

  const subeAdlari = useMemo(
    () => [...new Set(kayitlar.map((k) => k.subeAd))].sort((a, b) => a.localeCompare(b, "tr")),
    [kayitlar],
  );
  const turler = useMemo(() => [...new Set(kayitlar.map((k) => k.tur).filter(Boolean))], [kayitlar]);

  const listelenen = useMemo(
    () =>
      kayitlar.filter(
        (k) => (!subeFiltre || k.subeAd === subeFiltre) && (!turFiltre || k.tur === turFiltre),
      ),
    [kayitlar, subeFiltre, turFiltre],
  );

  /** Aynı şubenin bir önceki denetimine göre puan farkı. */
  const farklar = useMemo(() => {
    const m = new Map<string, number | null>();
    const subeyeGore = new Map<string, GecmisKaydi[]>();
    for (const k of kayitlar) {
      if (!subeyeGore.has(k.subeId)) subeyeGore.set(k.subeId, []);
      subeyeGore.get(k.subeId)!.push(k);
    }
    for (const liste of subeyeGore.values()) {
      // Tarihe göre eskiden yeniye
      const sirali = [...liste].sort((a, b) => a.tarih.localeCompare(b.tarih));
      sirali.forEach((k, i) => {
        const onceki = i > 0 ? sirali[i - 1].puan : null;
        m.set(k.id, onceki != null && k.puan != null ? k.puan - onceki : null);
      });
    }
    return m;
  }, [kayitlar]);

  if (!kayitlar.length) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center text-sm text-neutral-500">
        Henüz denetim kaydı yok. <b>Yeni Denetim</b> sekmesinden ilk denetimi girebilirsiniz.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 flex flex-wrap gap-2 items-center">
        <select
          value={subeFiltre}
          onChange={(e) => setSubeFiltre(e.target.value)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">Tüm şubeler</option>
          {subeAdlari.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={turFiltre}
          onChange={(e) => setTurFiltre(e.target.value)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">Tüm türler</option>
          {turler.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">{listelenen.length} kayıt</span>
        {silDurum?.hata && <span className="text-sm text-red-600">{silDurum.hata}</span>}
      </div>

      {listelenen.map((k) => {
        const grup = grupBul(k.puan ?? 0);
        const fark = farklar.get(k.id) ?? null;
        const acikMi = acikId === k.id;
        return (
          <div
            key={k.id}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setAcikId(acikMi ? null : k.id)}
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{k.subeAd}</span>
                <span className="block text-[11px] text-neutral-500">
                  {k.bolge} · {k.tarih}
                  {k.tur ? ` · ${k.tur}` : ""}
                  {k.denetleyen ? ` · ${k.denetleyen}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-3 shrink-0">
                {fark != null && fark !== 0 && (
                  <span className={`text-xs font-medium ${fark > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {fark > 0 ? "▲" : "▼"} {Math.abs(fark)}
                  </span>
                )}
                <span className="text-lg font-bold tabular-nums" style={{ color: grup.renk }}>
                  {k.puan ?? "—"}
                </span>
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: grup.renk }}
                >
                  {grup.ad}
                </span>
                <span className="text-neutral-400 text-xs">{acikMi ? "▲" : "▼"}</span>
              </span>
            </button>

            {acikMi && (
              <div className="border-t border-neutral-100 dark:border-neutral-800 p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {KATEGORILER.map((kat) => {
                    const bp = k.bolumPuanlar?.[kat.id] ?? 0;
                    const oran = kat.max ? (bp / kat.max) * 100 : 0;
                    return (
                      <div key={kat.id} className="text-xs">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-neutral-600 dark:text-neutral-300">
                            {kat.ikon} {kat.ad}
                          </span>
                          <span className="text-neutral-500 tabular-nums">
                            {bp}/{kat.max}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${oran}%`, backgroundColor: grup.renk }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {k.notlar && (
                  <div className="text-sm">
                    <span className="text-xs text-neutral-500 block mb-0.5">Genel not</span>
                    <p className="whitespace-pre-wrap">{k.notlar}</p>
                  </div>
                )}

                {silebilir && (
                  <form action={silAction}>
                    <input type="hidden" name="denetim_id" value={k.id} />
                    <button
                      type="submit"
                      disabled={silPending}
                      className="text-sm text-red-600 hover:underline disabled:opacity-60"
                    >
                      {silPending ? "Siliniyor…" : "🗑 Bu kaydı sil"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
