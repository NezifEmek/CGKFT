"use client";

import { useActionState, useMemo, useState } from "react";
import { basvuruEkle, basvuruGuncelle, basvuruSil, topluSorumluAta } from "./actions";
import { SubeAcPaneli } from "./sube-ac-paneli";
import {
  DURUMLAR,
  DURUM_RENK,
  KANALLAR,
  KAYIP_NEDENLERI,
  MEMNUNIYET,
  PUANLI_ALANLAR,
  kalitePuani,
  kaliteRengi,
  type FranchiseBasvuru,
} from "@/lib/franchise";

const gir =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const kart =
  "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4";

function Rozet({ durum }: { durum: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium text-white whitespace-nowrap"
      style={{ backgroundColor: DURUM_RENK[durum] ?? "#6b7280" }}
    >
      {durum}
    </span>
  );
}

/** Ekleme ve düzenlemede aynı alanlar kullanılıyor. */
function Alanlar({ b, kisiler }: { b?: FranchiseBasvuru; kisiler: string[] }) {
  const [secim, setSecim] = useState<Record<string, string>>({
    dukkan: b?.dukkan ?? "",
    sermaye: b?.sermaye ?? "",
    niyet_istek: b?.niyet_istek ?? "",
    isi_yonetme: b?.isi_yonetme ?? "",
  });
  const puan = kalitePuani(secim);
  const [durum, setDurum] = useState(b?.son_durum ?? "Yeni Başvuru");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">Başvuru tarihi *</span>
          <input
            name="tarih"
            type="date"
            required
            defaultValue={b?.tarih ?? new Date().toISOString().slice(0, 10)}
            className={gir + " w-full"}
          />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">İsim *</span>
          <input name="isim" required defaultValue={b?.isim} className={gir + " w-full"} />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">Telefon</span>
          <input name="telefon" defaultValue={b?.telefon} className={gir + " w-full"} />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">Kanal</span>
          <select name="kanal" defaultValue={b?.kanal ?? ""} className={gir + " w-full"}>
            <option value="">—</option>
            {KANALLAR.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">İl</span>
          <input name="il" defaultValue={b?.il} className={gir + " w-full"} />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">İlçe</span>
          <input name="ilce" defaultValue={b?.ilce} className={gir + " w-full"} />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">İlave iller</span>
          <input name="ilave_iller" defaultValue={b?.ilave_iller} className={gir + " w-full"} />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">İlave ilçeler</span>
          <input name="ilave_ilceler" defaultValue={b?.ilave_ilceler} className={gir + " w-full"} />
        </label>
      </div>

      {/* Puanlanan alanlar */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">
            Değerlendirme
          </span>
          <span className="text-sm">
            Kalite puanı:{" "}
            <b style={{ color: kaliteRengi(puan) }}>{puan}</b>
            <span className="text-neutral-400">/100</span>
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PUANLI_ALANLAR.map((alan) => (
            <label key={alan.key} className="block">
              <span className="block text-xs text-neutral-500 mb-1">{alan.etiket}</span>
              <select
                name={alan.key}
                value={secim[alan.key]}
                onChange={(e) => setSecim((s) => ({ ...s, [alan.key]: e.target.value }))}
                className={gir + " w-full"}
              >
                <option value="">— (0 puan)</option>
                {alan.secenekler.map((s) => (
                  <option key={s.deger} value={s.deger}>
                    {s.deger} ({s.puan})
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">Şirket sorumlusu</span>
          {/* Serbest metin değil seçim: "Genel Ekip" gibi kişi olmayan
              değerler girilince o başvuru kimsenin faaliyet raporuna
              düşmüyordu. Eski kayıtta sistemde olmayan bir ad varsa
              kaybolmasın diye listeye ekleniyor. */}
          <select
            name="sirket_sorumlusu"
            defaultValue={b?.sirket_sorumlusu ?? ""}
            className={gir + " w-full"}
          >
            <option value="">— seçilmedi —</option>
            {kisiler.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {b?.sirket_sorumlusu && !kisiler.includes(b.sirket_sorumlusu) && (
              <option value={b.sirket_sorumlusu}>{b.sirket_sorumlusu} (eski kayıt)</option>
            )}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">Son durum</span>
          <select
            name="son_durum"
            value={durum}
            onChange={(e) => setDurum(e.target.value)}
            className={gir + " w-full"}
          >
            {DURUMLAR.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">Sorumlu arama tarihi</span>
          <input
            name="sorumlu_arama_tarihi"
            type="date"
            defaultValue={b?.sorumlu_arama_tarihi ?? ""}
            className={gir + " w-full"}
          />
        </label>
        {durum === "Kaybedildi" && (
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Kaybetme nedeni</span>
            <select
              name="kaybetme_nedeni"
              defaultValue={b?.kaybetme_nedeni ?? ""}
              className={gir + " w-full"}
            >
              <option value="">—</option>
              {KAYIP_NEDENLERI.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="block">
        <span className="block text-xs text-neutral-500 mb-1">Görüşme notu</span>
        <textarea name="gorusme_notu" rows={2} defaultValue={b?.gorusme_notu} className={gir + " w-full"} />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">Memnuniyet araması tarihi</span>
          <input
            name="memnuniyet_arama_tarihi"
            type="date"
            defaultValue={b?.memnuniyet_arama_tarihi ?? ""}
            className={gir + " w-full"}
          />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">Memnuniyet neticesi</span>
          <select
            name="memnuniyet_neticesi"
            defaultValue={b?.memnuniyet_neticesi ?? ""}
            className={gir + " w-full"}
          >
            <option value="">—</option>
            {MEMNUNIYET.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">Memnuniyet notu</span>
          <input name="memnuniyet_notu" defaultValue={b?.memnuniyet_notu} className={gir + " w-full"} />
        </label>
      </div>
    </div>
  );
}

export function BasvuruArayuz({
  basvurular,
  sorumlular,
  kisiler,
  yazabilir,
  silebilir,
  bolgeler,
  yetkililer,
  subeAdlari,
}: {
  basvurular: FranchiseBasvuru[];
  sorumlular: string[];
  kisiler: string[];
  yazabilir: boolean;
  silebilir: boolean;
  bolgeler: string[];
  yetkililer: string[];
  subeAdlari: Record<string, string>;
}) {
  const [ekleAcik, setEkleAcik] = useState(false);
  const [acikId, setAcikId] = useState<string | null>(null);

  const [ekleDurum, ekleAction, eklePending] = useActionState(basvuruEkle, null);
  const [guncelleDurum, guncelleAction, guncellePending] = useActionState(basvuruGuncelle, null);
  const [silDurum, silAction, silPending] = useActionState(basvuruSil, null);
  const durum = ekleDurum ?? guncelleDurum ?? silDurum;

  const [fDurum, setFDurum] = useState("");
  const [fKanal, setFKanal] = useState("");
  const [fSorumlu, setFSorumlu] = useState("");
  const [topluKisi, setTopluKisi] = useState("");
  const [topluCalisiyor, setTopluCalisiyor] = useState(false);
  const [topluSonuc, setTopluSonuc] = useState<string | null>(null);
  const [ara, setAra] = useState("");

  const listelenen = useMemo(() => {
    const a = ara.trim().toLocaleLowerCase("tr");
    return basvurular.filter(
      (b) =>
        (!fDurum || b.son_durum === fDurum) &&
        (!fKanal || b.kanal === fKanal) &&
        (!fSorumlu || b.sirket_sorumlusu === fSorumlu) &&
        (!a ||
          b.isim.toLocaleLowerCase("tr").includes(a) ||
          (b.telefon ?? "").includes(a) ||
          (b.il ?? "").toLocaleLowerCase("tr").includes(a) ||
          (b.basvuru_no ?? "").toLocaleLowerCase("tr").includes(a)),
    );
  }, [basvurular, fDurum, fKanal, fSorumlu, ara]);

  const sayim = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of basvurular) m.set(b.son_durum, (m.get(b.son_durum) ?? 0) + 1);
    return m;
  }, [basvurular]);

  const ortPuan = useMemo(() => {
    const p = basvurular.filter((b) => b.kalite_puani > 0).map((b) => b.kalite_puani);
    return p.length ? Math.round((p.reduce((a, x) => a + x, 0) / p.length) * 10) / 10 : 0;
  }, [basvurular]);

  return (
    <div className="space-y-4">
      {/* Durum özeti */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <button
          type="button"
          onClick={() => setFDurum("")}
          className={`${kart} !p-3 text-center ${!fDurum ? "ring-2 ring-neutral-900 dark:ring-neutral-100" : ""}`}
        >
          <div className="text-lg font-extrabold">{basvurular.length}</div>
          <div className="text-[10px] text-neutral-500">Toplam</div>
        </button>
        {DURUMLAR.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFDurum(fDurum === d ? "" : d)}
            className={`${kart} !p-3 text-center ${fDurum === d ? "ring-2 ring-neutral-900 dark:ring-neutral-100" : ""}`}
          >
            <div className="text-lg font-extrabold" style={{ color: DURUM_RENK[d] }}>
              {sayim.get(d) ?? 0}
            </div>
            <div className="text-[10px] text-neutral-500 leading-tight">{d}</div>
          </button>
        ))}
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={ara}
          onChange={(e) => setAra(e.target.value)}
          placeholder="İsim, telefon, il veya başvuru no ara…"
          className={gir + " min-w-64"}
        />
        <select value={fKanal} onChange={(e) => setFKanal(e.target.value)} className={gir}>
          <option value="">Tüm kanallar</option>
          {KANALLAR.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select value={fSorumlu} onChange={(e) => setFSorumlu(e.target.value)} className={gir}>
          <option value="">Tüm sorumlular</option>
          {sorumlular.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">
          {listelenen.length} kayıt · ort. kalite <b>{ortPuan}</b>/100
        </span>
        {yazabilir && (
          <button
            type="button"
            onClick={() => setEkleAcik((v) => !v)}
            className="ml-auto rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium"
          >
            {ekleAcik ? "Vazgeç" : "＋ Yeni başvuru"}
          </button>
        )}
      </div>

      {/* Toplu sorumlu atama: filtreyle daralt, sonra hepsini bir kişiye ver.
          662 kaydı tek tek düzeltmek pratik olmadığı için var. */}
      {yazabilir && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 px-3 py-2.5 flex flex-wrap items-center gap-2">
          <span className="text-sm">
            Filtredeki <b>{listelenen.length}</b> kaydın sorumlusunu topluca değiştir:
          </span>
          <select
            value={topluKisi}
            onChange={(e) => setTopluKisi(e.target.value)}
            className={gir}
          >
            <option value="">— kişi seçin —</option>
            {kisiler.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!topluKisi || !listelenen.length || topluCalisiyor}
            onClick={async () => {
              const soru =
                `Filtredeki ${listelenen.length} başvurunun sorumlusu "${topluKisi}" olarak ` +
                `değiştirilecek. Bu işlem geri alınamaz. Onaylıyor musunuz?`;
              if (!window.confirm(soru)) return;
              setTopluCalisiyor(true);
              setTopluSonuc(null);
              const r = await topluSorumluAta(listelenen.map((b) => b.id), topluKisi);
              setTopluCalisiyor(false);
              setTopluSonuc(
                r.hata ? `Hata: ${r.hata}` : `${r.guncellenen} başvuru ${topluKisi} adına geçti.`,
              );
            }}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {topluCalisiyor ? "Atanıyor…" : "Ata"}
          </button>
          {topluSonuc && (
            <span
              className={
                topluSonuc.startsWith("Hata") ? "text-sm text-red-600" : "text-sm text-emerald-600"
              }
            >
              {topluSonuc}
            </span>
          )}
        </div>
      )}

      {durum?.ok && <p className="text-sm text-emerald-600">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600">{durum.hata}</p>}

      {/* Yeni başvuru */}
      {ekleAcik && yazabilir && (
        <form action={ekleAction} className={kart + " space-y-3"}>
          <h3 className="font-medium text-sm">Yeni Başvuru</h3>
          <Alanlar kisiler={kisiler} />
          <button
            type="submit"
            disabled={eklePending}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {eklePending ? "Kaydediliyor…" : "Başvuruyu kaydet"}
          </button>
        </form>
      )}

      {/* Liste */}
      <div className={kart + " !p-0 overflow-x-auto"}>
        <table className="w-full text-[13px]">
          <thead className="text-[11px] uppercase text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50">
            <tr>
              <th className="px-3 py-2 text-left">No</th>
              <th className="px-3 py-2 text-left">Tarih</th>
              <th className="px-3 py-2 text-left">İsim</th>
              <th className="px-3 py-2 text-left">Telefon</th>
              <th className="px-3 py-2 text-left">İl / İlçe</th>
              <th className="px-3 py-2 text-left">Kanal</th>
              <th className="px-3 py-2 text-left">Sorumlu</th>
              <th className="px-3 py-2 text-left">Durum</th>
              <th className="px-3 py-2 text-right">Kalite</th>
            </tr>
          </thead>
          <tbody>
            {listelenen.slice(0, 300).map((b) => (
              <>
                <tr
                  key={b.id}
                  onClick={() => setAcikId(acikId === b.id ? null : b.id)}
                  className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer"
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-neutral-500">{b.basvuru_no}</td>
                  <td className="px-3 py-2 tabular-nums">{b.tarih}</td>
                  <td className="px-3 py-2 font-medium">{b.isim}</td>
                  <td className="px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">{b.telefon}</td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                    {b.il}
                    {b.ilce ? ` / ${b.ilce}` : ""}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{b.kanal}</td>
                  <td className="px-3 py-2 text-neutral-500">{b.sirket_sorumlusu}</td>
                  <td className="px-3 py-2"><Rozet durum={b.son_durum} /></td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: kaliteRengi(b.kalite_puani) }}>
                    {b.kalite_puani}
                  </td>
                </tr>
                {acikId === b.id && (
                  <tr key={b.id + "-detay"} className="bg-neutral-50 dark:bg-neutral-800/40">
                    <td colSpan={9} className="px-4 py-4">
                      {yazabilir && (
                        <div className="max-w-5xl mb-3">
                          <SubeAcPaneli
                            basvuru={{
                              id: b.id,
                              isim: b.isim,
                              telefon: b.telefon ?? "",
                              il: b.il ?? "",
                              ilce: b.ilce ?? "",
                              sube_id: b.sube_id ?? null,
                              sube_acilis_at: b.sube_acilis_at ?? null,
                            }}
                            bolgeler={bolgeler}
                            yetkililer={yetkililer}
                            subeAdi={b.sube_id ? (subeAdlari[b.sube_id] ?? null) : null}
                            silebilir={silebilir}
                          />
                        </div>
                      )}
                      {yazabilir ? (
                        <form action={guncelleAction} className="space-y-3 max-w-5xl">
                          <input type="hidden" name="basvuru_id" value={b.id} />
                          <Alanlar b={b} kisiler={kisiler} />
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="submit"
                              disabled={guncellePending}
                              className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
                            >
                              {guncellePending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
                            </button>
                            {silebilir && (
                              <span className="ml-auto">
                                <button
                                  type="submit"
                                  formAction={silAction}
                                  disabled={silPending}
                                  className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3 py-1.5 text-sm"
                                >
                                  🗑 Sil
                                </button>
                              </span>
                            )}
                          </div>
                        </form>
                      ) : (
                        <div className="text-sm text-neutral-500 space-y-1">
                          <p><b>Görüşme notu:</b> {b.gorusme_notu || "—"}</p>
                          <p><b>Memnuniyet:</b> {b.memnuniyet_neticesi || "—"} {b.memnuniyet_notu}</p>
                          <p className="text-xs text-neutral-400">Düzenleme yetkiniz yok.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!listelenen.length && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-neutral-400">
                  Filtreye uyan başvuru yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {listelenen.length > 300 && (
          <div className="px-3 py-2 text-xs text-neutral-500 border-t border-neutral-100 dark:border-neutral-800">
            İlk 300 kayıt gösteriliyor ({listelenen.length} eşleşme). Aramayla daraltın.
          </div>
        )}
      </div>
    </div>
  );
}
