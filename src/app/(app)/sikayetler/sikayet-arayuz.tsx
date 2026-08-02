"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  sikayetKaydet, durumDegistir, hareketEkle, atamaDegistir, sikayetSil,
} from "./actions";
import {
  KANALLAR, BASVURAN_TURLERI, KATEGORILER, DURUMLAR, ONCELIKLER, DEPARTMANLAR,
  HAREKET_TURLERI, DURUM_ETIKET, DURUM_RENK, ONCELIK_ETIKET, ONCELIK_RENK,
  HAREKET_ETIKET, HAREKET_SIMGE, sikayetOzeti, tekrarlayanlar, sikayetCsv,
  gecikmisMi, cozumSuresi, acikMi, type Sikayet,
} from "@/lib/sikayet";
import type { Dosya } from "@/lib/dosya";
import { DosyaEkleri } from "@/components/dosya-ekleri";

const gir =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const kart =
  "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900";
const btn =
  "rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3.5 py-1.5 text-sm font-medium disabled:opacity-60";
const btnSade =
  "rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm disabled:opacity-60";

export interface Hareket {
  id: string;
  sikayet_id: string;
  tur: string;
  eski_durum: string | null;
  yeni_durum: string | null;
  metin: string;
  kaydeden_id: string | null;
  created_at: string;
}

type Gorunum = "liste" | "kanban" | "panel";

function tarihYaz(t: string | null | undefined): string {
  if (!t) return "";
  const [y, a, g] = t.slice(0, 10).split("-");
  return g && a && y ? `${g}.${a}.${y}` : t;
}

