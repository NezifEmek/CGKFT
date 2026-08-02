"use client";

import { useActionState, useState } from "react";
import { sozlesmeKaydet, sozlesmeSil } from "../actions";
import { DosyaEkleri } from "@/components/dosya-ekleri";
import {
  SOZLESME_TURLERI, TUR_ETIKET, DURUM_ETIKET, DURUM_RENK,
  sozlesmeDurumu, kalanGun, dikkatSirasi, type Sozlesme,
} from "@/lib/dosya";
import type { Dosya } from "@/lib/dosya";

const gir =
  "w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const btn =
  "rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3.5 py-1.5 text-sm font-medium disabled:opacity-60";
const btnSade =
  "rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm disabled:opacity-60";

function A({ e, children }: { e: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{e}</span>
      {children}
    </label>
  );
}

function tarihYaz(t: string | null): string {
  if (!t) return "—";
  const [y, a, g] = t.slice(0, 10).split("-");
  return g && a && y ? `${g}.${a}.${y}` : t;
}

/** "12 gün kaldı" / "35 gün geçti" */
function kalanYaz(gun: number | null): string {
  if (gun == null) return "";
  if (gun === 0) return "bugün doluyor";
  return gun > 0 ? `${gun} gün kaldı` : `${-gun} gün geçti`;
}

export function SozlesmePaneli({
  subeId,
  sozlesmeler,
  dosyalar,
  bugun,
  duzenlenebilir,
  tabloYok,
}: {
  subeId: string;
  sozlesmeler: Sozlesme[];
  dosyalar: Dosya[];
  bugun: string;
  duzenlenebilir: boolean;
  tabloYok: boolean;
}) {
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Sozlesme | null>(null);

  const [d1, a1, p1] = useActionState(sozlesmeKaydet, null);
  const [d2, a2, p2] = useActionState(sozlesmeSil, null);
  const durum = d1 ?? d2;

  const sirali = dikkatSirasi(sozlesmeler, bugun);

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold">Sözleşmeler</h2>
        {duzenlenebilir && !tabloYok && (
          <button
            type="button"
            onClick={() => { setDuzenlenen(null); setFormAcik((v) => !v); }}
            className="text-xs text-neutral-500 hover:underline"
          >
            {formAcik && !duzenlenen ? "kapat" : "＋ sözleşme ekle"}
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        Sözleşme dosyaları ve süre takibi. Bitişe kalan süre yaklaşınca kayıt sarıya, süre
        dolunca kırmızıya döner.
      </p>

      {tabloYok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-sm text-amber-800 dark:text-amber-300 mb-3">
          <b>Sözleşme tablosu henüz oluşturulmamış.</b>{" "}
          <code className="text-xs">0015_dosyalar.sql</code> Supabase&apos;de çalıştırılmalı.
        </div>
      )}

      {durum?.ok && <p className="text-sm text-emerald-600 mb-2">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600 mb-2">{durum.hata}</p>}

      {(formAcik || duzenlenen) && (
        <form key={duzenlenen?.id ?? "yeni"} action={a1} className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-3 mb-3 space-y-2">
          <input type="hidden" name="sube_id" value={subeId} />
          <input type="hidden" name="sozlesme_id" value={duzenlenen?.id ?? ""} />
          <div className="grid sm:grid-cols-2 gap-2">
            <A e="Sözleşme türü">
              <select name="tur" defaultValue={duzenlenen?.tur ?? "franchise"} className={gir}>
                {SOZLESME_TURLERI.map((t) => <option key={t} value={t}>{TUR_ETIKET[t]}</option>)}
              </select>
            </A>
            <A e="Sözleşme no">
              <input name="sozlesme_no" defaultValue={duzenlenen?.sozlesme_no ?? ""} className={gir} />
            </A>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <A e="Başlangıç">
              <input name="baslangic" type="date" defaultValue={duzenlenen?.baslangic ?? ""} className={gir} />
            </A>
            <A e="Bitiş">
              <input name="bitis" type="date" defaultValue={duzenlenen?.bitis ?? ""} className={gir} />
            </A>
            <A e="Kaç gün önce uyarılsın?">
              <input name="uyari_gun" inputMode="numeric" defaultValue={duzenlenen?.uyari_gun ?? 90} className={gir} />
            </A>
          </div>
          <A e="Karşı taraf">
            <input name="taraf" defaultValue={duzenlenen?.taraf ?? ""} className={gir} />
          </A>
          <A e="Notlar">
            <input name="notlar" defaultValue={duzenlenen?.notlar ?? ""} className={gir} />
          </A>
          <div className="flex gap-2">
            <button type="submit" disabled={p1} className={btn}>
              {duzenlenen ? "Güncelle" : "Sözleşme ekle"}
            </button>
            <button type="button" onClick={() => { setFormAcik(false); setDuzenlenen(null); }} className={btnSade}>
              Vazgeç
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            Dosyayı kaydettikten sonra aşağıdaki sözleşme satırından yükleyebilirsiniz.
          </p>
        </form>
      )}

      {sirali.length ? (
        <ul className="space-y-2">
          {sirali.map((s) => {
            const d = sozlesmeDurumu(s, bugun);
            const kalan = kalanGun(s, bugun);
            const ekler = dosyalar.filter((x) => x.kayit_id === s.id);
            return (
              <li
                key={s.id}
                className="rounded-lg border px-3 py-2.5"
                style={{ borderColor: d === "gecerli" ? undefined : DURUM_RENK[d] + "66" }}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium text-sm">{TUR_ETIKET[s.tur] ?? s.tur}</span>
                  {s.sozlesme_no && (
                    <span className="font-mono text-[11px] text-neutral-400">{s.sozlesme_no}</span>
                  )}
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: DURUM_RENK[d] }}
                  >
                    {DURUM_ETIKET[d]}
                  </span>
                  {kalan != null && (
                    <span className="text-[11px] text-neutral-500">{kalanYaz(kalan)}</span>
                  )}
                  {duzenlenebilir && (
                    <span className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setDuzenlenen(s); setFormAcik(true); }}
                        className="text-xs text-neutral-500 hover:underline"
                      >
                        düzelt
                      </button>
                      <form action={a2}>
                        <input type="hidden" name="sozlesme_id" value={s.id} />
                        <input type="hidden" name="sube_id" value={subeId} />
                        <button type="submit" disabled={p2} className="text-xs text-red-500 hover:underline">
                          sil
                        </button>
                      </form>
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {tarihYaz(s.baslangic)} – {tarihYaz(s.bitis)}
                  {s.taraf ? ` · ${s.taraf}` : ""}
                  {s.notlar ? ` · ${s.notlar}` : ""}
                </div>

                <div className="mt-2">
                  <DosyaEkleri
                    kapsam="sozlesme"
                    kayitId={s.id}
                    dosyalar={ekler}
                    duzenlenebilir={duzenlenebilir}
                    baslik="Sözleşme dosyaları"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !tabloYok && (
          <p className="text-sm text-neutral-400">
            Bu şube için sözleşme kaydı yok.
            {duzenlenebilir ? " “＋ sözleşme ekle”ye basın." : ""}
          </p>
        )
      )}
    </section>
  );
}
