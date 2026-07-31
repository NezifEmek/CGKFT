"use client";

import { useActionState, useMemo, useState } from "react";
import {
  toplantiOlustur, gundemGonder, toplantiyiBitir,
  gundemEkle, gundemSil, gundemNotKaydet,
  gorevAta, gorevDurumGuncelle,
  ertelemeTalep, ertelemeKarar, ayarKaydet,
} from "./actions";
import {
  TOPLANTI_DURUM_ETIKET, TOPLANTI_DURUM_RENK,
  gecikmisMi, gecikmeGunu, zamanindaMi,
  kisiPerformanslari, ertelemeSayisi, bekleyenErteleme,
  gundemMetni, sonucMetni,
  type Toplanti, type Gundem, type Gorev, type Erteleme,
} from "@/lib/toplanti";

const gir = "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const kart = "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4";
const btn = "rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3.5 py-1.5 text-sm font-medium disabled:opacity-60";

export interface Kisi { id: string; ad: string }

function metniIndir(ad: string, metin: string) {
  const blob = new Blob([metin], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = ad + ".txt";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ToplantiArayuz({
  toplantilar, gundemler, gorevler, ertelemeler, kisiler,
  raportorId, varsayilanKatilimcilar, benId, raportorMuyum, genelMudurMuyum,
}: {
  toplantilar: Toplanti[];
  gundemler: Gundem[];
  gorevler: Gorev[];
  ertelemeler: Erteleme[];
  kisiler: Kisi[];
  raportorId: string | null;
  varsayilanKatilimcilar: string[];
  benId: string;
  raportorMuyum: boolean;
  genelMudurMuyum: boolean;
}) {
  const [sekme, setSekme] = useState<"toplanti" | "gorevler" | "performans" | "ayarlar">("toplanti");
  const [seciliId, setSeciliId] = useState(toplantilar[0]?.id ?? "");
  const [d1, a1, p1] = useActionState(gundemEkle, null);
  const [d2, a2, p2] = useActionState(gundemNotKaydet, null);
  const [d3, a3, p3] = useActionState(gorevAta, null);
  const [d4, a4, p4] = useActionState(gorevDurumGuncelle, null);
  const [d5, a5, p5] = useActionState(ertelemeTalep, null);
  const [d6, a6, p6] = useActionState(ertelemeKarar, null);
  const [d7, a7, p7] = useActionState(toplantiyiBitir, null);
  const [d8, a8, p8] = useActionState(gundemGonder, null);
  const [d9, a9, p9] = useActionState(toplantiOlustur, null);
  const [d10, a10, p10] = useActionState(gundemSil, null);
  const [d11, a11, p11] = useActionState(ayarKaydet, null);
  const durum = d1 ?? d2 ?? d3 ?? d4 ?? d5 ?? d6 ?? d7 ?? d8 ?? d9 ?? d10 ?? d11;

  const adlar = useMemo(() => new Map(kisiler.map((k) => [k.id, k.ad])), [kisiler]);
  const secili = toplantilar.find((t) => t.id === seciliId) ?? toplantilar[0];
  const sGundem = useMemo(
    () => gundemler.filter((g) => g.toplanti_id === secili?.id).sort((a, b) => a.sira - b.sira),
    [gundemler, secili],
  );
  const sGorev = useMemo(() => gorevler.filter((g) => g.toplanti_id === secili?.id), [gorevler, secili]);
  const bekleyenler = ertelemeler.filter((e) => e.onay_durumu === "bekliyor");
  const perf = useMemo(() => kisiPerformanslari(gorevler, ertelemeler), [gorevler, ertelemeler]);
  const acikMi = secili && secili.durum !== "tamamlandi";

  const sekmeSinif = (a: boolean) =>
    `px-4 py-2.5 text-sm border-b-2 -mb-0.5 ${a ? "border-red-700 text-red-700 dark:text-red-400 font-semibold" : "border-transparent text-neutral-500"}`;

  function GorevSatiri({ g }: { g: Gorev }) {
    const bekleyen = bekleyenErteleme(g.id, ertelemeler);
    const kez = ertelemeSayisi(g.id, ertelemeler);
    const benim = g.atanan_id === benId;
    const zam = zamanindaMi(g);
    return (
      <div className="border-t border-neutral-100 dark:border-neutral-800 py-2.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium text-[13px]">{g.baslik}</span>
          <span className="text-xs text-neutral-500">{adlar.get(g.atanan_id) ?? "—"}</span>
          <span className={`text-xs ${gecikmisMi(g) ? "text-red-600 font-semibold" : "text-neutral-500"}`}>
            termin {g.termin}
            {gecikmisMi(g) && ` · ${gecikmeGunu(g)} gün gecikti`}
          </span>
          {g.durum === "tamamlandi" && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${zam ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"}`}>
              {zam ? "zamanında tamamlandı" : "geç tamamlandı"}
            </span>
          )}
          {g.durum === "iptal" && <span className="text-[11px] text-neutral-400">iptal</span>}
          {kez > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
              {kez} kez ertelendi
            </span>
          )}
        </div>
        {g.aciklama && <p className="text-xs text-neutral-500 mt-0.5">{g.aciklama}</p>}

        {bekleyen && (
          <div className="mt-2 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs">
            <b>Erteleme talebi:</b> {bekleyen.eski_termin} → {bekleyen.yeni_termin} ·{" "}
            {bekleyen.gerekce}
            <div className="text-[11px] text-neutral-500 mt-0.5">
              Talep eden: {adlar.get(bekleyen.talep_eden_id) ?? "—"} · genel müdür onayı bekliyor
            </div>
            {genelMudurMuyum && (
              <form action={a6} className="flex flex-wrap items-center gap-2 mt-2">
                <input type="hidden" name="erteleme_id" value={bekleyen.id} />
                <input name="karar_notu" placeholder="Karar notu (ops.)" className={gir + " flex-1 min-w-40"} />
                <button type="submit" name="karar" value="onaylandi" disabled={p6} className={btn}>Onayla</button>
                <button type="submit" name="karar" value="reddedildi" disabled={p6} className={gir}>Reddet</button>
              </form>
            )}
          </div>
        )}

        {benim && g.durum === "acik" && (
          <div className="flex flex-wrap gap-3 mt-2">
            <form action={a4} className="flex items-center gap-2">
              <input type="hidden" name="gorev_id" value={g.id} />
              <input type="hidden" name="durum" value="tamamlandi" />
              <input name="sonuc_notu" placeholder="Sonuç notu" className={gir} />
              <button type="submit" disabled={p4} className={btn}>Tamamlandı</button>
            </form>
            {!bekleyen && (
              <form action={a5} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="gorev_id" value={g.id} />
                <input name="yeni_termin" type="date" required className={gir} />
                <input name="gerekce" required placeholder="Erteleme gerekçesi" className={gir + " min-w-48"} />
                <button type="submit" disabled={p5} className={gir}>Erteleme talep et</button>
              </form>
            )}
          </div>
        )}
        {g.sonuc_notu && <p className="text-xs text-neutral-500 mt-1">Sonuç: {g.sonuc_notu}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap border-b-2 border-neutral-200 dark:border-neutral-800">
        <button type="button" onClick={() => setSekme("toplanti")} className={sekmeSinif(sekme === "toplanti")}>🗓️ Toplantı</button>
        <button type="button" onClick={() => setSekme("gorevler")} className={sekmeSinif(sekme === "gorevler")}>
          ✅ Görevler{bekleyenler.length ? ` (${bekleyenler.length} onay)` : ""}
        </button>
        <button type="button" onClick={() => setSekme("performans")} className={sekmeSinif(sekme === "performans")}>📊 Performans</button>
        {genelMudurMuyum && (
          <button type="button" onClick={() => setSekme("ayarlar")} className={sekmeSinif(sekme === "ayarlar")}>⚙️ Ayarlar</button>
        )}
      </div>

      {durum?.ok && <p className="text-sm text-emerald-600">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600">{durum.hata}</p>}

      {/* ── TOPLANTI ── */}
      {sekme === "toplanti" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select value={seciliId} onChange={(e) => setSeciliId(e.target.value)} className={gir}>
              {toplantilar.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.no}. toplantı — {t.tarih} ({TOPLANTI_DURUM_ETIKET[t.durum]})
                </option>
              ))}
            </select>
            {secili && (
              <span className="text-[11px] px-2 py-1 rounded-full text-white" style={{ backgroundColor: TOPLANTI_DURUM_RENK[secili.durum] }}>
                {TOPLANTI_DURUM_ETIKET[secili.durum]}
              </span>
            )}
            {raportorMuyum && (
              <form action={a9} className="flex items-center gap-2 ml-auto">
                <input name="tarih" type="date" required className={gir} />
                <button type="submit" disabled={p9} className={gir}>＋ Yeni toplantı</button>
              </form>
            )}
          </div>

          {!secili ? (
            <div className={kart + " text-sm text-neutral-500"}>Henüz toplantı yok.</div>
          ) : (
            <>
              {/* Gündem ekleme — herkes */}
              {acikMi && (
                <form action={a1} className={kart + " space-y-2"}>
                  <input type="hidden" name="toplanti_id" value={secili.id} />
                  <h3 className="font-medium text-sm">Gündem maddesi ekle</h3>
                  <p className="text-[11px] text-neutral-500">Bu toplantıya herkes gündem ekleyebilir.</p>
                  <div className="grid md:grid-cols-3 gap-2">
                    <input name="baslik" required placeholder="Başlık *" className={gir + " md:col-span-1"} />
                    <input name="aciklama" placeholder="Açıklama" className={gir + " md:col-span-2"} />
                  </div>
                  <button type="submit" disabled={p1} className={btn}>Ekle</button>
                </form>
              )}

              {/* Gündem listesi */}
              <div className={kart + " space-y-1"}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="font-medium text-sm mr-auto">Gündem ({sGundem.length} madde)</h3>
                  <button type="button" onClick={() => metniIndir(`toplanti-${secili.no}-gundem`, gundemMetni(secili, sGundem, adlar))} className={gir}>
                    ⬇ Gündemi indir
                  </button>
                  {raportorMuyum && acikMi && (
                    <form action={a8}>
                      <input type="hidden" name="toplanti_id" value={secili.id} />
                      <button type="submit" disabled={p8} className={gir}>📤 Gündemi paylaşıldı işaretle</button>
                    </form>
                  )}
                </div>
                {secili.gundem_gonderildi_at && (
                  <p className="text-[11px] text-neutral-400 mb-1">
                    Gündem {secili.gundem_gonderildi_at.slice(0, 10)} tarihinde paylaşıldı.
                  </p>
                )}

                {sGundem.map((g, i) => (
                  <div key={g.id} className="border-t border-neutral-100 dark:border-neutral-800 py-2.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium text-[13px]">{i + 1}. {g.baslik}</span>
                      <span className="text-[11px] text-neutral-400">{adlar.get(g.ekleyen_id) ?? "—"}</span>
                      {(g.ekleyen_id === benId || raportorMuyum) && acikMi && (
                        <form action={a10} className="ml-auto">
                          <input type="hidden" name="gundem_id" value={g.id} />
                          <button type="submit" disabled={p10} className="text-xs text-red-600 hover:underline">sil</button>
                        </form>
                      )}
                    </div>
                    {g.aciklama && <p className="text-xs text-neutral-500 mt-0.5">{g.aciklama}</p>}

                    {(g.toplanti_notu || g.karar) && (
                      <div className="text-xs mt-1.5 space-y-0.5">
                        {g.toplanti_notu && <p><b>Not:</b> {g.toplanti_notu}</p>}
                        {g.karar && <p className="text-emerald-700 dark:text-emerald-400"><b>Karar:</b> {g.karar}</p>}
                      </div>
                    )}

                    {raportorMuyum && acikMi && (
                      <details className="mt-2">
                        <summary className="text-xs text-neutral-500 cursor-pointer">Toplantı notu / karar / görev</summary>
                        <form action={a2} className="space-y-2 mt-2">
                          <input type="hidden" name="gundem_id" value={g.id} />
                          <textarea name="toplanti_notu" rows={2} defaultValue={g.toplanti_notu} placeholder="Toplantı notu" className={gir + " w-full"} />
                          <textarea name="karar" rows={2} defaultValue={g.karar} placeholder="Alınan karar" className={gir + " w-full"} />
                          <button type="submit" disabled={p2} className={btn}>Not ve kararı kaydet</button>
                        </form>
                        <form action={a3} className="grid md:grid-cols-4 gap-2 mt-3">
                          <input type="hidden" name="toplanti_id" value={secili.id} />
                          <input type="hidden" name="gundem_id" value={g.id} />
                          <input name="baslik" required placeholder="Görev *" className={gir} />
                          <select name="atanan_id" required className={gir}>
                            <option value="">Kime? *</option>
                            {kisiler.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
                          </select>
                          <input name="termin" type="date" required className={gir} />
                          <button type="submit" disabled={p3} className={gir}>Görev ata</button>
                        </form>
                      </details>
                    )}

                    {sGorev.filter((x) => x.gundem_id === g.id).map((x) => <GorevSatiri key={x.id} g={x} />)}
                  </div>
                ))}
                {!sGundem.length && <p className="text-sm text-neutral-400 py-4 text-center">Henüz gündem maddesi yok.</p>}
              </div>

              {/* Toplantıyı bitir */}
              {raportorMuyum && acikMi && (
                <form action={a7} className={kart + " space-y-2"}>
                  <input type="hidden" name="toplanti_id" value={secili.id} />
                  <h3 className="font-medium text-sm">Toplantıyı bitir</h3>
                  <textarea name="genel_not" rows={2} defaultValue={secili.genel_not} placeholder="Genel not" className={gir + " w-full"} />
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="submit" disabled={p7} className={btn}>🏁 Toplantıyı bitir ve sıradakini aç</button>
                    <button type="button" onClick={() => metniIndir(`toplanti-${secili.no}-sonuc`, sonucMetni(secili, sGundem, sGorev, adlar))} className={gir}>
                      ⬇ Kararları ve görevleri indir
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Bitirdiğinizde bir sonraki toplantı otomatik açılır (7 gün sonrası) ve gündem birikmeye başlar.
                    E-posta gönderimi henüz kurulu değil; metni indirip paylaşabilirsiniz.
                  </p>
                </form>
              )}
            </>
          )}
        </>
      )}

      {/* ── GÖREVLER ── */}
      {sekme === "gorevler" && (
        <div className={kart}>
          <h3 className="font-medium text-sm mb-1">Tüm görevler</h3>
          <p className="text-[11px] text-neutral-500 mb-2">
            Termin yalnızca genel müdür onayıyla değişir. Kendi görevinizi tamamlayabilir veya erteleme talep edebilirsiniz.
          </p>
          {["acik", "tamamlandi", "iptal"].map((d) => {
            const liste = gorevler.filter((g) => g.durum === d)
              .sort((a, b) => a.termin.localeCompare(b.termin));
            if (!liste.length) return null;
            return (
              <div key={d} className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  {d === "acik" ? "Açık" : d === "tamamlandi" ? "Tamamlanan" : "İptal"} ({liste.length})
                </p>
                {liste.map((g) => (
                  <div key={g.id}>
                    <span className="text-[11px] text-neutral-400">
                      {toplantilar.find((t) => t.id === g.toplanti_id)?.no ?? "?"}. toplantı
                    </span>
                    <GorevSatiri g={g} />
                  </div>
                ))}
              </div>
            );
          })}
          {!gorevler.length && <p className="text-sm text-neutral-400 py-4 text-center">Henüz görev yok.</p>}
        </div>
      )}

      {/* ── PERFORMANS ── */}
      {sekme === "performans" && (
        <div className={kart + " overflow-x-auto"}>
          <h3 className="font-medium text-sm mb-1">Görev tamamlama performansı</h3>
          <p className="text-[11px] text-neutral-500 mb-3">
            Başarı oranı yalnızca tamamlanan görevler üzerinden: zamanında biten / tamamlanan.
            Açık görevler kimseyi cezalandırmaz, ama gecikmiş açık görevler ayrı sütunda görünür.
          </p>
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase text-neutral-500">
              <tr className="border-b-2 border-neutral-200 dark:border-neutral-800">
                <th className="px-2 py-2 text-left">Kişi</th>
                <th className="px-2 py-2 text-right">Toplam</th>
                <th className="px-2 py-2 text-right">Tamamlanan</th>
                <th className="px-2 py-2 text-right">Zamanında</th>
                <th className="px-2 py-2 text-right">Geç</th>
                <th className="px-2 py-2 text-right">Açık</th>
                <th className="px-2 py-2 text-right">Gecikmiş</th>
                <th className="px-2 py-2 text-right">Erteleme</th>
                <th className="px-2 py-2 text-right">Başarı</th>
              </tr>
            </thead>
            <tbody>
              {[...perf.values()].sort((a, b) => (b.basariOrani ?? -1) - (a.basariOrani ?? -1)).map((k) => (
                <tr key={k.atanan_id} className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="px-2 py-2 font-medium">{adlar.get(k.atanan_id) ?? "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{k.toplam}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{k.tamamlanan}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-emerald-600">{k.zamaninda}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-amber-600">{k.geciken}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{k.acik}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-red-600">{k.gecikmisAcik}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{k.ertelemeSayisi}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-bold">
                    {k.basariOrani == null ? "—" : `%${Math.round(k.basariOrani * 100)}`}
                  </td>
                </tr>
              ))}
              {!perf.size && (
                <tr><td colSpan={9} className="px-2 py-6 text-center text-neutral-400">Henüz görev yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── AYARLAR ── */}
      {sekme === "ayarlar" && genelMudurMuyum && (
        <form action={a11} className={kart + " space-y-3"}>
          <h3 className="font-medium text-sm">Toplantı ayarları</h3>
          <label className="block max-w-sm">
            <span className="block text-xs text-neutral-500 mb-1">Raportör</span>
            <select name="raportor_id" defaultValue={raportorId ?? ""} className={gir + " w-full"}>
              <option value="">— seçilmedi —</option>
              {kisiler.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
            </select>
            <span className="block text-[11px] text-neutral-500 mt-1">
              Raportör gündemi paylaşır, toplantı notu ve karar yazar, görev atar, toplantıyı bitirir.
            </span>
          </label>
          <div>
            <span className="block text-xs text-neutral-500 mb-1">Varsayılan katılımcılar</span>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-1">
              {kisiler.map((k) => (
                <label key={k.id} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" name="katilimci" value={k.id}
                    defaultChecked={varsayilanKatilimcilar.includes(k.id)} className="h-3.5 w-3.5" />
                  {k.ad}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={p11} className={btn}>Ayarları kaydet</button>
        </form>
      )}
    </div>
  );
}
