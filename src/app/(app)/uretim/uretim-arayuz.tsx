"use client";

import { useActionState, useMemo, useState } from "react";
import {
  kayitKaydet, kayitSil, urunKaydet, urunSil, topluAktar, topluKayitSil,
  type AktarSatir,
} from "./actions";
import {
  uretimOzeti, uretimCsv, aylikCsv, kgYaz, adetYaz, miktarYaz, birimliYaz,
  kilogramaCevir, basligiTani, raporMiktari, raporBirimi, raporBolen,
  raporAciklama, urunHaritasi, kayitUrunu,
  OLCU_BIRIMLERI, AMBALAJ_BIRIMLERI, RAPOR_BIRIMLERI,
  type Urun, type UretimKaydi, type Kirilim, type UrunOzet,
  type AylikSatir, type SatisSatiri,
} from "@/lib/uretim";
import { excelTarihiCoz } from "@/lib/excel-tarih";
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

// Tesis / hat / vardiya kaldırıldı (Nezif: "bu yapıda gerek yok"), o yüzden
// "Tanımlar" sekmesi de yok — içinde sadece o üç liste vardı.
type Sekme = "panel" | "aylik" | "giris" | "kayitlar" | "urunler";

function tarihYaz(t: string | null | undefined): string {
  if (!t) return "";
  const [y, a, g] = t.slice(0, 10).split("-");
  return g && a && y ? `${g}.${a}.${y}` : t;
}

