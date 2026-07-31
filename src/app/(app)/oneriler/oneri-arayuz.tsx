"use client";

import { useActionState, useMemo, useState } from "react";
import { oneriEkle, destekDegistir, oneriKarar, oneriSil, KATEGORILER, DURUMLAR, ONCELIKLER } from "./actions";

const gir = "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const kart = "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4";
const btn = "rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3.5 py-1.5 text-sm font-medium disabled:opacity-60";

const DURUM_ETIKET: Record<string, string> = {
  yeni: "Yeni", inceleniyor: "İnceleniyor", planlandi: "Planlandı",
  yapildi: "Yapıldı", reddedildi: "Reddedildi",
};
const DURUM_RENK: Record<string, string> = {
  yeni: "#6b7280", inceleniyor: "#2563eb", planlandi: "#f59e0b",
  yapildi: "#16a34a", reddedildi: "#dc2626",
};
const ONCELIK_ETIKET: Record<string, string> = { dusuk: "Düşük", orta: "Orta", yuksek: "Yüksek" };

export interface Oneri {
  id: string;
  baslik: string;
  aciklama: string;
  kategori: string;
  durum: string;
  oncelik: string;
  yonetim_notu: string;
  ekleyen_id: string;
  created_at: string;
  destekSayisi: number;
  destekledimMi: boolean;
}