export function SikayetArayuz({
  sikayetler, hareketler, atamalar, dosyalar, subeler, kisiler, benId, yonetimMi, bugun, tabloYok,
}: {
  sikayetler: Sikayet[];
  hareketler: Hareket[];
  atamalar: { sikayet_id: string; profil_id: string }[];
  dosyalar: Dosya[];
  subeler: { id: string; ad: string }[];
  kisiler: { id: string; ad_soyad: string }[];
  benId: string;
  yonetimMi: boolean;
  bugun: string;
  tabloYok: boolean;
}) {
  const [gorunum, setGorunum] = useState<Gorunum>("panel");
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Sikayet | null>(null);

  // Filtreler
  const [q, setQ] = useState("");
  const [fDurum, setFDurum] = useState("");
  const [fKategori, setFKategori] = useState("");
  const [fSube, setFSube] = useState("");
  const [fOncelik, setFOncelik] = useState("");
  const [fKanal, setFKanal] = useState("");
  const [fAtanan, setFAtanan] = useState("");
  const [fBas, setFBas] = useState("");
  const [fBit, setFBit] = useState("");
  const [sadeceGeciken, setSadeceGeciken] = useState(false);

  const [d1, a1, p1] = useActionState(sikayetKaydet, null);
  const [d2, a2, p2] = useActionState(durumDegistir, null);
  const [d3, a3, p3] = useActionState(hareketEkle, null);
  const [d4, a4, p4] = useActionState(atamaDegistir, null);
  const [d5, a5, p5] = useActionState(sikayetSil, null);
  const durum = d1 ?? d2 ?? d3 ?? d4 ?? d5;

  const subeAdlari = useMemo(() => new Map(subeler.map((s) => [s.id, s.ad])), [subeler]);
  const kisiAdlari = useMemo(
    () => new Map(kisiler.map((k) => [k.id, k.ad_soyad || "(adsız)"])),
    [kisiler],
  );
  const atamaHaritasi = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of atamalar) {
      if (!m.has(a.sikayet_id)) m.set(a.sikayet_id, []);
      m.get(a.sikayet_id)!.push(a.profil_id);
    }
    return m;
  }, [atamalar]);

  const listelenen = useMemo(() => {
    const ara = q.trim().toLocaleLowerCase("tr");
    return sikayetler.filter((s) => {
      if (fDurum && s.durum !== fDurum) return false;
      if (fKategori && s.kategori !== fKategori) return false;
      if (fSube && s.sube_id !== fSube) return false;
      if (fOncelik && s.oncelik !== fOncelik) return false;
      if (fKanal && s.kanal !== fKanal) return false;
      if (fBas && s.basvuru_tarihi < fBas) return false;
      if (fBit && s.basvuru_tarihi > fBit) return false;
      if (sadeceGeciken && !gecikmisMi(s, bugun)) return false;
      if (fAtanan && !(atamaHaritasi.get(s.id) ?? []).includes(fAtanan)) return false;
      if (!ara) return true;
      return [
        s.sikayet_no, s.ad_soyad, s.firma, s.telefon, s.eposta, s.urun, s.aciklama,
        s.sube_id ? subeAdlari.get(s.sube_id) : "",
      ].some((x) => (x ?? "").toLocaleLowerCase("tr").includes(ara));
    });
  }, [sikayetler, q, fDurum, fKategori, fSube, fOncelik, fKanal, fAtanan, fBas, fBit, sadeceGeciken, bugun, atamaHaritasi, subeAdlari]);

  const ozet = useMemo(() => sikayetOzeti(listelenen, bugun), [listelenen, bugun]);
  const tekrar = useMemo(() => tekrarlayanlar(listelenen, subeAdlari), [listelenen, subeAdlari]);
  const secili = useMemo(
    () => sikayetler.find((s) => s.id === seciliId) ?? null,
    [sikayetler, seciliId],
  );

  function csvIndir() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([sikayetCsv(listelenen, subeAdlari)], { type: "text/csv;charset=utf-8" }),
    );
    a.download = `sikayetler-${bugun}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function filtreleriTemizle() {
    setQ(""); setFDurum(""); setFKategori(""); setFSube(""); setFOncelik("");
    setFKanal(""); setFAtanan(""); setFBas(""); setFBit(""); setSadeceGeciken(false);
  }

  const filtreVar =
    q || fDurum || fKategori || fSube || fOncelik || fKanal || fAtanan || fBas || fBit || sadeceGeciken;

  return (
    <div className="space-y-4">
      {tabloYok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          <b>Şikayet tabloları henüz oluşturulmamış.</b> Ekranın çalışması için{" "}
          <code className="text-xs">0012_sikayet.sql</code> Supabase&apos;de çalıştırılmalı.
        </div>
      )}

      {/* ── Üst çubuk ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden">
          {(["panel", "liste", "kanban"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGorunum(g)}
              className={`px-3 py-1.5 text-sm ${
                gorunum === g
                  ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              {g === "panel" ? "📊 Panel" : g === "liste" ? "📋 Liste" : "🗂️ Kanban"}
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="No, ad, telefon, ürün, açıklama ara…"
          className={gir + " flex-1 min-w-48"}
        />
        <button type="button" onClick={csvIndir} className={btnSade}>⬇ Excel (CSV)</button>
        <button
          type="button"
          onClick={() => { setDuzenlenen(null); setFormAcik((v) => !v); }}
          className={btn}
        >
          {formAcik && !duzenlenen ? "Vazgeç" : "＋ Şikayet kaydet"}
        </button>
      </div>

      {/* ── Filtreler ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={fDurum} onChange={(e) => setFDurum(e.target.value)} className={gir}>
          <option value="">Tüm durumlar</option>
          {DURUMLAR.map((d) => <option key={d} value={d}>{DURUM_ETIKET[d]}</option>)}
        </select>
        <select value={fKategori} onChange={(e) => setFKategori(e.target.value)} className={gir}>
          <option value="">Tüm kategoriler</option>
          {KATEGORILER.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={fSube} onChange={(e) => setFSube(e.target.value)} className={gir}>
          <option value="">Tüm şubeler</option>
          {subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>
        <select value={fOncelik} onChange={(e) => setFOncelik(e.target.value)} className={gir}>
          <option value="">Tüm öncelikler</option>
          {ONCELIKLER.map((o) => <option key={o} value={o}>{ONCELIK_ETIKET[o]}</option>)}
        </select>
        <select value={fKanal} onChange={(e) => setFKanal(e.target.value)} className={gir}>
          <option value="">Tüm kanallar</option>
          {KANALLAR.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={fAtanan} onChange={(e) => setFAtanan(e.target.value)} className={gir}>
          <option value="">Herkes</option>
          {kisiler.map((k) => <option key={k.id} value={k.id}>{k.ad_soyad}</option>)}
        </select>
        <input type="date" value={fBas} onChange={(e) => setFBas(e.target.value)} className={gir} title="Başlangıç" />
        <input type="date" value={fBit} onChange={(e) => setFBit(e.target.value)} className={gir} title="Bitiş" />
        <label className="flex items-center gap-1.5 text-sm text-neutral-500">
          <input type="checkbox" checked={sadeceGeciken} onChange={(e) => setSadeceGeciken(e.target.checked)} />
          Yalnızca geciken
        </label>
        {filtreVar && (
          <button type="button" onClick={filtreleriTemizle} className="text-xs text-neutral-500 hover:underline">
            filtreleri temizle ({listelenen.length}/{sikayetler.length})
          </button>
        )}
      </div>

      {durum?.ok && <p className="text-sm text-emerald-600">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600">{durum.hata}</p>}

      {/* ── Kayıt formu ───────────────────────────────────────────── */}
      {(formAcik || duzenlenen) && (
        <form key={duzenlenen?.id ?? "yeni"} action={a1} className={kart + " p-4 space-y-3"}>
          <h3 className="font-medium text-sm">
            {duzenlenen ? `${duzenlenen.sikayet_no} — düzenle` : "Yeni şikayet kaydı"}
          </h3>
          <input type="hidden" name="sikayet_id" value={duzenlenen?.id ?? ""} />

          <div className="grid sm:grid-cols-4 gap-2">
            <Alan e="Başvuru tarihi">
              <input name="basvuru_tarihi" type="date" defaultValue={duzenlenen?.basvuru_tarihi ?? bugun} className={gir + " w-full"} />
            </Alan>
            <Alan e="Kanal">
              <select name="kanal" defaultValue={duzenlenen?.kanal ?? "Telefon"} className={gir + " w-full"}>
                {KANALLAR.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Alan>
            <Alan e="Başvuran türü">
              <select name="basvuran_turu" defaultValue={duzenlenen?.basvuran_turu ?? "Müşteri"} className={gir + " w-full"}>
                {BASVURAN_TURLERI.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Alan>
            <Alan e="Öncelik">
              <select name="oncelik" defaultValue={duzenlenen?.oncelik ?? "orta"} className={gir + " w-full"}>
                {ONCELIKLER.map((o) => <option key={o} value={o}>{ONCELIK_ETIKET[o]}</option>)}
              </select>
            </Alan>
          </div>

          <div className="grid sm:grid-cols-4 gap-2">
            <Alan e="Ad Soyad"><input name="ad_soyad" defaultValue={duzenlenen?.ad_soyad ?? ""} className={gir + " w-full"} /></Alan>
            <Alan e="Firma"><input name="firma" defaultValue={duzenlenen?.firma ?? ""} className={gir + " w-full"} /></Alan>
            <Alan e="Telefon"><input name="telefon" defaultValue={duzenlenen?.telefon ?? ""} className={gir + " w-full"} /></Alan>
            <Alan e="E-posta"><input name="eposta" type="email" defaultValue={duzenlenen?.eposta ?? ""} className={gir + " w-full"} /></Alan>
          </div>

          <div className="grid sm:grid-cols-4 gap-2">
            <Alan e="İlgili şube">
              <select name="sube_id" defaultValue={duzenlenen?.sube_id ?? ""} className={gir + " w-full"}>
                <option value="">— şube yok / genel —</option>
                {subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
              </select>
            </Alan>
            <Alan e="Ürün / Hizmet"><input name="urun" defaultValue={duzenlenen?.urun ?? ""} className={gir + " w-full"} /></Alan>
            <Alan e="Kategori">
              <select name="kategori" defaultValue={duzenlenen?.kategori ?? "Diğer"} className={gir + " w-full"}>
                {KATEGORILER.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Alan>
            <Alan e="Departman">
              <select name="departman" defaultValue={duzenlenen?.departman ?? ""} className={gir + " w-full"}>
                <option value="">—</option>
                {DEPARTMANLAR.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Alan>
          </div>

          <Alan e="Şikayet açıklaması *">
            <textarea name="aciklama" rows={3} required defaultValue={duzenlenen?.aciklama ?? ""} className={gir + " w-full"} />
          </Alan>

          <Alan e="Son çözüm tarihi (SLA hedefi)">
            <input name="son_cozum_tarihi" type="date" defaultValue={duzenlenen?.son_cozum_tarihi ?? ""} className={gir} />
          </Alan>

          <div className="flex items-center gap-2">
            <button type="submit" disabled={p1} className={btn}>
              {duzenlenen ? "Güncelle" : "Kaydet"}
            </button>
            <button type="button" onClick={() => { setFormAcik(false); setDuzenlenen(null); }} className={btnSade}>
              Vazgeç
            </button>
          </div>
          <p className="text-[11px] text-neutral-400">
            Dosya ve görselleri kaydettikten sonra, kaydın kartından ekleyebilirsiniz.
          </p>
        </form>
      )}

      {/* ── Görünümler ────────────────────────────────────────────── */}
      {gorunum === "panel" && <Panel ozet={ozet} tekrar={tekrar} subeAdlari={subeAdlari} />}

      {gorunum === "liste" && (
        <div className={kart + " overflow-hidden"}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-xs text-neutral-500">
                <tr>
                  {["No", "Tarih", "Başvuran", "Şube", "Kategori", "Öncelik", "Durum", "Görevli", "SLA"].map((b) => (
                    <th key={b} className="text-left font-medium px-3 py-2 whitespace-nowrap">{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listelenen.map((s) => {
                  const gecik = gecikmisMi(s, bugun);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSeciliId(s.id)}
                      className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{s.sikayet_no}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-neutral-500">{tarihYaz(s.basvuru_tarihi)}</td>
                      <td className="px-3 py-2">{s.ad_soyad || s.firma || "—"}</td>
                      <td className="px-3 py-2 text-neutral-500">{s.sube_id ? subeAdlari.get(s.sube_id) : "—"}</td>
                      <td className="px-3 py-2 text-neutral-500">{s.kategori}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span style={{ color: ONCELIK_RENK[s.oncelik] }}>●</span>{" "}
                        <span className="text-xs">{ONCELIK_ETIKET[s.oncelik]}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: DURUM_RENK[s.durum] }}
                        >
                          {DURUM_ETIKET[s.durum]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-500">
                        {(atamaHaritasi.get(s.id) ?? []).map((p) => kisiAdlari.get(p)).filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {gecik ? (
                          <span className="text-red-600 font-medium">⚠ gecikti</span>
                        ) : s.son_cozum_tarihi ? (
                          <span className="text-neutral-400">{tarihYaz(s.son_cozum_tarihi)}</span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!listelenen.length && (
            <div className="px-3 py-10 text-center text-sm text-neutral-400">
              {sikayetler.length ? "Filtreye uyan kayıt yok." : "Henüz şikayet kaydı yok."}
            </div>
          )}
        </div>
      )}

      {gorunum === "kanban" && (
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-2">
            {DURUMLAR.map((d) => {
              const sutun = listelenen.filter((s) => s.durum === d);
              return (
                <div key={d} className="w-64 shrink-0">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DURUM_RENK[d] }} />
                    <span className="text-xs font-medium">{DURUM_ETIKET[d]}</span>
                    <span className="text-xs text-neutral-400 ml-auto">{sutun.length}</span>
                  </div>
                  <div className="space-y-2">
                    {sutun.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSeciliId(s.id)}
                        className={kart + " p-3 w-full text-left hover:border-neutral-400 dark:hover:border-neutral-600"}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span style={{ color: ONCELIK_RENK[s.oncelik] }}>●</span>
                          <span className="font-mono text-[10px] text-neutral-400">{s.sikayet_no}</span>
                          {gecikmisMi(s, bugun) && <span className="text-[10px] text-red-600 ml-auto">⚠</span>}
                        </div>
                        <div className="text-sm font-medium truncate">{s.ad_soyad || s.firma || "—"}</div>
                        <div className="text-[11px] text-neutral-500 truncate">{s.kategori}</div>
                        {s.sube_id && (
                          <div className="text-[11px] text-neutral-400 truncate">{subeAdlari.get(s.sube_id)}</div>
                        )}
                      </button>
                    ))}
                    {!sutun.length && (
                      <div className="text-center text-xs text-neutral-300 py-4">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Kayıt kartı ───────────────────────────────────────────── */}
      {secili && (
        <SikayetKarti
          s={secili}
          hareketler={hareketler.filter((h) => h.sikayet_id === secili.id)}
          ekler={dosyalar.filter((d) => d.kayit_id === secili.id)}
          atananlar={atamaHaritasi.get(secili.id) ?? []}
          kisiler={kisiler}
          kisiAdlari={kisiAdlari}
          subeAdlari={subeAdlari}
          bugun={bugun}
          benId={benId}
          yonetimMi={yonetimMi}
          kapat={() => setSeciliId(null)}
          duzenle={() => { setDuzenlenen(secili); setSeciliId(null); setFormAcik(true); }}
          eylemler={{ a2, p2, a3, p3, a4, p4, a5, p5 }}
        />
      )}
    </div>
  );
}

function Alan({ e, children }: { e: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{e}</span>
      {children}
    </label>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────

function Panel({
  ozet, tekrar, subeAdlari,
}: {
  ozet: ReturnType<typeof sikayetOzeti>;
  tekrar: { etiket: string; kategori: string; adet: number }[];
  subeAdlari: Map<string, string>;
}) {
  const kutular = [
    { s: ozet.acik, e: "Açık şikayet" },
    { s: ozet.kapali, e: "Kapanan" },
    { s: ozet.ortalamaCozumGun == null ? "—" : `${ozet.ortalamaCozumGun} gün`, e: "Ort. çözüm süresi" },
    { s: ozet.geciken, e: "Süresi geçen", r: ozet.geciken ? "#dc2626" : undefined },
    { s: ozet.kritik, e: "Açık kritik", r: ozet.kritik ? "#dc2626" : undefined },
    { s: ozet.slaBasari == null ? "—" : `%${ozet.slaBasari}`, e: "SLA başarısı" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {kutular.map((k) => (
          <div key={k.e} className={kart + " p-3 text-center"}>
            <div className="text-lg font-extrabold" style={{ color: k.r }}>{k.s}</div>
            <div className="text-[10px] text-neutral-500">{k.e}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        <Dagilim baslik="Kategori bazında" veri={ozet.kategoriSayim} />
        <Dagilim baslik="Kanal bazında" veri={ozet.kanalSayim} />
        <Dagilim baslik="Departman bazında" veri={ozet.departmanSayim} />
        <Dagilim
          baslik="En çok şikayet alan şubeler"
          veri={ozet.subeSayim}
          etiketle={(k) => subeAdlari.get(k) ?? "(bilinmeyen)"}
          limit={8}
        />
        <Dagilim baslik="En çok şikayet alan ürünler" veri={ozet.urunSayim} limit={8} />
        <Dagilim baslik="Durum dağılımı" veri={ozet.durumSayim} etiketle={(k) => DURUM_ETIKET[k] ?? k} />
      </div>

      {ozet.aylikTrend.length > 0 && (
        <div className={kart + " p-4"}>
          <h3 className="text-sm font-semibold mb-3">Aylık trend</h3>
          <Trend veri={ozet.aylikTrend} />
        </div>
      )}

      {tekrar.length > 0 && (
        <div className={kart + " p-4"}>
          <h3 className="text-sm font-semibold mb-1">Tekrarlayan şikayetler</h3>
          <p className="text-xs text-neutral-500 mb-3">
            Aynı şubede aynı kategoriden birden fazla kayıt — kök neden aranması gereken yerler.
          </p>
          <ul className="space-y-1 text-sm">
            {tekrar.slice(0, 12).map((t) => (
              <li key={t.etiket + t.kategori} className="flex gap-2">
                <span className="font-medium w-8 text-right">{t.adet}×</span>
                <span className="flex-1 min-w-0 truncate">{t.etiket}</span>
                <span className="text-neutral-500 text-xs">{t.kategori}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!ozet.toplam && (
        <div className={kart + " text-center text-sm text-neutral-400 py-10"}>
          Gösterilecek kayıt yok.
        </div>
      )}
    </div>
  );
}

function Dagilim({
  baslik, veri, etiketle, limit = 10,
}: {
  baslik: string;
  veri: Map<string, number>;
  etiketle?: (k: string) => string;
  limit?: number;
}) {
  const satirlar = [...veri.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const enBuyuk = satirlar[0]?.[1] ?? 1;
  if (!satirlar.length) return null;

  return (
    <div className={kart + " p-4"}>
      <h3 className="text-sm font-semibold mb-3">{baslik}</h3>
      <ul className="space-y-1.5">
        {satirlar.map(([k, v]) => (
          <li key={k} className="text-sm">
            <div className="flex justify-between gap-2 mb-0.5">
              <span className="truncate min-w-0">{etiketle ? etiketle(k) : k}</span>
              <span className="text-neutral-500 shrink-0">{v}</span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-neutral-900 dark:bg-neutral-100"
                style={{ width: `${(v / enBuyuk) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Trend({ veri }: { veri: { ay: string; acilan: number; kapanan: number }[] }) {
  const enBuyuk = Math.max(1, ...veri.map((v) => Math.max(v.acilan, v.kapanan)));
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-3 min-w-max h-32">
        {veri.map((v) => (
          <div key={v.ay} className="flex flex-col items-center gap-1 w-14">
            <div className="flex items-end gap-0.5 h-24">
              <div
                className="w-4 rounded-t bg-neutral-800 dark:bg-neutral-200"
                style={{ height: `${(v.acilan / enBuyuk) * 100}%` }}
                title={`${v.acilan} açılan`}
              />
              <div
                className="w-4 rounded-t bg-emerald-500"
                style={{ height: `${(v.kapanan / enBuyuk) * 100}%` }}
                title={`${v.kapanan} kapanan`}
              />
            </div>
            <span className="text-[10px] text-neutral-400">{v.ay.slice(5)}.{v.ay.slice(2, 4)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-neutral-800 dark:bg-neutral-200" /> açılan
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> kapanan
        </span>
      </div>
    </div>
  );
}

// ─── Kayıt kartı ──────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function SikayetKarti({
  s, hareketler, ekler, atananlar, kisiler, kisiAdlari, subeAdlari, bugun, yonetimMi,
  kapat, duzenle, eylemler,
}: {
  s: Sikayet;
  hareketler: Hareket[];
  ekler: Dosya[];
  atananlar: string[];
  kisiler: { id: string; ad_soyad: string }[];
  kisiAdlari: Map<string, string>;
  subeAdlari: Map<string, string>;
  bugun: string;
  benId: string;
  yonetimMi: boolean;
  kapat: () => void;
  duzenle: () => void;
  eylemler: Record<string, any>;
}) {
  const { a2, p2, a3, p3, a4, p4, a5, p5 } = eylemler;
  const sure = cozumSuresi(s);
  const gecik = gecikmisMi(s, bugun);
  const sirali = [...hareketler].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className={kart + " p-5 space-y-4 ring-2 ring-neutral-900/10 dark:ring-neutral-100/10"}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-sm text-neutral-500">{s.sikayet_no}</span>
            <span className="font-medium text-[15px]">{s.ad_soyad || s.firma || "—"}</span>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: DURUM_RENK[s.durum] }}
            >
              {DURUM_ETIKET[s.durum]}
            </span>
            <span className="text-xs" style={{ color: ONCELIK_RENK[s.oncelik] }}>
              ● {ONCELIK_ETIKET[s.oncelik]}
            </span>
            {gecik && <span className="text-xs text-red-600 font-medium">⚠ süresi geçti</span>}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {tarihYaz(s.basvuru_tarihi)} · {s.kanal} · {s.basvuran_turu} · {s.kategori}
            {s.sube_id ? ` · ${subeAdlari.get(s.sube_id)}` : ""}
            {s.urun ? ` · ${s.urun}` : ""}
            {sure != null ? ` · ${sure} günde çözüldü` : ""}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={duzenle} className={btnSade}>Düzenle</button>
          <button type="button" onClick={kapat} className={btnSade}>Kapat</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Şikayet</h4>
            <p className="text-sm whitespace-pre-line">{s.aciklama}</p>
          </div>

          {(s.telefon || s.eposta) && (
            <div className="text-sm space-y-0.5">
              {s.telefon && (
                <div><span className="text-neutral-500 text-xs">Telefon </span>
                  <a href={`tel:${s.telefon}`} className="hover:underline">{s.telefon}</a></div>
              )}
              {s.eposta && (
                <div><span className="text-neutral-500 text-xs">E-posta </span>
                  <a href={`mailto:${s.eposta}`} className="hover:underline break-all">{s.eposta}</a></div>
              )}
            </div>
          )}

          {s.sube_id && (
            <Link href={`/subeler/${s.sube_id}`} className="text-sm text-neutral-500 hover:underline inline-block">
              🏪 Şube kartına git →
            </Link>
          )}

          <DosyaEkleri kapsam="sikayet" kayitId={s.id} dosyalar={ekler} baslik="Dosya ve görseller" />

          {s.cozum_notu && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">Çözüm notu</div>
              <p className="text-sm whitespace-pre-line">{s.cozum_notu}</p>
            </div>
          )}
          {s.kok_neden && (
            <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-3 py-2">
              <div className="text-xs font-semibold text-neutral-500 mb-0.5">Kök neden</div>
              <p className="text-sm whitespace-pre-line">{s.kok_neden}</p>
            </div>
          )}

          {/* Görevlendirme */}
          <div>
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Görevliler</h4>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {atananlar.length ? atananlar.map((p) => (
                <form key={p} action={a4} className="inline">
                  <input type="hidden" name="sikayet_id" value={s.id} />
                  <input type="hidden" name="profil_id" value={p} />
                  <input type="hidden" name="kaldir" value="1" />
                  <button
                    type="submit"
                    disabled={p4}
                    title="Görevlendirmeyi kaldır"
                    className="text-xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:line-through"
                  >
                    {kisiAdlari.get(p) ?? "—"} ✕
                  </button>
                </form>
              )) : <span className="text-sm text-neutral-400">Henüz görevli yok.</span>}
            </div>
            <form action={a4} className="flex items-center gap-2">
              <input type="hidden" name="sikayet_id" value={s.id} />
              <select name="profil_id" defaultValue="" required className={gir}>
                <option value="" disabled>Kişi seçin…</option>
                {kisiler.filter((k) => !atananlar.includes(k.id)).map((k) => (
                  <option key={k.id} value={k.id}>{k.ad_soyad}</option>
                ))}
              </select>
              <button type="submit" disabled={p4} className={btnSade}>Görevlendir</button>
            </form>
          </div>

          {/* Durum */}
          <form action={a2} className="space-y-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-3">
            <input type="hidden" name="sikayet_id" value={s.id} />
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Durum değiştir</h4>
            <select name="durum" defaultValue={s.durum} className={gir + " w-full"}>
              {DURUMLAR.map((d) => <option key={d} value={d}>{DURUM_ETIKET[d]}</option>)}
            </select>
            <textarea name="cozum_notu" rows={2} defaultValue={s.cozum_notu}
              placeholder="Çözüm notu (Çözüldü/Kapatıldı için zorunlu)" className={gir + " w-full"} />
            <input name="kok_neden" defaultValue={s.kok_neden} placeholder="Kök neden" className={gir + " w-full"} />
            <button type="submit" disabled={p2} className={btn}>Kaydet</button>
          </form>
        </div>

        {/* İletişim geçmişi */}
        <div>
          <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            İletişim geçmişi
          </h4>

          <form action={a3} className="space-y-2 mb-3">
            <input type="hidden" name="sikayet_id" value={s.id} />
            <div className="flex gap-2">
              <select name="tur" defaultValue="gorusme" className={gir}>
                {HAREKET_TURLERI.map((t) => (
                  <option key={t} value={t}>{HAREKET_ETIKET[t]}</option>
                ))}
              </select>
              <button type="submit" disabled={p3} className={btnSade}>Ekle</button>
            </div>
            <textarea name="metin" rows={2} placeholder="Ne konuşuldu, ne yapıldı?" className={gir + " w-full"} />
          </form>

          <ol className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {sirali.map((h) => (
              <li key={h.id} className="flex gap-2 text-sm">
                <span className="shrink-0">{HAREKET_SIMGE[h.tur] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-neutral-400">
                    {new Date(h.created_at).toLocaleString("tr-TR", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                    {h.kaydeden_id ? ` · ${kisiAdlari.get(h.kaydeden_id) ?? ""}` : ""}
                    {` · ${HAREKET_ETIKET[h.tur] ?? h.tur}`}
                  </div>
                  {h.tur === "durum" ? (
                    <div>
                      {h.eski_durum ? (
                        <>
                          <span className="text-neutral-500">{DURUM_ETIKET[h.eski_durum]}</span>
                          {" → "}
                        </>
                      ) : null}
                      <span style={{ color: DURUM_RENK[h.yeni_durum ?? ""] }} className="font-medium">
                        {DURUM_ETIKET[h.yeni_durum ?? ""] ?? h.yeni_durum}
                      </span>
                      {h.metin ? <span className="text-neutral-500"> — {h.metin}</span> : null}
                    </div>
                  ) : (
                    <p className="whitespace-pre-line">{h.metin}</p>
                  )}
                </div>
              </li>
            ))}
            {!sirali.length && <li className="text-sm text-neutral-400">Henüz kayıt yok.</li>}
          </ol>
        </div>
      </div>

      {yonetimMi && (
        <form action={a5} className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <input type="hidden" name="sikayet_id" value={s.id} />
          <button type="submit" disabled={p5} className="text-sm text-red-600 hover:underline">
            🗑 Bu şikayeti sil
          </button>
        </form>
      )}
    </div>
  );
}