export function UretimArayuz({
  kayitlar, urunler, satislar, bugun, yazabilir, yonetimMi, tumSubeleriGorur, tabloYok,
}: {
  kayitlar: UretimKaydi[];
  urunler: Urun[];
  satislar: SatisSatiri[];
  bugun: string;
  yazabilir: boolean;
  yonetimMi: boolean;
  tumSubeleriGorur: boolean;
  tabloYok: boolean;
}) {
  const [sekme, setSekme] = useState<Sekme>("panel");
  const [duzenlenen, setDuzenlenen] = useState<UretimKaydi | null>(null);
  const [duzenlenenUrun, setDuzenlenenUrun] = useState<Urun | null>(null);

  // Toplu silme: seçili kayıt kimlikleri
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [siliniyor, setSiliniyor] = useState(false);
  const [silmeSonuc, setSilmeSonuc] = useState<string | null>(null);

  // Filtreler
  const [fBas, setFBas] = useState("");
  const [fBit, setFBit] = useState("");
  const [fUrun, setFUrun] = useState("");
  const [fGrup, setFGrup] = useState("");
  const [fAmbalaj, setFAmbalaj] = useState("");
  const [fParti, setFParti] = useState("");

  const [d1, a1, p1] = useActionState(kayitKaydet, null);
  const [d2, a2, p2] = useActionState(kayitSil, null);
  const [d3, a3, p3] = useActionState(urunKaydet, null);
  const [d4, a4, p4] = useActionState(urunSil, null);
  const durum = d1 ?? d2 ?? d3 ?? d4;

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
      if (parti && !k.parti_no.toLocaleLowerCase("tr").includes(parti)) return false;
      return true;
    });
  }, [kayitlar, fBas, fBit, fUrun, fGrup, fAmbalaj, fParti]);

  const ozet = useMemo(
    () => uretimOzeti(listelenen, urunler, bugun, satislar),
    [listelenen, urunler, bugun, satislar],
  );

  // Kayıtlar tablosunda her satırın kendi raporlama birimini yazabilmek için
  const uHarita = useMemo(() => urunHaritasi(urunler), [urunler]);

  const filtreVar = fBas || fBit || fUrun || fGrup || fAmbalaj || fParti;

  // ── Toplu silme ──────────────────────────────────────────────────────
  const seciliListede = listelenen.filter((k) => secili.has(k.id));

  function secimDegistir(id: string, isaretli: boolean) {
    setSecili((s) => {
      const y = new Set(s);
      if (isaretli) y.add(id);
      else y.delete(id);
      return y;
    });
  }

  async function seciliSil(hepsiMi: boolean) {
    const hedef = hepsiMi ? listelenen : seciliListede;
    if (!hedef.length) return;

    const soru = hepsiMi
      ? `Filtredeki ${hedef.length} kaydın TAMAMI silinecek. Emin misiniz?`
      : `Seçili ${hedef.length} kayıt silinecek. Emin misiniz?`;
    if (!window.confirm(soru + "\n\nSilinen kayıtlar silme günlüğüne yazılır, geri alınabilir.")) return;

    setSiliniyor(true);
    setSilmeSonuc(null);
    const sonuc = await topluKayitSil(hedef.map((k) => k.id));
    setSiliniyor(false);
    setSecili(new Set());
    setSilmeSonuc(
      sonuc.hata
        ? sonuc.hata
        : `${sonuc.silinen} kayıt silindi. Geri almak gerekirse silme günlüğünde duruyor.`,
    );
  }

  function indir(icerik: string, dosyaAdi: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([icerik], { type: "text/csv;charset=utf-8" }));
    a.download = dosyaAdi;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function csvIndir() {
    // Aylık sekmesindeyken aylık tablo, diğerlerinde ham kayıtlar insin —
    // kullanıcı ekranda ne görüyorsa onu indirmeyi bekliyor.
    if (sekme === "aylik") {
      indir(aylikCsv(ozet.aylik, ozet.urunOzetleri), `uretim-aylik-${bugun}.csv`);
    } else {
      indir(uretimCsv(listelenen, urunler), `uretim-${bugun}.csv`);
    }
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
            ["panel", "📊 Panel"], ["aylik", "🗓 Aylık & Satış"],
            ["giris", "✏️ Üretim Girişi"], ["kayitlar", "📋 Kayıtlar"],
            ["urunler", "📦 Ürünler"],
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
        {(sekme === "panel" || sekme === "aylik" || sekme === "kayitlar") && (
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
          <input value={fParti} onChange={(e) => setFParti(e.target.value)} placeholder="Parti no" className={gir + " w-28"} />
          {filtreVar && (
            <button
              type="button"
              onClick={() => { setFBas(""); setFBit(""); setFUrun(""); setFGrup(""); setFAmbalaj(""); setFParti(""); }}
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
          {/* Üstteki kartlar YALNIZCA kilogramla raporlanan ürünleri gösterir.
              Lavaşı paket, sosları adet raporlarken hepsini tek bir kg
              toplamında birleştirmek yanıltıcı olurdu — diğer ürünler
              aşağıda ve "Aylık & Satış" sekmesinde kendi biriminde duruyor. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { kg: ozet.bugunKg, e: "Bugünkü üretim" },
              { kg: ozet.buAyKg, e: "Bu ay" },
              { kg: ozet.toplamKg, e: "Seçili dönem toplamı" },
              {
                kg: ozet.gunlukOrtalamaKg ?? 0,
                e: `Günlük ortalama (${ozet.uretimGunuSayisi} gün)`,
              },
            ].map((x) => (
              <div key={x.e} className={kart + " p-3 text-center"}>
                <div className="text-base font-extrabold">{kgYaz(x.kg)}</div>
                <div className="text-[10px] text-neutral-500">{x.e}</div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-neutral-500">
            Yukarıdaki dört kutu yalnızca <b>kilogram olarak raporlanan</b> ürünleri
            toplar
            {ozet.kgUrunAdlari.length ? ` (${ozet.kgUrunAdlari.join(", ")})` : ""}. Lavaş
            paket, soslar paket/adet raporlandığı için aynı toplama katılmaz — hepsi
            aşağıdaki listede ve &quot;Aylık &amp; Satış&quot; sekmesinde kendi biriminde
            görünür.
          </p>

          {ozet.adetliKayitSayisi > 0 && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 text-sm text-neutral-600 dark:text-neutral-400">
              {ozet.adetliKayitSayisi} kaydın kilogram karşılığı hesaplanamıyor — bu
              ürünlerde birim ağırlık tanımlı değil. Raporlama birimi kilogram değilse
              sorun yok; kilogram da görmek isterseniz Ürünler sekmesinden birim ağırlık
              girin.
            </div>
          )}

          {ozet.gunluk.length > 0 && (
            <div className={kart + " p-4"}>
              <h3 className="text-sm font-semibold mb-1">Günlük üretim trendi</h3>
              <p className="text-[11px] text-neutral-500 mb-3">
                Kilogram bazlı ürünler
                {ozet.kgUrunAdlari.length ? `: ${ozet.kgUrunAdlari.join(", ")}` : ""}
              </p>
              <Trend veri={ozet.gunluk.slice(-30).map((g) => ({ etiket: g.tarih.slice(5), deger: g.kg }))} />
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-3">
            <UrunDagilimi veri={ozet.urunOzetleri} />
            <Dagilim
              baslik="Ürün grubu bazında"
              altBaslik="kilogram bazında — gruptaki ürünler farklı birimlerde raporlanabilir"
              veri={ozet.gruplar}
            />
            <Dagilim
              baslik="Ambalaj bazında"
              altBaslik="kilogram bazında"
              veri={ozet.ambalajlar}
            />
          </div>

          {!ozet.kayitSayisi && (
            <div className={kart + " text-center text-sm text-neutral-400 py-10"}>
              Henüz üretim kaydı yok. &quot;Üretim Girişi&quot; sekmesinden başlayın.
            </div>
          )}
        </div>
      )}

      {/* ── AYLIK & SATIŞ ─────────────────────────────────────────── */}
      {sekme === "aylik" && (
        <AylikTablo
          aylik={ozet.aylik}
          urunOzetleri={ozet.urunOzetleri}
          tumSubeleriGorur={tumSubeleriGorur}
        />
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
          <div className="px-3 py-2 text-xs border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center gap-2">
            <span className="text-neutral-500">{listelenen.length} kayıt</span>
            <span className="font-medium">
              {ozet.urunOzetleri
                .map((u) => `${u.ad}: ${birimliYaz(u.deger, u.birim)}`)
                .join("  ·  ") || "—"}
            </span>

            {yazabilir && listelenen.length > 0 && (
              <span className="ml-auto flex flex-wrap items-center gap-2 yazdirma-gizle">
                {seciliListede.length > 0 && (
                  <button
                    type="button"
                    onClick={() => seciliSil(false)}
                    disabled={siliniyor}
                    className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3 py-1 text-xs font-medium disabled:opacity-60"
                  >
                    🗑 Seçili {seciliListede.length} kaydı sil
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => seciliSil(true)}
                  disabled={siliniyor}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs disabled:opacity-60"
                  title="Filtreye uyan tüm kayıtları siler"
                >
                  {siliniyor ? "Siliniyor…" : `Filtredeki ${listelenen.length} kaydın tümünü sil`}
                </button>
              </span>
            )}
          </div>

          {silmeSonuc && (
            <div className="px-3 py-2 text-sm border-b border-neutral-100 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300">
              {silmeSonuc}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-xs text-neutral-500">
                <tr>
                  {yazabilir && (
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        title="Tümünü seç"
                        checked={listelenen.length > 0 && seciliListede.length === listelenen.length}
                        onChange={(e) =>
                          setSecili(e.target.checked ? new Set(listelenen.map((k) => k.id)) : new Set())
                        }
                      />
                    </th>
                  )}
                  {["Tarih", "Ürün", "Ambalaj", "Girilen", "Rapor birimiyle", "Kg", "Parti", "Operatör", ""].map((b) => (
                    <th key={b} className="text-left font-medium px-3 py-2 whitespace-nowrap">{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listelenen.map((k) => {
                  const kUrun = kayitUrunu(k, uHarita);
                  const kRapor = raporMiktari(k, kUrun);
                  return (
                  <tr
                    key={k.id}
                    className={`border-t border-neutral-100 dark:border-neutral-800 ${
                      secili.has(k.id)
                        ? "bg-red-50/60 dark:bg-red-950/20"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                    }`}
                  >
                    {yazabilir && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={secili.has(k.id)}
                          onChange={(e) => secimDegistir(k.id, e.target.checked)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap">{tarihYaz(k.tarih)}</td>
                    <td className="px-3 py-2">{k.urun_ad}</td>
                    <td className="px-3 py-2 text-neutral-500">{k.ambalaj_tipi || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-neutral-500">
                      {Number(k.miktar).toLocaleString("tr-TR")} {k.olcu_birimi}
                    </td>
                    <td
                      className="px-3 py-2 whitespace-nowrap font-medium"
                      title={raporAciklama(kUrun)}
                    >
                      {kRapor == null ? (
                        <span className="text-amber-600 text-xs">çevrilemedi</span>
                      ) : (
                        birimliYaz(kRapor, raporBirimi(kUrun))
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-neutral-500 text-xs">
                      {k.kg_karsiligi == null ? "—" : kgYaz(Number(k.kg_karsiligi))}
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
                  );
                })}
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
                    {["Kod", "Ad", "Grup", "Raporlama birimi", "Ambalaj", "Birim ağırlık", "Koli adedi", ""].map((b) => (
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
                        <td className="px-3 py-2">
                          <span className="font-medium">{raporBirimi(u)}</span>
                          <span className="block text-[10px] text-neutral-500">
                            {raporAciklama(u)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-neutral-500">{u.ambalaj_tipi || "—"}</td>
                        <td className="px-3 py-2">
                          {eksik ? (
                            // Uyarı değil: lavaş gibi ürünlerde kilogram yok.
                            <span className="text-neutral-400 text-xs">adet bazlı</span>
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
                <A e="Bir adet kaç kg?">
                  <input name="birim_agirlik_kg" inputMode="decimal" placeholder="boş = adet bazlı"
                    defaultValue={duzenlenenUrun?.birim_agirlik_kg ?? ""} className={gir + " w-full"} />
                </A>
                <A e="Bir kolide kaç adet?">
                  <input name="koli_adedi" inputMode="numeric" placeholder="20"
                    defaultValue={duzenlenenUrun?.koli_adedi ?? ""} className={gir + " w-full"} />
                </A>
              </div>
              <p className="text-[11px] text-neutral-500">
                Bu iki alan <b>girişi</b> ilgilendirir: birim ağırlık kilogram karşılığını,
                koli adedi ise koli/kutu/paket girişlerinin adede çevrilmesini sağlar.
                Raporda hangi birimin görüneceğini aşağıdaki bölüm belirler.
              </p>

              <RaporBirimiAlani urun={duzenlenenUrun} />
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

// ─── Ürün formunun raporlama birimi bölümü ────────────────────────────────
//
// Ayrı bileşen çünkü seçilen birime göre "bölen" alanının görünürlüğü ve
// açıklama metni anlık değişiyor; formun geri kalanı kontrolsüz (defaultValue).

function RaporBirimiAlani({ urun }: { urun: Urun | null }) {
  const [birim, setBirim] = useState<string>(raporBirimi(urun));
  const [bolen, setBolen] = useState<string>(String(raporBolen(urun)));

  const bolenGerekli = birim === "paket" || birim === "koli";
  const bolenSayi = Number(bolen.replace(",", ".")) || 1;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 space-y-2">
      <div className="text-xs font-semibold">Raporlarda nasıl görünsün?</div>
      <div className="grid grid-cols-2 gap-2">
        <A e="Raporlama birimi">
          <select
            name="rapor_birimi"
            value={birim}
            onChange={(e) => setBirim(e.target.value)}
            className={gir + " w-full"}
          >
            {RAPOR_BIRIMLERI.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </A>
        {bolenGerekli && (
          <A e={`Bir ${birim}te kaç adet?`}>
            <input
              name="rapor_bolen"
              inputMode="decimal"
              value={bolen}
              onChange={(e) => setBolen(e.target.value)}
              className={gir + " w-full"}
            />
          </A>
        )}
        {/* Bölen gizliyken de gönderilsin ki sunucu 1'e sabitlerken
            eksik alan hatası almasın. */}
        {!bolenGerekli && <input type="hidden" name="rapor_bolen" value="1" />}
      </div>
      <p className="text-[11px] text-neutral-500">
        {birim === "kg" ? (
          <>
            Üretim <b>kilogram</b> olarak raporlanır. Birim ağırlık girilmiş olmalı.
          </>
        ) : bolenGerekli && bolenSayi > 1 ? (
          <>
            Üretim <b>{birim}</b> olarak raporlanır: <b>1 {birim} = {adetYaz(bolenSayi)} adet</b>.
            Giriş adet, koli veya kg yapılsa da rapor {birim} çıkar.
          </>
        ) : (
          <>
            Üretim <b>{birim}</b> olarak raporlanır.
          </>
        )}{" "}
        Bu ayar <b>geçmiş kayıtlara da</b> uygulanır — değiştirdiğinizde eski aylar da
        yeni birimde görünür.
      </p>
    </div>
  );
}

// ─── Aylık üretim + satış tablosu ─────────────────────────────────────────

function AylikTablo({
  aylik, urunOzetleri, tumSubeleriGorur,
}: {
  aylik: AylikSatir[];
  urunOzetleri: UrunOzet[];
  tumSubeleriGorur: boolean;
}) {
  // Satış rakamı çiğköfte kilogramı; karşılaştırma da kilogram bazlı ürünle
  // yapılabilir. Hangi ürünün karşılaştırılacağını sabitlemek yerine kg
  // raporlanan ilk ürün seçiliyor.
  const kgUrun = urunOzetleri.find((u) => u.birim === "kg") ?? null;
  const satisVar = aylik.some((a) => a.satisKg != null);

  if (!aylik.length) {
    return (
      <div className={kart + " text-center text-sm text-neutral-400 py-10"}>
        Seçili filtreye uyan üretim kaydı yok.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={kart + " overflow-hidden"}>
        <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">Aylık üretim ve satış</h3>
          <p className="text-[11px] text-neutral-500">
            Her ürün kendi raporlama biriminde. Satış sütunu{" "}
            <b>şubelerin o ay sattığı çiğköfte kilogramı</b>
            {tumSubeleriGorur ? "" : " — yalnızca görme yetkiniz olan şubeler"}.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-xs text-neutral-500">
              <tr>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Ay</th>
                {urunOzetleri.map((u) => (
                  <th key={u.ad} className="text-right font-medium px-3 py-2 whitespace-nowrap">
                    {u.ad}
                    <span className="block text-[10px] font-normal text-neutral-400">
                      {u.etiket}
                    </span>
                  </th>
                ))}
                <th className="text-right font-medium px-3 py-2 whitespace-nowrap border-l border-neutral-200 dark:border-neutral-700">
                  Şube satışı
                  <span className="block text-[10px] font-normal text-neutral-400">
                    çiğköfte kg
                  </span>
                </th>
                {kgUrun && (
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap">
                    Üretim / satış
                    <span className="block text-[10px] font-normal text-neutral-400">
                      {kgUrun.ad}
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {aylik.map((a) => {
                const uretimKg = a.kgToplam;
                const oran =
                  a.satisKg && a.satisKg > 0 ? (uretimKg / a.satisKg) * 100 : null;
                return (
                  <tr key={a.ay} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{a.etiket}</td>
                    {urunOzetleri.map((u) => {
                      const v = a.urunler[u.ad];
                      return (
                        <td key={u.ad} className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                          {v == null ? (
                            <span className="text-neutral-300 dark:text-neutral-600">—</span>
                          ) : (
                            birimliYaz(v, u.birim)
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums border-l border-neutral-200 dark:border-neutral-700">
                      {a.satisKg == null ? (
                        <span
                          className="text-neutral-300 dark:text-neutral-600"
                          title="Bu ayın şube satışı henüz girilmemiş"
                        >
                          —
                        </span>
                      ) : (
                        kgYaz(a.satisKg)
                      )}
                    </td>
                    {kgUrun && (
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {oran == null ? (
                          <span className="text-neutral-300 dark:text-neutral-600">—</span>
                        ) : (
                          `%${oran.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-neutral-50 dark:bg-neutral-800/60 text-xs">
              <tr className="border-t border-neutral-200 dark:border-neutral-700 font-semibold">
                <td className="px-3 py-2">Toplam</td>
                {urunOzetleri.map((u) => (
                  <td key={u.ad} className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                    {birimliYaz(u.deger, u.birim)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums border-l border-neutral-200 dark:border-neutral-700">
                  {satisVar
                    ? kgYaz(aylik.reduce((t, a) => t + (a.satisKg ?? 0), 0))
                    : "—"}
                </td>
                {kgUrun && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 text-[11px] text-neutral-500 space-y-1">
        <div>
          <b>Birimler:</b>{" "}
          {urunOzetleri.map((u) => `${u.ad} → ${u.aciklama}`).join("  ·  ")}
        </div>
        <div>
          <b>Satış sütunu:</b> şubelerin aylık kg satışı. Üretim merkez tesiste, satış
          şubelerde gerçekleştiği için ay ay birebir eşleşmesi beklenmez — üretilen
          ürünün şubeye ulaşıp satılması zaman alır. Boş görünen ay, o ayın satış
          verisinin henüz girilmediği anlamına gelir.
        </div>
        {!satisVar && (
          <div className="text-amber-700 dark:text-amber-400">
            Bu dönemde hiç satış verisi bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Üretim giriş formu ───────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function UretimFormu({
  action, pending, urunler, bugun, duzenlenen, iptal, yazabilir,
}: {
  action: any;
  pending: boolean;
  urunler: Urun[];
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
      // cellDates BİLEREK KAPALI: açıkken kütüphane tarihi yerel saatli bir
      // Date'e çeviriyor ve tüm ay bir gün geriye kayıyordu (bkz.
      // excelTarihiCoz açıklaması). Kapalıyken tarih ham seri numarası
      // olarak geliyor — saat dilimi hiç işin içine girmiyor.
      const kitap = XLSX.read(veri, { type: "array" });
      const sayfa = kitap.Sheets[kitap.SheetNames[0]];
      const satirlar = XLSX.utils.sheet_to_json<Record<string, unknown>>(sayfa, {
        defval: "",
        raw: true,
      });

      if (!satirlar.length) {
        setDurum("Dosyada satır bulunamadı.");
        return;
      }

      const cevrilmis: AktarSatir[] = satirlar.map((ham) => {
        const s: Record<string, string> = {};
        for (const [baslik, deger] of Object.entries(ham)) {
          const alan = basligiTani(baslik);
          if (!alan) continue;
          // Tarih alanları ayrı çözülüyor: seri numarası, Date ya da metin
          // olabilir. Diğer alanlar düz metne çevriliyor.
          s[alan] =
            alan === "tarih" || alan === "skt"
              ? excelTarihiCoz(deger) ?? String(deger ?? "").trim()
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

/**
 * Ürün bazında dağılım — her satır KENDİ raporlama biriminde.
 *
 * Çubuklar bilerek ortak ölçeğe vurulmuyor: 55.267 kg çiğköfte ile 9.646
 * paket lavaşı aynı çubukta kıyaslamak yanıltıcı olurdu. Her çubuk kendi
 * biriminin en büyüğüne göre çiziliyor, yani "bu birimde en çok üretilen
 * hangisi" sorusunu cevaplıyor.
 */
function UrunDagilimi({ veri }: { veri: UrunOzet[] }) {
  if (!veri.length) return null;
  const enBuyuk = new Map<string, number>();
  for (const u of veri) {
    enBuyuk.set(u.birim, Math.max(enBuyuk.get(u.birim) ?? 1, u.deger));
  }

  return (
    <div className={kart + " p-4"}>
      <h3 className="text-sm font-semibold mb-1">Ürün bazında</h3>
      <p className="text-[11px] text-neutral-500 mb-3">her ürün kendi biriminde</p>
      <ul className="space-y-2">
        {veri.map((u) => (
          <li key={u.ad} className="text-sm">
            <div className="flex justify-between gap-2">
              <span className="truncate min-w-0">{u.ad}</span>
              <span className="shrink-0 font-medium">{birimliYaz(u.deger, u.birim)}</span>
            </div>
            <div className="text-[10px] text-neutral-400 mb-0.5">{u.aciklama}</div>
            <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className={
                  u.birim === "kg"
                    ? "h-full bg-neutral-900 dark:bg-neutral-100"
                    : "h-full bg-neutral-400"
                }
                style={{ width: `${(u.deger / (enBuyuk.get(u.birim) || 1)) * 100}%` }}
              />
            </div>
            {u.cevrilemeyen > 0 && (
              <div className="text-[10px] text-amber-600">
                {u.cevrilemeyen} kayıt bu birime çevrilemedi
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dagilim({
  baslik, altBaslik, veri, limit = 10,
}: {
  baslik: string;
  altBaslik?: string;
  veri: Kirilim[];
  limit?: number;
}) {
  const satirlar = veri.slice(0, limit);
  if (!satirlar.length) return null;

  // Çubuk uzunluğu her satırın kendi biriminde ölçülüyor: kilogramlı ve
  // adetli satırlar aynı ölçekte karşılaştırılamaz.
  const enBuyukKg = Math.max(1, ...satirlar.map((s) => s.kg));
  const enBuyukAdet = Math.max(1, ...satirlar.map((s) => s.adet));

  return (
    <div className={kart + " p-4"}>
      <h3 className="text-sm font-semibold mb-1">{baslik}</h3>
      {altBaslik && <p className="text-[11px] text-neutral-500 mb-3">{altBaslik}</p>}
      <ul className="space-y-1.5">
        {satirlar.map((s) => {
          const adetliMi = s.kg === 0 && s.adet > 0;
          const oran = adetliMi ? s.adet / enBuyukAdet : s.kg / enBuyukKg;
          return (
            <li key={s.anahtar} className="text-sm">
              <div className="flex justify-between gap-2 mb-0.5">
                <span className="truncate min-w-0">{s.anahtar}</span>
                <span className="text-neutral-500 shrink-0">{miktarYaz(s)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  className={adetliMi ? "h-full bg-neutral-400" : "h-full bg-neutral-900 dark:bg-neutral-100"}
                  style={{ width: `${oran * 100}%` }}
                />
              </div>
            </li>
          );
        })}
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
