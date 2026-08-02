"use client";

import { useActionState, useMemo, useState } from "react";
import {
  kayitKaydet, kayitSil, urunKaydet, urunSil, tanimEkle, tanimSil, topluAktar,
  type AktarSatir,
} from "./actions";
import {
  uretimOzeti, uretimCsv, kgYaz, kilogramaCevir, basligiTani,
  OLCU_BIRIMLERI, AMBALAJ_BIRIMLERI, type Urun, type UretimKaydi, type Kirilim,
} from "@/lib/uretim";
import { YazdirDugmesi } from "@/components/yazdir-dugmesi";

const gir =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const kart =
  "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900";
const btn = "yazdirma-gizle " +
  "rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3.5 py-1.5 text-sm font-medium disabled:opacity-60";
const btnSade = "yazdirma-gizle " +
  "rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm disabled:opacity-60";

export interface Tanim {
  id: string;
  tur: string;
  ad: string;
  aktif: boolean;
}

type Sekme = "panel" | "giris" | "kayitlar" | "urunler" | "ayarlar";

function tarihYaz(t: string | null | undefined): string {
  if (!t) return "";
  const [y, a, g] = t.slice(0, 10).split("-");
  return g && a && y ? `${g}.${a}.${y}` : t;
}

export function UretimArayuz({
  kayitlar, urunler, tanimlar, bugun, yazabilir, yonetimMi, tabloYok,
}: {
  kayitlar: UretimKaydi[];
  urunler: Urun[];
  tanimlar: Tanim[];
  bugun: string;
  yazabilir: boolean;
  yonetimMi: boolean;
  tabloYok: boolean;
}) {
  const [sekme, setSekme] = useState<Sekme>("panel");
  const [duzenlenen, setDuzenlenen] = useState<UretimKaydi | null>(null);
  const [duzenlenenUrun, setDuzenlenenUrun] = useState<Urun | null>(null);

  // Filtreler
  const [fBas, setFBas] = useState("");
  const [fBit, setFBit] = useState("");
  const [fUrun, setFUrun] = useState("");
  const [fGrup, setFGrup] = useState("");
  const [fAmbalaj, setFAmbalaj] = useState("");
  const [fTesis, setFTesis] = useState("");
  const [fHat, setFHat] = useState("");
  const [fVardiya, setFVardiya] = useState("");
  const [fParti, setFParti] = useState("");

  const [d1, a1, p1] = useActionState(kayitKaydet, null);
  const [d2, a2, p2] = useActionState(kayitSil, null);
  const [d3, a3, p3] = useActionState(urunKaydet, null);
  const [d4, a4, p4] = useActionState(urunSil, null);
  const [d5, a5, p5] = useActionState(tanimEkle, null);
  const [d6, a6, p6] = useActionState(tanimSil, null);
  const durum = d1 ?? d2 ?? d3 ?? d4 ?? d5 ?? d6;

  const tesisler = tanimlar.filter((t) => t.tur === "tesis");
  const hatlar = tanimlar.filter((t) => t.tur === "hat");
  const vardiyalar = tanimlar.filter((t) => t.tur === "vardiya");

  const gruplar = useMemo(
    () => [...new Set(urunler.map((u) => u.grup).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [urunler],
  );
  const ambalajlar = useMemo(
    () => [...new Set(urunler.map((u) => u.ambalaj_tipi).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [urunler],
  );

  const listelenen = useMemo(() => {
    const parti = fParti.trim().toLocaleLowerCase("tr");
    return kayitlar.filter((k) => {
      if (fBas && k.tarih < fBas) return false;
      if (fBit && k.tarih > fBit) return false;
      if (fUrun && k.urun_id !== fUrun) return false;
      if (fGrup && k.urun_grup !== fGrup) return false;
      if (fAmbalaj && k.ambalaj_tipi !== fAmbalaj) return false;
      if (fTesis && k.tesis !== fTesis) return false;
      if (fHat && k.hat !== fHat) return false;
      if (fVardiya && k.vardiya !== fVardiya) return false;
      if (parti && !k.parti_no.toLocaleLowerCase("tr").includes(parti)) return false;
      return true;
    });
  }, [kayitlar, fBas, fBit, fUrun, fGrup, fAmbalaj, fTesis, fHat, fVardiya, fParti]);

  const ozet = useMemo(() => uretimOzeti(listelenen, bugun), [listelenen, bugun]);

  const filtreVar = fBas || fBit || fUrun || fGrup || fAmbalaj || fTesis || fHat || fVardiya || fParti;

  function csvIndir() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([uretimCsv(listelenen)], { type: "text/csv;charset=utf-8" }));
    a.download = `uretim-${bugun}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      {tabloYok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          <b>Üretim tabloları henüz oluşturulmamış.</b>{" "}
          <code className="text-xs">0013_uretim.sql</code> Supabase&apos;de çalıştırılmalı.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden">
          {([
            ["panel", "📊 Panel"], ["giris", "✏️ Üretim Girişi"], ["kayitlar", "📋 Kayıtlar"],
            ["urunler", "📦 Ürünler"], ["ayarlar", "⚙️ Tanımlar"],
          ] as const).map(([k, e]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSekme(k)}
              className={`px-3 py-1.5 text-sm ${
                sekme === k
                  ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        {(sekme === "panel" || sekme === "kayitlar") && (
          <span className="ml-auto flex gap-2">
            <button type="button" onClick={csvIndir} className={btnSade}>
              ⬇ Excel (CSV)
            </button>
            <YazdirDugmesi baslik={`Uretim-Raporu-${bugun}`} />
          </span>
        )}
      </div>

      {durum?.ok && <p className="text-sm text-emerald-600">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600">{durum.hata}</p>}

      {/* ── Filtreler (panel ve kayıtlar) ─────────────────────────── */}
      {(sekme === "panel" || sekme === "kayitlar") && (
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={fBas} onChange={(e) => setFBas(e.target.value)} className={gir} title="Başlangıç" />
          <input type="date" value={fBit} onChange={(e) => setFBit(e.target.value)} className={gir} title="Bitiş" />
          <select value={fUrun} onChange={(e) => setFUrun(e.target.value)} className={gir}>
            <option value="">Tüm ürünler</option>
            {urunler.map((u) => <option key={u.id} value={u.id}>{u.ad}</option>)}
          </select>
          <select value={fGrup} onChange={(e) => setFGrup(e.target.value)} className={gir}>
            <option value="">Tüm gruplar</option>
            {gruplar.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={fAmbalaj} onChange={(e) => setFAmbalaj(e.target.value)} className={gir}>
            <option value="">Tüm ambalajlar</option>
            {ambalajlar.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={fTesis} onChange={(e) => setFTesis(e.target.value)} className={gir}>
            <option value="">Tüm tesisler</option>
            {tesisler.map((t) => <option key={t.id} value={t.ad}>{t.ad}</option>)}
          </select>
          <select value={fHat} onChange={(e) => setFHat(e.target.value)} className={gir}>
            <option value="">Tüm hatlar</option>
            {hatlar.map((t) => <option key={t.id} value={t.ad}>{t.ad}</option>)}
          </select>
          <select value={fVardiya} onChange={(e) => setFVardiya(e.target.value)} className={gir}>
            <option value="">Tüm vardiyalar</option>
            {vardiyalar.map((t) => <option key={t.id} value={t.ad}>{t.ad}</option>)}
          </select>
          <input value={fParti} onChange={(e) => setFParti(e.target.value)} placeholder="Parti no" className={gir + " w-28"} />
          {filtreVar && (
            <button
              type="button"
              onClick={() => { setFBas(""); setFBit(""); setFUrun(""); setFGrup(""); setFAmbalaj(""); setFTesis(""); setFHat(""); setFVardiya(""); setFParti(""); }}
              className="text-xs text-neutral-500 hover:underline"
            >
              temizle ({listelenen.length}/{kayitlar.length})
            </button>
          )}
        </div>
      )}

      {/* ── PANEL ─────────────────────────────────────────────────── */}
      {sekme === "panel" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { s: kgYaz(ozet.bugunKg), e: "Bugünkü üretim" },
              { s: kgYaz(ozet.buAyKg), e: "Bu ay" },
              { s: kgYaz(ozet.toplamKg), e: "Seçili dönem toplamı" },
              { s: kgYaz(ozet.gunlukOrtalamaKg), e: `Günlük ortalama (${ozet.uretimGunuSayisi} gün)` },
              {
                s: ozet.cevrilemeyenSayisi,
                e: "Kg'a çevrilemeyen kayıt",
                r: ozet.cevrilemeyenSayisi ? "#dc2626" : undefined,
              },
            ].map((x) => (
              <div key={x.e} className={kart + " p-3 text-center"}>
                <div className="text-base font-extrabold" style={{ color: x.r }}>{x.s}</div>
                <div className="text-[10px] text-neutral-500">{x.e}</div>
              </div>
            ))}
          </div>

          {ozet.cevrilemeyenSayisi > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-sm text-amber-800 dark:text-amber-300">
              <b>{ozet.cevrilemeyenSayisi} kayıt toplamlara girmiyor.</b> Bu kayıtların ürün
              tanımında birim ağırlık (koli girildiyse koli adedi) eksik olduğu için kilogram
              karşılığı hesaplanamıyor. Ürünler sekmesinden tamamlanınca yeni kayıtlar toplama
              dahil olur.
            </div>
          )}

          {ozet.gunluk.length > 0 && (
            <div className={kart + " p-4"}>
              <h3 className="text-sm font-semibold mb-3">Günlük üretim trendi</h3>
              <Trend veri={ozet.gunluk.slice(-30).map((g) => ({ etiket: g.tarih.slice(5), deger: g.kg }))} />
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Dagilim baslik="Ürün bazında" veri={ozet.urunler} />
            <Dagilim baslik="Ürün grubu bazında" veri={ozet.gruplar} />
            <Dagilim baslik="Ambalaj bazında" veri={ozet.ambalajlar} />
            <Dagilim baslik="Tesis bazında" veri={ozet.tesisler} />
            <Dagilim baslik="Hat bazında" veri={ozet.hatlar} />
            <Dagilim baslik="Vardiya bazında" veri={ozet.vardiyalar} />
          </div>

          {ozet.aylik.length > 1 && (
            <div className={kart + " p-4"}>
              <h3 className="text-sm font-semibold mb-3">Aylık üretim</h3>
              <Trend veri={ozet.aylik.map((a) => ({ etiket: a.ay.slice(2), deger: a.kg }))} />
            </div>
          )}

          {!ozet.kayitSayisi && (
            <div className={kart + " text-center text-sm text-neutral-400 py-10"}>
              Henüz üretim kaydı yok. &quot;Üretim Girişi&quot; sekmesinden başlayın.
            </div>
          )}
        </div>
      )}

      {/* ── ÜRETİM GİRİŞİ ─────────────────────────────────────────── */}
      {sekme === "giris" && (
        <div className="space-y-4">
          {!urunler.length ? (
            <div className={kart + " p-5 text-sm"}>
              <b>Önce ürün tanımlamalısınız.</b> &quot;Ürünler&quot; sekmesinden en az bir ürün
              ekleyin — üretim kaydı ürüne bağlı olmadan girilemez.
            </div>
          ) : (
            <UretimFormu
              action={a1}
              pending={p1}
              urunler={urunler}
              tesisler={tesisler}
              hatlar={hatlar}
              vardiyalar={vardiyalar}
              bugun={bugun}
              duzenlenen={duzenlenen}
              iptal={() => setDuzenlenen(null)}
              yazabilir={yazabilir}
            />
          )}
          {yazabilir && urunler.length > 0 && <TopluAktarma urunler={urunler} />}
        </div>
      )}

      {/* ── KAYITLAR ──────────────────────────────────────────────── */}
      {sekme === "kayitlar" && (
        <div className={kart + " overflow-hidden"}>
          <div className="px-3 py-2 text-xs text-neutral-500 border-b border-neutral-100 dark:border-neutral-800 flex justify-between">
            <span>{listelenen.length} kayıt</span>
            <span className="font-medium">Toplam {kgYaz(ozet.toplamKg)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-xs text-neutral-500">
                <tr>
                  {["Tarih", "Tesis", "Hat", "Vardiya", "Ürün", "Ambalaj", "Miktar", "Kg", "Parti", "Operatör", ""].map((b) => (
                    <th key={b} className="text-left font-medium px-3 py-2 whitespace-nowrap">{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listelenen.map((k) => (
                  <tr key={k.id} className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                    <td className="px-3 py-2 whitespace-nowrap">{tarihYaz(k.tarih)}</td>
                    <td className="px-3 py-2 text-neutral-500">{k.tesis || "—"}</td>
                    <td className="px-3 py-2 text-neutral-500">{k.hat || "—"}</td>
                    <td className="px-3 py-2 text-neutral-500">{k.vardiya || "—"}</td>
                    <td className="px-3 py-2">{k.urun_ad}</td>
                    <td className="px-3 py-2 text-neutral-500">{k.ambalaj_tipi || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {Number(k.miktar).toLocaleString("tr-TR")} {k.olcu_birimi}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">
                      {k.kg_karsiligi == null ? (
                        <span className="text-amber-600 text-xs" title="Ürün tanımında birim ağırlık eksik">
                          çevrilemedi
                        </span>
                      ) : (
                        kgYaz(Number(k.kg_karsiligi))
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-500 text-xs">{k.parti_no || "—"}</td>
                    <td className="px-3 py-2 text-neutral-500 text-xs">{k.operator || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {yazabilir && (
                        <span className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setDuzenlenen(k); setSekme("giris"); }}
                            className="text-xs text-neutral-500 hover:underline"
                          >
                            düzelt
                          </button>
                          <form action={a2}>
                            <input type="hidden" name="kayit_id" value={k.id} />
                            <button type="submit" disabled={p2} className="text-xs text-red-500 hover:underline">
                              sil
                            </button>
                          </form>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!listelenen.length && (
            <div className="px-3 py-10 text-center text-sm text-neutral-400">
              {kayitlar.length ? "Filtreye uyan kayıt yok." : "Henüz üretim kaydı yok."}
            </div>
          )}
        </div>
      )}

      {/* ── ÜRÜNLER ───────────────────────────────────────────────── */}
      {sekme === "urunler" && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          <div className={kart + " overflow-hidden"}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-xs text-neutral-500">
                  <tr>
                    {["Kod", "Ad", "Grup", "Ambalaj", "Birim ağırlık", "Koli adedi", ""].map((b) => (
                      <th key={b} className="text-left font-medium px-3 py-2 whitespace-nowrap">{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {urunler.map((u) => {
                    const eksik = !u.birim_agirlik_kg;
                    return (
                      <tr key={u.id} className="border-t border-neutral-100 dark:border-neutral-800">
                        <td className="px-3 py-2 font-mono text-xs">{u.kod}</td>
                        <td className="px-3 py-2">
                          {u.ad}
                          {!u.aktif && <span className="text-[10px] text-neutral-400 ml-1">(pasif)</span>}
                        </td>
                        <td className="px-3 py-2 text-neutral-500">{u.grup || "—"}</td>
                        <td className="px-3 py-2 text-neutral-500">{u.ambalaj_tipi || "—"}</td>
                        <td className="px-3 py-2">
                          {eksik ? (
                            <span className="text-amber-600 text-xs">eksik ⚠</span>
                          ) : (
                            `${u.birim_agirlik_kg} kg`
                          )}
                        </td>
                        <td className="px-3 py-2 text-neutral-500">{u.koli_adedi ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {yonetimMi && (
                            <span className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setDuzenlenenUrun(u)}
                                className="text-xs text-neutral-500 hover:underline"
                              >
                                düzelt
                              </button>
                              <form action={a4}>
                                <input type="hidden" name="urun_id" value={u.id} />
                                <button type="submit" disabled={p4} className="text-xs text-red-500 hover:underline">
                                  sil
                                </button>
                              </form>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!urunler.length && (
              <div className="px-3 py-10 text-center text-sm text-neutral-400">Henüz ürün tanımlanmamış.</div>
            )}
          </div>

          {yonetimMi && (
            <form key={duzenlenenUrun?.id ?? "yeni"} action={a3} className={kart + " p-4 space-y-3"}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{duzenlenenUrun ? "Ürünü düzenle" : "Yeni ürün"}</h3>
                {duzenlenenUrun && (
                  <button type="button" onClick={() => setDuzenlenenUrun(null)} className="text-xs text-neutral-500 hover:underline">
                    ＋ yeni
                  </button>
                )}
              </div>
              <input type="hidden" name="urun_id" value={duzenlenenUrun?.id ?? ""} />
              <div className="grid grid-cols-2 gap-2">
                <A e="Ürün kodu *"><input name="kod" required defaultValue={duzenlenenUrun?.kod ?? ""} className={gir + " w-full"} /></A>
                <A e="Grup"><input name="grup" defaultValue={duzenlenenUrun?.grup ?? ""} className={gir + " w-full"} /></A>
              </div>
              <A e="Ürün adı *"><input name="ad" required defaultValue={duzenlenenUrun?.ad ?? ""} className={gir + " w-full"} /></A>
              <div className="grid grid-cols-2 gap-2">
                <A e="Ambalaj tipi">
                  <input name="ambalaj_tipi" placeholder="100 gr" defaultValue={duzenlenenUrun?.ambalaj_tipi ?? ""} className={gir + " w-full"} />
                </A>
                <A e="Ambalaj birimi">
                  <select name="ambalaj_birimi" defaultValue={duzenlenenUrun?.ambalaj_birimi ?? "Adet"} className={gir + " w-full"}>
                    {AMBALAJ_BIRIMLERI.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </A>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <A e="Bir adet kaç kg? *">
                  <input name="birim_agirlik_kg" inputMode="decimal" placeholder="0,1"
                    defaultValue={duzenlenenUrun?.birim_agirlik_kg ?? ""} className={gir + " w-full"} />
                </A>
                <A e="Bir kolide kaç adet?">
                  <input name="koli_adedi" inputMode="numeric" placeholder="20"
                    defaultValue={duzenlenenUrun?.koli_adedi ?? ""} className={gir + " w-full"} />
                </A>
              </div>
              <p className="text-[11px] text-neutral-500">
                Birim ağırlık, üretimin kilograma çevrilmesi için gerekli. Boş bırakılırsa bu
                ürünün adet/koli girişleri toplamlara giremez. Koli cinsinden giriş yapacaksanız
                koli adedi de gerekli.
              </p>
              <A e="Raf ömrü (gün)">
                <input name="raf_omru_gun" inputMode="numeric" defaultValue={duzenlenenUrun?.raf_omru_gun ?? ""} className={gir + " w-full"} />
              </A>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="aktif" defaultChecked={duzenlenenUrun ? duzenlenenUrun.aktif : true} />
                Aktif
              </label>
              <button type="submit" disabled={p3} className={btn}>
                {duzenlenenUrun ? "Güncelle" : "Ürün ekle"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── TANIMLAR ──────────────────────────────────────────────── */}
      {sekme === "ayarlar" && (
        <div className="grid md:grid-cols-3 gap-3">
          {([["tesis", "Üretim Tesisleri"], ["hat", "Üretim Hatları"], ["vardiya", "Vardiyalar"]] as const).map(
            ([tur, baslik]) => (
              <div key={tur} className={kart + " p-4"}>
                <h3 className="text-sm font-semibold mb-2">{baslik}</h3>
                <ul className="space-y-1 mb-3">
                  {tanimlar.filter((t) => t.tur === tur).map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{t.ad}</span>
                      {yonetimMi && (
                        <form action={a6}>
                          <input type="hidden" name="tanim_id" value={t.id} />
                          <button type="submit" disabled={p6} className="text-xs text-red-500 hover:underline">
                            sil
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                  {!tanimlar.some((t) => t.tur === tur) && (
                    <li className="text-sm text-neutral-400">Henüz tanım yok.</li>
                  )}
                </ul>
                {yonetimMi && (
                  <form action={a5} className="flex gap-2">
                    <input type="hidden" name="tur" value={tur} />
                    <input name="ad" required placeholder="Yeni…" className={gir + " flex-1 min-w-0"} />
                    <button type="submit" disabled={p5} className={btnSade}>Ekle</button>
                  </form>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function A({ e, children }: { e: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{e}</span>
      {children}
    </label>
  );
}

// ─── Üretim giriş formu ───────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function UretimFormu({
  action, pending, urunler, tesisler, hatlar, vardiyalar, bugun, duzenlenen, iptal, yazabilir,
}: {
  action: any;
  pending: boolean;
  urunler: Urun[];
  tesisler: Tanim[];
  hatlar: Tanim[];
  vardiyalar: Tanim[];
  bugun: string;
  duzenlenen: UretimKaydi | null;
  iptal: () => void;
  yazabilir: boolean;
}) {
  const [urunId, setUrunId] = useState(duzenlenen?.urun_id ?? urunler[0]?.id ?? "");
  const [miktar, setMiktar] = useState(String(duzenlenen?.miktar ?? ""));
  const [olcu, setOlcu] = useState(duzenlenen?.olcu_birimi ?? "Adet");

  const urun = urunler.find((u) => u.id === urunId) ?? null;
  const onizlemeKg = kilogramaCevir(miktar.replace(",", "."), olcu, urun);

  if (!yazabilir) {
    return (
      <div className={kart + " p-5 text-sm text-neutral-500"}>
        Denetmen rolü üretim verisini görüntüler, giriş yapamaz.
      </div>
    );
  }

  return (
    <form key={duzenlenen?.id ?? "yeni"} action={action} className={kart + " p-4 space-y-3"}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">
          {duzenlenen ? "Üretim kaydını düzenle" : "Günlük üretim girişi"}
        </h3>
        {duzenlenen && (
          <button type="button" onClick={iptal} className="text-xs text-neutral-500 hover:underline">
            ＋ yeni kayıt
          </button>
        )}
      </div>
      <input type="hidden" name="kayit_id" value={duzenlenen?.id ?? ""} />

      <div className="grid sm:grid-cols-4 gap-2">
        <A e="Üretim tarihi *">
          <input name="tarih" type="date" required defaultValue={duzenlenen?.tarih ?? bugun} className={gir + " w-full"} />
        </A>
        <A e="Tesis / Fabrika">
          <select name="tesis" defaultValue={duzenlenen?.tesis ?? ""} className={gir + " w-full"}>
            <option value="">—</option>
            {tesisler.map((t) => <option key={t.id} value={t.ad}>{t.ad}</option>)}
          </select>
        </A>
        <A e="Üretim hattı">
          <select name="hat" defaultValue={duzenlenen?.hat ?? ""} className={gir + " w-full"}>
            <option value="">—</option>
            {hatlar.map((t) => <option key={t.id} value={t.ad}>{t.ad}</option>)}
          </select>
        </A>
        <A e="Vardiya">
          <select name="vardiya" defaultValue={duzenlenen?.vardiya ?? ""} className={gir + " w-full"}>
            <option value="">—</option>
            {vardiyalar.map((t) => <option key={t.id} value={t.ad}>{t.ad}</option>)}
          </select>
        </A>
      </div>

      <div className="grid sm:grid-cols-4 gap-2">
        <A e="Ürün *">
          <select
            name="urun_id"
            required
            value={urunId}
            onChange={(e) => setUrunId(e.target.value)}
            className={gir + " w-full sm:col-span-2"}
          >
            {urunler.map((u) => (
              <option key={u.id} value={u.id}>
                {u.kod} — {u.ad}{u.ambalaj_tipi ? ` (${u.ambalaj_tipi})` : ""}
              </option>
            ))}
          </select>
        </A>
        <A e="Üretilen miktar *">
          <input
            name="miktar"
            required
            inputMode="decimal"
            value={miktar}
            onChange={(e) => setMiktar(e.target.value)}
            className={gir + " w-full"}
          />
        </A>
        <A e="Ölçü birimi">
          <select name="olcu_birimi" value={olcu} onChange={(e) => setOlcu(e.target.value)} className={gir + " w-full"}>
            {OLCU_BIRIMLERI.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </A>
        <div className="flex items-end pb-1.5">
          <span className="text-sm">
            {miktar ? (
              onizlemeKg == null ? (
                <span className="text-amber-600 text-xs">⚠ kg&apos;a çevrilemiyor</span>
              ) : (
                <span className="font-medium">= {kgYaz(onizlemeKg)}</span>
              )
            ) : null}
          </span>
        </div>
      </div>

      {miktar && onizlemeKg == null && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          {urun && !urun.birim_agirlik_kg
            ? `"${urun.ad}" ürününde birim ağırlık tanımlı değil.`
            : olcu !== "Kg" && urun && !urun.koli_adedi
            ? `"${urun.ad}" ürününde koli adedi tanımlı değil; ${olcu} cinsinden giriş çevrilemiyor.`
            : "Çevrim için ürün tanımı eksik."}{" "}
          Kayıt yine tutulur ama toplamlara girmez.
        </p>
      )}

      <div className="grid sm:grid-cols-4 gap-2">
        <A e="Parti (Lot) no"><input name="parti_no" defaultValue={duzenlenen?.parti_no ?? ""} className={gir + " w-full"} /></A>
        <A e="Son kullanma tarihi"><input name="skt" type="date" defaultValue={duzenlenen?.skt ?? ""} className={gir + " w-full"} /></A>
        <A e="Operatör / personel"><input name="operator" defaultValue={duzenlenen?.operator ?? ""} className={gir + " w-full"} /></A>
        <A e="Açıklama"><input name="aciklama" defaultValue={duzenlenen?.aciklama ?? ""} className={gir + " w-full"} /></A>
      </div>

      <button type="submit" disabled={pending} className={btn}>
        {pending ? "Kaydediliyor…" : duzenlenen ? "Güncelle" : "Üretimi kaydet"}
      </button>
    </form>
  );
}

// ─── Excel'den toplu aktarma ──────────────────────────────────────────────

function TopluAktarma({ urunler }: { urunler: Urun[] }) {
  const [durum, setDurum] = useState<string>("");
  const [atlanan, setAtlanan] = useState<{ satir: number; sebep: string }[]>([]);
  const [calisiyor, setCalisiyor] = useState(false);

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setCalisiyor(true);
    setDurum("Dosya okunuyor…");
    setAtlanan([]);

    try {
      const XLSX = await import("xlsx");
      const veri = new Uint8Array(await dosya.arrayBuffer());
      const kitap = XLSX.read(veri, { type: "array", cellDates: true });
      const sayfa = kitap.Sheets[kitap.SheetNames[0]];
      const satirlar = XLSX.utils.sheet_to_json<Record<string, unknown>>(sayfa, { defval: "" });

      if (!satirlar.length) {
        setDurum("Dosyada satır bulunamadı.");
        return;
      }

      const cevrilmis: AktarSatir[] = satirlar.map((ham) => {
        const s: Record<string, string> = {};
        for (const [baslik, deger] of Object.entries(ham)) {
          const alan = basligiTani(baslik);
          if (!alan) continue;
          s[alan] =
            deger instanceof Date
              ? deger.toISOString().slice(0, 10)
              : String(deger ?? "").trim();
        }
        return s as AktarSatir;
      });

      setDurum(`${cevrilmis.length} satır gönderiliyor…`);
      const sonuc = await topluAktar(cevrilmis);

      if (sonuc.hata) {
        setDurum("Hata: " + sonuc.hata);
      } else {
        setAtlanan(sonuc.atlanan);
        setDurum(
          `${sonuc.eklenen} kayıt eklendi` +
            (sonuc.atlanan.length ? `, ${sonuc.atlanan.length} satır atlandı.` : "."),
        );
      }
    } catch (hata) {
      setDurum("Dosya okunamadı: " + (hata instanceof Error ? hata.message : String(hata)));
    } finally {
      setCalisiyor(false);
      e.target.value = "";
    }
  }

  return (
    <div className={kart + " p-4 space-y-2"}>
      <h3 className="font-medium text-sm">Excel&apos;den toplu aktarma</h3>
      <p className="text-xs text-neutral-500">
        İlk satır başlık olmalı. Tanınan başlıklar: Üretim Tarihi, Tesis/Fabrika, Hat, Vardiya,
        Ürün Kodu, Ürün Adı, Ambalaj Tipi, Miktar, Ölçü Birimi, Parti/Lot No, SKT, Operatör,
        Açıklama. Ürün, <b>kodu veya adıyla</b> tanımlı ürünlerle eşleştirilir; eşleşmeyen satır
        atlanır ve gerekçesi aşağıda listelenir.
      </p>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={dosyaSecildi}
        disabled={calisiyor}
        className="text-sm"
      />
      {durum && <p className="text-sm">{durum}</p>}
      {atlanan.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 max-h-48 overflow-y-auto">
          <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
            Atlanan satırlar
          </div>
          <ul className="text-xs space-y-0.5 text-amber-800 dark:text-amber-300">
            {atlanan.slice(0, 50).map((a) => (
              <li key={a.satir}>Satır {a.satir}: {a.sebep}</li>
            ))}
            {atlanan.length > 50 && <li>… ve {atlanan.length - 50} satır daha</li>}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-neutral-400">
        Tanımlı ürün sayısı: {urunler.length}
      </p>
    </div>
  );
}

// ─── Ortak görseller ──────────────────────────────────────────────────────

function Dagilim({ baslik, veri, limit = 10 }: { baslik: string; veri: Kirilim[]; limit?: number }) {
  const satirlar = veri.slice(0, limit);
  const enBuyuk = satirlar[0]?.kg || 1;
  if (!satirlar.length) return null;

  return (
    <div className={kart + " p-4"}>
      <h3 className="text-sm font-semibold mb-3">{baslik}</h3>
      <ul className="space-y-1.5">
        {satirlar.map((s) => (
          <li key={s.anahtar} className="text-sm">
            <div className="flex justify-between gap-2 mb-0.5">
              <span className="truncate min-w-0">{s.anahtar}</span>
              <span className="text-neutral-500 shrink-0">{kgYaz(s.kg)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div className="h-full bg-neutral-900 dark:bg-neutral-100" style={{ width: `${(s.kg / enBuyuk) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Trend({ veri }: { veri: { etiket: string; deger: number }[] }) {
  const enBuyuk = Math.max(1, ...veri.map((v) => v.deger));
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 min-w-max h-32">
        {veri.map((v) => (
          <div key={v.etiket} className="flex flex-col items-center gap-1 w-10">
            <div className="flex items-end h-24 w-full justify-center">
              <div
                className="w-5 rounded-t bg-neutral-800 dark:bg-neutral-200"
                style={{ height: `${(v.deger / enBuyuk) * 100}%` }}
                title={kgYaz(v.deger)}
              />
            </div>
            <span className="text-[9px] text-neutral-400">{v.etiket}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
