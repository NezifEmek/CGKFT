"use client";

import { useActionState, useState } from "react";
import { gorusmeEkle, gorusmeSil } from "./actions";

const gir =
  "w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const btn = "yazdirma-gizle " +
  "rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3.5 py-1.5 text-sm font-medium disabled:opacity-60";

export interface Gorusme {
  id: string;
  basvuru_id: string;
  tarih: string;
  tur: string;
  gorusen: string;
  notlar: string;
  sonraki_adim: string;
  sonraki_tarih: string | null;
}

export const GORUSME_TURLERI = ["telefon", "yuz_yuze", "video", "saha_ziyareti", "diger"] as const;

export const TUR_ETIKET: Record<string, string> = {
  telefon: "Telefon",
  yuz_yuze: "Yüz yüze",
  video: "Video",
  saha_ziyareti: "Saha ziyareti",
  diger: "Diğer",
};

const TUR_SIMGE: Record<string, string> = {
  telefon: "📞", yuz_yuze: "🤝", video: "🎥", saha_ziyareti: "📍", diger: "•",
};

function tarihYaz(t: string | null): string {
  if (!t) return "";
  const [y, a, g] = t.slice(0, 10).split("-");
  return g && a && y ? `${g}.${a}.${y}` : t;
}

/**
 * Bir başvurunun görüşme geçmişi.
 *
 * Önceden tek bir `gorusme_notu` alanı vardı; ikinci görüşme yazılınca
 * birincinin üstüne yazılıyordu. Artık her görüşme ayrı satır — tarihli,
 * kim yaptı belli, eskisi silinmiyor.
 */
export function GorusmePaneli({
  basvuruId,
  gorusmeler,
  kisiler,
  bugun,
  duzenlenebilir,
  silebilir,
}: {
  basvuruId: string;
  gorusmeler: Gorusme[];
  kisiler: string[];
  bugun: string;
  duzenlenebilir: boolean;
  silebilir: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [d1, a1, p1] = useActionState(gorusmeEkle, null);
  const [d2, a2, p2] = useActionState(gorusmeSil, null);
  const durum = d1 ?? d2;

  const sirali = [...gorusmeler].sort((x, y) => y.tarih.localeCompare(x.tarih));

  return (
    <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
          Görüşmeler
          {sirali.length > 0 && <span className="ml-1 text-neutral-400">({sirali.length})</span>}
        </h4>
        {duzenlenebilir && (
          <button
            type="button"
            onClick={() => setAcik((v) => !v)}
            className="text-xs text-neutral-500 hover:underline yazdirma-gizle"
          >
            {acik ? "vazgeç" : "＋ görüşme ekle"}
          </button>
        )}
      </div>

      {durum?.ok && <p className="text-sm text-emerald-600 mb-2">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600 mb-2">{durum.hata}</p>}

      {acik && duzenlenebilir && (
        <form action={a1} className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-3 mb-3 space-y-2">
          <input type="hidden" name="basvuru_id" value={basvuruId} />
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Tarih</span>
              <input name="tarih" type="date" defaultValue={bugun} className={gir} />
            </label>
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Görüşme türü</span>
              <select name="tur" defaultValue="telefon" className={gir}>
                {GORUSME_TURLERI.map((t) => (
                  <option key={t} value={t}>{TUR_ETIKET[t]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Görüşen</span>
              <input name="gorusen" list="franchise-gorusenler" className={gir} />
              <datalist id="franchise-gorusenler">
                {kisiler.map((k) => <option key={k} value={k} />)}
              </datalist>
            </label>
          </div>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Notlar *</span>
            <textarea name="notlar" rows={2} required className={gir} />
          </label>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Sonraki adım</span>
              <input name="sonraki_adim" placeholder="2 hafta sonra tekrar aranacak" className={gir} />
            </label>
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Sonraki temas tarihi</span>
              <input name="sonraki_tarih" type="date" className={gir} />
            </label>
          </div>
          <button type="submit" disabled={p1} className={btn}>Görüşmeyi kaydet</button>
        </form>
      )}

      {sirali.length ? (
        <ol className="space-y-2">
          {sirali.map((g) => (
            <li key={g.id} className="flex gap-2 text-sm">
              <span className="shrink-0">{TUR_SIMGE[g.tur] ?? "•"}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-neutral-400">
                  {tarihYaz(g.tarih)} · {TUR_ETIKET[g.tur] ?? g.tur}
                  {g.gorusen ? ` · ${g.gorusen}` : ""}
                </div>
                {g.notlar && <p className="whitespace-pre-line">{g.notlar}</p>}
                {g.sonraki_adim && (
                  <p className="text-[12px] text-neutral-500 mt-0.5">
                    → {g.sonraki_adim}
                    {g.sonraki_tarih ? ` (${tarihYaz(g.sonraki_tarih)})` : ""}
                  </p>
                )}
              </div>
              {silebilir && (
                <form action={a2} className="shrink-0">
                  <input type="hidden" name="gorusme_id" value={g.id} />
                  <input type="hidden" name="basvuru_id" value={basvuruId} />
                  <button type="submit" disabled={p2} className="text-xs text-red-500 hover:underline yazdirma-gizle">
                    sil
                  </button>
                </form>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-neutral-400">Henüz görüşme kaydı yok.</p>
      )}
    </div>
  );
}