export function OneriArayuz({
  oneriler, adlar, benId, yonetimMi,
}: {
  oneriler: Oneri[];
  adlar: Record<string, string>;
  benId: string;
  yonetimMi: boolean;
}) {
  const [ekleAcik, setEkleAcik] = useState(false);
  const [fDurum, setFDurum] = useState("");
  const [siralama, setSiralama] = useState<"yeni" | "destek">("yeni");
  const [acikId, setAcikId] = useState<string | null>(null);

  const [d1, a1, p1] = useActionState(oneriEkle, null);
  const [d2, a2, p2] = useActionState(destekDegistir, null);
  const [d3, a3, p3] = useActionState(oneriKarar, null);
  const [d4, a4, p4] = useActionState(oneriSil, null);
  const durum = d1 ?? d2 ?? d3 ?? d4;

  const listelenen = useMemo(() => {
    const l = oneriler.filter((o) => !fDurum || o.durum === fDurum);
    return siralama === "destek"
      ? [...l].sort((a, b) => b.destekSayisi - a.destekSayisi || b.created_at.localeCompare(a.created_at))
      : [...l].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [oneriler, fDurum, siralama]);

  const sayim = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of oneriler) m.set(o.durum, (m.get(o.durum) ?? 0) + 1);
    return m;
  }, [oneriler]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <button type="button" onClick={() => setFDurum("")}
          className={`${kart} !p-3 text-center ${!fDurum ? "ring-2 ring-neutral-900 dark:ring-neutral-100" : ""}`}>
          <div className="text-lg font-extrabold">{oneriler.length}</div>
          <div className="text-[10px] text-neutral-500">Tümü</div>
        </button>
        {DURUMLAR.map((d) => (
          <button key={d} type="button" onClick={() => setFDurum(fDurum === d ? "" : d)}
            className={`${kart} !p-3 text-center ${fDurum === d ? "ring-2 ring-neutral-900 dark:ring-neutral-100" : ""}`}>
            <div className="text-lg font-extrabold" style={{ color: DURUM_RENK[d] }}>{sayim.get(d) ?? 0}</div>
            <div className="text-[10px] text-neutral-500">{DURUM_ETIKET[d]}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={siralama} onChange={(e) => setSiralama(e.target.value as "yeni" | "destek")} className={gir}>
          <option value="yeni">Sıralama: en yeni</option>
          <option value="destek">Sıralama: en çok desteklenen</option>
        </select>
        <span className="text-xs text-neutral-500">{listelenen.length} öneri</span>
        <button type="button" onClick={() => setEkleAcik((v) => !v)} className={btn + " ml-auto"}>
          {ekleAcik ? "Vazgeç" : "＋ Öneri ver"}
        </button>
      </div>

      {durum?.ok && <p className="text-sm text-emerald-600">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600">{durum.hata}</p>}

      {ekleAcik && (
        <form action={a1} className={kart + " space-y-3"}>
          <h3 className="font-medium text-sm">Yeni öneri</h3>
          <div className="grid md:grid-cols-3 gap-2">
            <input name="baslik" required placeholder="Öneri başlığı *" className={gir + " md:col-span-2"} />
            <select name="kategori" defaultValue="Diğer" className={gir}>
              {KATEGORILER.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <textarea name="aciklama" rows={3} placeholder="Ne öneriyorsunuz, neden faydalı olur?" className={gir + " w-full"} />
          <button type="submit" disabled={p1} className={btn}>Öneriyi kaydet</button>
        </form>
      )}

      <div className="space-y-2">
        {listelenen.map((o) => (
          <div key={o.id} className={kart}>
            <div className="flex items-start gap-3">
              <form action={a2}>
                <input type="hidden" name="oneri_id" value={o.id} />
                <button type="submit" disabled={p2}
                  title={o.destekledimMi ? "Desteği geri al" : "Destekle"}
                  className={`rounded-lg border px-2.5 py-1.5 text-center min-w-14 ${
                    o.destekledimMi
                      ? "border-transparent bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                      : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}>
                  <div className="text-sm font-bold leading-none">▲</div>
                  <div className="text-xs mt-0.5">{o.destekSayisi}</div>
                </button>
              </form>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium text-[15px]">{o.baslik}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: DURUM_RENK[o.durum] }}>
                    {DURUM_ETIKET[o.durum]}
                  </span>
                  <span className="text-[11px] text-neutral-400">{o.kategori}</span>
                  {o.oncelik !== "orta" && (
                    <span className="text-[11px] text-neutral-500">öncelik: {ONCELIK_ETIKET[o.oncelik]}</span>
                  )}
                </div>
                {o.aciklama && <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 whitespace-pre-line">{o.aciklama}</p>}
                <div className="text-[11px] text-neutral-400 mt-1">
                  {adlar[o.ekleyen_id] ?? "—"} · {o.created_at.slice(0, 10)}
                </div>
                {o.yonetim_notu && (
                  <p className="text-[13px] mt-2 rounded-md bg-neutral-50 dark:bg-neutral-800/60 px-3 py-2">
                    <b>Yönetim notu:</b> {o.yonetim_notu}
                  </p>
                )}

                {(yonetimMi || o.ekleyen_id === benId) && (
                  <button type="button" onClick={() => setAcikId(acikId === o.id ? null : o.id)}
                    className="text-xs text-neutral-500 hover:underline mt-2">
                    {acikId === o.id ? "kapat" : "değerlendir / sil"}
                  </button>
                )}

                {acikId === o.id && (
                  <div className="mt-2 space-y-2">
                    {yonetimMi && (
                      <form action={a3} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="oneri_id" value={o.id} />
                        <select name="durum" defaultValue={o.durum} className={gir}>
                          {DURUMLAR.map((d) => <option key={d} value={d}>{DURUM_ETIKET[d]}</option>)}
                        </select>
                        <select name="oncelik" defaultValue={o.oncelik} className={gir}>
                          {ONCELIKLER.map((x) => <option key={x} value={x}>{ONCELIK_ETIKET[x]}</option>)}
                        </select>
                        <input name="yonetim_notu" defaultValue={o.yonetim_notu} placeholder="Yönetim notu" className={gir + " flex-1 min-w-48"} />
                        <button type="submit" disabled={p3} className={btn}>Kaydet</button>
                      </form>
                    )}
                    <form action={a4}>
                      <input type="hidden" name="oneri_id" value={o.id} />
                      <button type="submit" disabled={p4}
                        className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3 py-1.5 text-sm">
                        🗑 Sil
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {!listelenen.length && (
          <div className={kart + " text-center text-sm text-neutral-400 py-8"}>
            Henüz öneri yok. İlk öneriyi siz verin.
          </div>
        )}
      </div>
    </div>
  );
}
