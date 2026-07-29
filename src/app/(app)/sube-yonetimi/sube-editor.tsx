"use client";

import { useActionState, useMemo, useState } from "react";
import { subeKaydet, subeSil } from "./actions";
import type { Sube } from "@/types/database";

const girdiSinif =
  "w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";

function Alan({
  etiket,
  children,
}: {
  etiket: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{etiket}</span>
      {children}
    </label>
  );
}

export function SubeEditor({
  subeler,
  bolgeler,
  kilitliBolge,
  silebilir,
}: {
  subeler: Sube[];
  bolgeler: string[];
  kilitliBolge: string | null;
  silebilir: boolean;
}) {
  const [secili, setSecili] = useState<Sube | null>(null);
  const [kaydetDurum, kaydetAction, kaydetPending] = useActionState(subeKaydet, null);
  const [silDurum, silAction, silPending] = useActionState(subeSil, null);

  const [arama, setArama] = useState("");
  const [bolgeFiltre, setBolgeFiltre] = useState("");
  const [tipFiltre, setTipFiltre] = useState("");
  const [durumFiltre, setDurumFiltre] = useState("");

  // Formdaki tip, fiyat grubu alanının görünürlüğünü belirler.
  const [tip, setTip] = useState<"MS" | "FR">("FR");

  const listelenen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    return subeler.filter((s) => {
      if (bolgeFiltre && s.bolge !== bolgeFiltre) return false;
      if (tipFiltre && s.tip !== tipFiltre) return false;
      if (durumFiltre === "aktif" && !s.aktif) return false;
      if (durumFiltre === "pasif" && s.aktif) return false;
      if (!q) return true;
      return (
        s.ad.toLocaleLowerCase("tr").includes(q) ||
        s.il.toLocaleLowerCase("tr").includes(q) ||
        s.ilce.toLocaleLowerCase("tr").includes(q) ||
        s.kod.toLocaleLowerCase("tr").includes(q)
      );
    });
  }, [subeler, arama, bolgeFiltre, tipFiltre, durumFiltre]);

  function yeniSube() {
    setSecili(null);
    setTip("FR");
  }

  function subeSec(s: Sube) {
    setSecili(s);
    setTip(s.tip);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
      {/* ── Liste ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-2">
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Şube, il, ilçe, kod ara…"
            className="flex-1 min-w-40 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm"
          />
          <select
            value={bolgeFiltre}
            onChange={(e) => setBolgeFiltre(e.target.value)}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="">Tüm bölgeler</option>
            {bolgeler.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            value={tipFiltre}
            onChange={(e) => setTipFiltre(e.target.value)}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="">MŞ + FR</option>
            <option value="MS">MŞ</option>
            <option value="FR">FR</option>
          </select>
          <select
            value={durumFiltre}
            onChange={(e) => setDurumFiltre(e.target.value)}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="">Hepsi</option>
            <option value="aktif">Aktif</option>
            <option value="pasif">Pasif</option>
          </select>
        </div>

        <div className="px-3 py-2 text-xs text-neutral-500 border-b border-neutral-100 dark:border-neutral-800">
          {listelenen.length} şube listeleniyor
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {listelenen.map((s) => {
            const seciliMi = secili?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => subeSec(s)}
                className={`w-full text-left px-3 py-2 border-b border-neutral-50 dark:border-neutral-800/50 last:border-0 flex items-center justify-between gap-2 ${
                  seciliMi
                    ? "bg-neutral-100 dark:bg-neutral-800"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{s.ad}</span>
                  <span className="block text-[11px] text-neutral-500 truncate">
                    {s.bolge} · {s.il}
                    {s.ilce ? ` / ${s.ilce}` : ""} {s.kod ? `· ${s.kod}` : ""}
                  </span>
                </span>
                <span className="shrink-0 flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-500">{s.tip === "MS" ? "MŞ" : "FR"}</span>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${s.aktif ? "bg-emerald-500" : "bg-neutral-300"}`}
                    title={s.aktif ? "Aktif" : "Pasif"}
                  />
                </span>
              </button>
            );
          })}
          {!listelenen.length && (
            <div className="px-3 py-8 text-center text-sm text-neutral-400">Eşleşen şube yok.</div>
          )}
        </div>
      </div>

      {/* ── Form ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 lg:sticky lg:top-4">
        <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="font-medium text-sm">{secili ? "Şubeyi Düzenle" : "Yeni Şube"}</h3>
          {secili && (
            <button
              type="button"
              onClick={yeniSube}
              className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1"
            >
              ＋ Yeni
            </button>
          )}
        </div>

        {/* key: seçim değişince alanlar sıfırlansın */}
        <form key={secili?.id ?? "yeni"} action={kaydetAction} className="p-4 space-y-3">
          <input type="hidden" name="sube_id" value={secili?.id ?? ""} />

          <Alan etiket="Şube Adı *">
            <input name="ad" defaultValue={secili?.ad ?? ""} required className={girdiSinif} />
          </Alan>

          <div className="grid grid-cols-2 gap-3">
            <Alan etiket="Tip">
              <select
                name="tip"
                value={tip}
                onChange={(e) => setTip(e.target.value as "MS" | "FR")}
                className={girdiSinif}
              >
                <option value="FR">Franchise (FR)</option>
                <option value="MS">Merkez Şube (MŞ)</option>
              </select>
            </Alan>
            <Alan etiket="Bölge *">
              {kilitliBolge ? (
                <input value={kilitliBolge} disabled className={girdiSinif + " opacity-60"} />
              ) : (
                <input
                  name="bolge"
                  defaultValue={secili?.bolge ?? ""}
                  required
                  list="bolge-listesi"
                  className={girdiSinif}
                />
              )}
            </Alan>
          </div>
          <datalist id="bolge-listesi">
            {bolgeler.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>

          {tip === "FR" && (
            <Alan etiket="Fiyat Grubu">
              <select
                name="fiyat_grubu"
                defaultValue={secili?.fiyat_grubu ?? "dagitim"}
                className={girdiSinif}
              >
                <option value="dagitim">Dağıtım</option>
                <option value="lojistik">Lojistik</option>
              </select>
            </Alan>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Alan etiket="İl">
              <input name="il" defaultValue={secili?.il ?? ""} className={girdiSinif} />
            </Alan>
            <Alan etiket="İlçe">
              <input name="ilce" defaultValue={secili?.ilce ?? ""} className={girdiSinif} />
            </Alan>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Alan etiket="Kod">
              <input name="kod" defaultValue={secili?.kod ?? ""} className={girdiSinif} />
            </Alan>
            <Alan etiket="İl Şube Sırası">
              <input
                name="il_sube_sirasi"
                defaultValue={secili?.il_sube_sirasi ?? ""}
                className={girdiSinif}
              />
            </Alan>
          </div>

          <Alan etiket="Merkez Yetkilisi">
            <input
              name="merkez_yetkilisi"
              defaultValue={secili?.merkez_yetkilisi ?? ""}
              className={girdiSinif}
            />
          </Alan>
          <Alan etiket="Şube Yetkilisi">
            <input
              name="sube_yetkilisi"
              defaultValue={secili?.sube_yetkilisi ?? ""}
              className={girdiSinif}
            />
          </Alan>

          <div className="grid grid-cols-2 gap-3">
            <Alan etiket="Açılış Tarihi">
              <input
                name="acilis_tarihi"
                type="date"
                defaultValue={secili?.acilis_tarihi ?? ""}
                className={girdiSinif}
              />
            </Alan>
            <Alan etiket="Kapanış Tarihi">
              <input
                name="kapanis_tarihi"
                type="date"
                defaultValue={secili?.kapanis_tarihi ?? ""}
                className={girdiSinif}
              />
            </Alan>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="aktif" defaultChecked={secili ? secili.aktif : true} />
              Aktif
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="acilis_tahmini"
                defaultChecked={secili?.acilis_tahmini ?? false}
              />
              Açılış tahmini
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={kaydetPending}
              className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {kaydetPending ? "Kaydediliyor…" : secili ? "Güncelle" : "Şube Ekle"}
            </button>
            {kaydetDurum?.ok && <span className="text-sm text-emerald-600">Kaydedildi ✓</span>}
            {kaydetDurum?.hata && <span className="text-sm text-red-600">{kaydetDurum.hata}</span>}
          </div>
        </form>

        {secili && silebilir && (
          <form
            action={silAction}
            className="px-4 pb-4 pt-1 border-t border-neutral-100 dark:border-neutral-800"
          >
            <input type="hidden" name="sube_id" value={secili.id} />
            <button
              type="submit"
              disabled={silPending}
              className="text-sm text-red-600 hover:underline disabled:opacity-60"
            >
              {silPending ? "Siliniyor…" : "🗑 Bu şubeyi sil"}
            </button>
            <p className="text-[11px] text-neutral-400 mt-1">
              Şube silinince aylık satış kayıtları da silinir.
            </p>
            {silDurum?.hata && <div className="text-sm text-red-600 mt-1">{silDurum.hata}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
