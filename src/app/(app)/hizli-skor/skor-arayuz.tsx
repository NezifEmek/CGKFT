"use client";

import { useActionState, useMemo, useState } from "react";
import { skorKaydet, skorSil } from "./actions";
import { SKOR_TURLERI, TUR_IKON, TUR_RENK, puanRenk } from "@/lib/skor";
import { SubeGecmisPaneli, type GecmisKayit } from "@/components/sube-gecmis-paneli";

export interface SkorSube {
  id: string;
  ad: string;
  bolge: string;
  il: string;
  ilce: string;
}

export interface SkorKaydi {
  id: string;
  subeAd: string;
  bolge: string;
  il: string;
  ilce: string;
  tarih: string;
  puan: number | null;
  tur: string;
}

const girdiSinif =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";

export function SkorArayuz({
  subeler,
  kayitlar,
  gecmis,
  yazabilir,
}: {
  subeler: SkorSube[];
  kayitlar: SkorKaydi[];
  gecmis: GecmisKayit[];
  yazabilir: boolean;
}) {
  const [kayitDurum, kayitAction, kayitPending] = useActionState(skorKaydet, null);
  const [silDurum, silAction, silPending] = useActionState(skorSil, null);

  const [bolge, setBolge] = useState("");
  const [il, setIl] = useState("");
  const [ilce, setIlce] = useState("");
  const [subeId, setSubeId] = useState("");
  const [tur, setTur] = useState<string>(SKOR_TURLERI[0]);
  const [puan, setPuan] = useState("");

  const [gecmisSube, setGecmisSube] = useState("");
  const [gecmisTur, setGecmisTur] = useState("");

  const bolgeler = useMemo(
    () =>
      [...new Set(subeler.map((s) => s.bolge).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "tr"),
      ),
    [subeler],
  );
  const iller = useMemo(
    () =>
      [
        ...new Set(
          subeler.filter((s) => !bolge || s.bolge === bolge).map((s) => s.il).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "tr")),
    [subeler, bolge],
  );
  const ilceler = useMemo(
    () =>
      [
        ...new Set(
          subeler
            .filter((s) => (!bolge || s.bolge === bolge) && (!il || s.il === il))
            .map((s) => s.ilce)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "tr")),
    [subeler, bolge, il],
  );
  const secilebilir = useMemo(
    () =>
      subeler
        .filter(
          (s) => (!bolge || s.bolge === bolge) && (!il || s.il === il) && (!ilce || s.ilce === ilce),
        )
        .sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
    [subeler, bolge, il, ilce],
  );

  const subeAdlari = useMemo(
    () => [...new Set(kayitlar.map((k) => k.subeAd))].sort((a, b) => a.localeCompare(b, "tr")),
    [kayitlar],
  );

  const listelenen = useMemo(
    () =>
      kayitlar.filter(
        (k) => (!gecmisSube || k.subeAd === gecmisSube) && (!gecmisTur || k.tur === gecmisTur),
      ),
    [kayitlar, gecmisSube, gecmisTur],
  );

  const puanSayi = Number(puan.replace(",", "."));
  const puanGecerli = puan !== "" && Number.isFinite(puanSayi) && puanSayi >= 0 && puanSayi <= 100;

  return (
    <div className="space-y-4">
      {/* Giriş formu */}
      {yazabilir ? (
        <form
          action={kayitAction}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
        >
          <h3 className="font-medium text-sm">Yeni Skor</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Bölge</span>
              <select
                value={bolge}
                onChange={(e) => {
                  setBolge(e.target.value);
                  setIl("");
                  setIlce("");
                  setSubeId("");
                }}
                className={girdiSinif + " w-full"}
              >
                <option value="">Tümü</option>
                {bolgeler.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">İl</span>
              <select
                value={il}
                onChange={(e) => {
                  setIl(e.target.value);
                  setIlce("");
                  setSubeId("");
                }}
                className={girdiSinif + " w-full"}
              >
                <option value="">Tümü</option>
                {iller.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">İlçe</span>
              <select
                value={ilce}
                onChange={(e) => {
                  setIlce(e.target.value);
                  setSubeId("");
                }}
                className={girdiSinif + " w-full"}
              >
                <option value="">Tümü</option>
                {ilceler.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Şube *</span>
              <select
                name="sube_id"
                required
                value={subeId}
                onChange={(e) => setSubeId(e.target.value)}
                className={girdiSinif + " w-full"}
              >
                <option value="">Şube seç…</option>
                {secilebilir.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ad}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <SubeGecmisPaneli kayitlar={gecmis} subeId={subeId} />

          {/* Tür seçimi — rozet düğmeler */}
          <div>
            <span className="block text-xs text-neutral-500 mb-1">Kayıt Türü</span>
            <input type="hidden" name="tur" value={tur} />
            <div className="flex flex-wrap gap-2">
              {SKOR_TURLERI.map((t) => {
                const seciliMi = tur === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTur(t)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      seciliMi
                        ? "border-transparent text-white font-semibold"
                        : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                    style={seciliMi ? { backgroundColor: TUR_RENK[t] } : undefined}
                  >
                    {TUR_IKON[t]} {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Tarih</span>
              <input
                name="tarih"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={girdiSinif + " w-full"}
              />
            </label>
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Puan (0 – 100)</span>
              <input
                name="puan"
                type="number"
                min="0"
                max="100"
                step="0.5"
                required
                value={puan}
                onChange={(e) => setPuan(e.target.value)}
                className={girdiSinif + " w-full"}
              />
            </label>
            {puanGecerli && (
              <div className="pb-1">
                <span
                  className="inline-block px-3 py-1 rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: puanRenk(puanSayi) }}
                >
                  {Math.round(puanSayi * 10) / 10} / 100
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={kayitPending || !subeId || !puanGecerli}
              className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {kayitPending ? "Kaydediliyor…" : "Skoru Kaydet"}
            </button>
            {kayitDurum?.ok && <span className="text-sm text-emerald-600">✓ {kayitDurum.ok}</span>}
            {kayitDurum?.hata && <span className="text-sm text-red-600">{kayitDurum.hata}</span>}
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 text-sm text-neutral-500">
          Skor girme yetkiniz yok.
        </div>
      )}

      {/* Geçmiş */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-2 items-center">
          <h3 className="font-medium text-sm mr-auto">Skor Geçmişi</h3>
          <select
            value={gecmisSube}
            onChange={(e) => setGecmisSube(e.target.value)}
            className={girdiSinif}
          >
            <option value="">Tüm şubeler</option>
            {subeAdlari.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={gecmisTur}
            onChange={(e) => setGecmisTur(e.target.value)}
            className={girdiSinif}
          >
            <option value="">Tüm türler</option>
            {SKOR_TURLERI.map((t) => (
              <option key={t} value={t}>
                {TUR_IKON[t]} {t}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">{listelenen.length} kayıt</span>
        </div>

        {silDurum?.hata && (
          <div className="px-4 py-2 text-sm text-red-600">{silDurum.hata}</div>
        )}

        {listelenen.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Şube</th>
                  <th className="px-4 py-2">Bölge / İl</th>
                  <th className="px-4 py-2">Tür</th>
                  <th className="px-4 py-2">Tarih</th>
                  <th className="px-4 py-2 text-right">Puan</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {listelenen.map((k) => (
                  <tr
                    key={k.id}
                    className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  >
                    <td className="px-4 py-2 font-medium">{k.subeAd}</td>
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                      {k.bolge}
                      {k.il ? ` / ${k.il}` : ""}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium text-white whitespace-nowrap"
                        style={{ backgroundColor: TUR_RENK[k.tur] ?? "#6b7280" }}
                      >
                        {TUR_IKON[k.tur] ?? ""} {k.tur || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{k.tarih}</td>
                    <td className="px-4 py-2 text-right">
                      <b style={{ color: puanRenk(k.puan ?? 0) }}>{k.puan ?? "—"}</b>
                      <span className="text-neutral-400 text-xs">/100</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={silAction}>
                        <input type="hidden" name="skor_id" value={k.id} />
                        <button
                          type="submit"
                          disabled={silPending}
                          title="Kaydı sil"
                          className="text-red-600 hover:underline text-xs disabled:opacity-60"
                        >
                          🗑
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-neutral-500">
            {kayitlar.length ? "Filtreye uyan kayıt yok." : "Henüz skor kaydı yok."}
          </div>
        )}
      </div>
    </div>
  );
}
