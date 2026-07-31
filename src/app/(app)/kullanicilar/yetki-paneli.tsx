"use client";

import { useActionState, useMemo, useState } from "react";
import { yetkiKaydet, subeKapsamiKaydet } from "./yetki-actions";
import { SAYFALAR, ROL_VARSAYILAN, KAPSAM_ETIKET, KAPSAM_ACIKLAMA } from "@/lib/yetkiler";
import type { Rol, KapsamTuru } from "@/types/database";

const girdiSinif =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";

export interface YetkiSube {
  id: string;
  ad: string;
  kod: string;
  bolge: string;
  tip: string;
  yetkili: string;
}

export interface YetkiVerisi {
  id: string;
  adSoyad: string;
  rol: Rol;
  bolge: string | null;
  kapsamTuru: KapsamTuru;
  kapsamTipi: string | null;
  kapsamYetkilisi: string | null;
  yazabilir: boolean;
  sayfaYetkileri: string[];
  seciliSubeIdler: string[];
}

const KAPSAMLAR: KapsamTuru[] = ["rol", "yetkili", "tum", "bolge", "tip", "secili"];

export function YetkiPaneli({
  k,
  bolgeler,
  subeler,
  benMiyim,
}: {
  k: YetkiVerisi;
  bolgeler: string[];
  subeler: YetkiSube[];
  benMiyim: boolean;
}) {
  const [kapsam, setKapsam] = useState<KapsamTuru>(k.kapsamTuru);
  const [bolge, setBolge] = useState(k.bolge ?? "");
  const [tip, setTip] = useState(k.kapsamTipi ?? "MS");
  const yetkililer = useMemo(
    () => [...new Set(subeler.map((s) => s.yetkili).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [subeler],
  );
  const [yetkili, setYetkili] = useState(k.kapsamYetkilisi ?? "");
  const [secili, setSecili] = useState<Set<string>>(new Set(k.sayfaYetkileri));
  const [subeSecim, setSubeSecim] = useState<Set<string>>(new Set(k.seciliSubeIdler));

  const [yetkiDurum, yetkiAction, yetkiPending] = useActionState(yetkiKaydet, null);
  const [subeDurum, subeAction, subePending] = useActionState(subeKapsamiKaydet, null);
  const durum = yetkiDurum ?? subeDurum;

  const varsayilanKume = useMemo(() => new Set(ROL_VARSAYILAN[k.rol]), [k.rol]);
  const bolumler = useMemo(() => [...new Set(SAYFALAR.map((s) => s.bolum))], []);

  // Kapsam önizlemesi: bu ayarla kaç şube görünür?
  const gorunenSube = useMemo(() => {
    if (k.rol === "admin" || k.rol === "genel_mudur") return subeler.length;
    switch (kapsam) {
      case "tum":
        return subeler.length;
      case "bolge":
        return subeler.filter((s) => s.bolge === bolge).length;
      case "tip":
        return subeler.filter((s) => s.tip === tip).length;
      case "yetkili":
        return subeler.filter((s) => s.yetkili === yetkili).length;
      case "secili":
        return subeSecim.size;
      default:
        return k.rol === "bolge_muduru"
          ? subeler.filter((s) => s.bolge === bolge).length
          : subeSecim.size;
    }
  }, [kapsam, bolge, tip, yetkili, subeSecim, subeler, k.rol]);

  function sayfaDegistir(anahtar: string, acik: boolean) {
    setSecili((s) => {
      const y = new Set(s);
      if (acik) y.add(anahtar);
      else y.delete(anahtar);
      return y;
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Şube kapsamı ── */}
      <form action={yetkiAction} className="space-y-3">
        <input type="hidden" name="kullanici_id" value={k.id} />
        <input type="hidden" name="kapsam_turu" value={kapsam} />
        <input type="hidden" name="kapsam_tipi" value={tip} />
        <input type="hidden" name="bolge" value={bolge} />
        <input type="hidden" name="kapsam_yetkilisi" value={yetkili} />

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-2">
            Hangi şubeleri görür
          </p>
          <div className="flex flex-wrap gap-2">
            {KAPSAMLAR.map((kt) => (
              <button
                key={kt}
                type="button"
                onClick={() => setKapsam(kt)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  kapsam === kt
                    ? "border-transparent bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium"
                    : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                {KAPSAM_ETIKET[kt]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">{KAPSAM_ACIKLAMA[kapsam]}</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {(kapsam === "bolge" || (kapsam === "rol" && k.rol === "bolge_muduru")) && (
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Bölge</span>
              {/* Seçim listesi: eskiden serbest metindi ve yazım tutmayınca
                  kullanıcı hiçbir şube göremiyordu. */}
              <select
                value={bolge}
                onChange={(e) => setBolge(e.target.value)}
                className={girdiSinif + " min-w-48"}
              >
                <option value="">— seçin —</option>
                {bolgeler.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          )}

          {kapsam === "yetkili" && (
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Şube sorumlusu</span>
              <select
                value={yetkili}
                onChange={(e) => setYetkili(e.target.value)}
                className={girdiSinif + " min-w-56"}
              >
                <option value="">— seçin —</option>
                {yetkililer.map((y) => (
                  <option key={y} value={y}>
                    {y} ({subeler.filter((s) => s.yetkili === y).length} şube)
                  </option>
                ))}
              </select>
            </label>
          )}

          {kapsam === "tip" && (
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Şube tipi</span>
              <select
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                className={girdiSinif + " min-w-48"}
              >
                <option value="MS">Merkez Şubeler (MŞ)</option>
                <option value="FR">Franchise (FR)</option>
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 text-sm pb-1.5">
            <input
              type="checkbox"
              name="yazabilir"
              value="1"
              defaultChecked={k.yazabilir}
              className="h-4 w-4"
            />
            Kapsamı içinde veri değiştirebilir
          </label>

          <div className="pb-1.5 text-xs text-neutral-500">
            Bu ayarla <b>{gorunenSube}</b> şube görünür
            {gorunenSube === 0 && (
              <span className="text-red-600 font-semibold"> — hiçbir şube görmez!</span>
            )}
          </div>
        </div>

        {/* ── Sayfa yetkileri ── */}
        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
              Hangi ekranları görür
            </p>
            <button
              type="button"
              onClick={() => setSecili(new Set())}
              className="text-xs text-neutral-500 hover:underline"
            >
              hiçbirini işaretleme (rolün varsayılanı geçerli olsun)
            </button>
            <button
              type="button"
              onClick={() => setSecili(new Set(SAYFALAR.map((s) => s.anahtar)))}
              className="text-xs text-neutral-500 hover:underline"
            >
              tümünü seç
            </button>
          </div>

          {secili.size === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
              Hiçbiri işaretli değil → <b>{k.rol}</b> rolünün varsayılan ekranları geçerli (
              {varsayilanKume.size} ekran).
            </p>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
            {bolumler.map((bolum) => (
              <div key={bolum} className="mb-2">
                <p className="text-[11px] font-semibold text-neutral-400 mb-1">{bolum}</p>
                {SAYFALAR.filter((s) => s.bolum === bolum).map((s) => {
                  const kilitli = s.anahtar === "kullanicilar" && k.rol !== "admin";
                  return (
                    <label
                      key={s.anahtar}
                      className={`flex items-center gap-2 text-[13px] py-0.5 ${
                        kilitli ? "opacity-40" : ""
                      }`}
                      title={kilitli ? "Yalnızca admin rolüne açılabilir" : undefined}
                    >
                      <input
                        type="checkbox"
                        name="sayfa"
                        value={s.anahtar}
                        checked={secili.has(s.anahtar)}
                        disabled={kilitli}
                        onChange={(e) => sayfaDegistir(s.anahtar, e.target.checked)}
                        className="h-3.5 w-3.5"
                      />
                      <span>{s.etiket}</span>
                      {secili.size === 0 && varsayilanKume.has(s.anahtar) && (
                        <span className="text-[10px] text-neutral-400">(varsayılan)</span>
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={yetkiPending}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {yetkiPending ? "Kaydediliyor…" : "Yetkileri kaydet"}
          </button>
          {benMiyim && (
            <span className="text-[11px] text-neutral-500">
              Kendi hesabınız — Kullanıcılar ekranını kendinizden alamazsınız.
            </span>
          )}
          {durum?.ok && <span className="text-sm text-emerald-600">✓ {durum.ok}</span>}
          {durum?.hata && <span className="text-sm text-red-600">{durum.hata}</span>}
        </div>
      </form>

      {/* ── Tek tek şube seçimi ── */}
      {(kapsam === "secili" || (kapsam === "rol" && k.rol === "denetmen")) && (
        <form
          action={subeAction}
          className="pt-3 border-t border-neutral-200 dark:border-neutral-700 space-y-2"
        >
          <input type="hidden" name="kullanici_id" value={k.id} />
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
            Görebileceği şubeler ({subeSecim.size} seçili)
          </p>
          <div className="max-h-56 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-700 p-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
            {subeler.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-[13px] py-0.5">
                <input
                  type="checkbox"
                  name="sube"
                  value={s.id}
                  checked={subeSecim.has(s.id)}
                  onChange={(e) =>
                    setSubeSecim((y) => {
                      const n = new Set(y);
                      if (e.target.checked) n.add(s.id);
                      else n.delete(s.id);
                      return n;
                    })
                  }
                  className="h-3.5 w-3.5"
                />
                <span className="font-mono text-[11px] text-neutral-400">{s.kod}</span>
                <span className="truncate">{s.ad}</span>
              </label>
            ))}
          </div>
          <button type="submit" disabled={subePending} className={girdiSinif}>
            {subePending ? "Kaydediliyor…" : "Şube seçimini kaydet"}
          </button>
        </form>
      )}
    </div>
  );
}
