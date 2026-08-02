"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { basvurudanSubeAc, subeBagiKaldir, acilisKoduOnizle } from "./actions";

const gir =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const btn =
  "rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60";

export interface AcilisBasvuru {
  id: string;
  isim: string;
  telefon: string | null;
  il: string | null;
  ilce: string | null;
  sube_id: string | null;
  sube_acilis_at: string | null;
}

function A({ e, children }: { e: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{e}</span>
      {children}
    </label>
  );
}

export function SubeAcPaneli({
  basvuru, bolgeler, yetkililer, subeAdi, silebilir,
}: {
  basvuru: AcilisBasvuru;
  bolgeler: string[];
  yetkililer: string[];
  /** Bağlıysa açılan şubenin adı */
  subeAdi: string | null;
  silebilir: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [il, setIl] = useState(basvuru.il ?? "");
  const [ilce, setIlce] = useState(basvuru.ilce ?? "");
  const [kod, setKod] = useState<string | null>(null);
  const [kodHata, setKodHata] = useState<string | null>(null);

  const [d1, a1, p1] = useActionState(basvurudanSubeAc, null);
  const [d2, a2, p2] = useActionState(subeBagiKaldir, null);
  const durum = d1 ?? d2;

  // Kod önizlemesi: sıra no'yu yalnızca sunucu güvenilir hesaplayabiliyor.
  useEffect(() => {
    if (!acik || !il.trim() || !ilce.trim()) {
      setKod(null);
      setKodHata(null);
      return;
    }
    let iptal = false;
    acilisKoduOnizle(il, ilce).then((r) => {
      if (iptal) return;
      setKod(r.kod);
      setKodHata(r.hata);
    });
    return () => { iptal = true; };
  }, [acik, il, ilce]);

  // ── Zaten açılmış ────────────────────────────────────────────────
  if (basvuru.sube_id) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
            ✓ Bu başvurudan şube açıldı
          </span>
          <Link href={`/subeler/${basvuru.sube_id}`} className="hover:underline">
            {subeAdi ?? "Şube kartına git"} →
          </Link>
          {basvuru.sube_acilis_at && (
            <span className="text-xs text-neutral-500">
              {new Date(basvuru.sube_acilis_at).toLocaleDateString("tr-TR")}
            </span>
          )}
          {silebilir && (
            <form action={a2} className="ml-auto">
              <input type="hidden" name="basvuru_id" value={basvuru.id} />
              <button type="submit" disabled={p2} className="text-xs text-neutral-500 hover:underline">
                bağlantıyı kaldır
              </button>
            </form>
          )}
        </div>
        {durum?.ok && <p className="text-emerald-600 mt-1">✓ {durum.ok}</p>}
        {durum?.hata && <p className="text-red-600 mt-1">{durum.hata}</p>}
      </div>
    );
  }

  // ── Henüz açılmamış ──────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-neutral-500">
          Bu başvuru sözleşmeye dönüştüyse buradan şubeyi açabilirsiniz.
        </span>
        <button
          type="button"
          onClick={() => setAcik((v) => !v)}
          className="text-sm rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 shrink-0"
        >
          {acik ? "Vazgeç" : "🏪 Şube aç"}
        </button>
      </div>

      {acik && (
        <form action={a1} className="mt-3 space-y-3">
          <input type="hidden" name="basvuru_id" value={basvuru.id} />

          <div className="grid sm:grid-cols-3 gap-2">
            <A e="Şube adı *">
              <input name="ad" required defaultValue={basvuru.isim} className={gir + " w-full"} />
            </A>
            <A e="İl *">
              <input name="il" required value={il} onChange={(e) => setIl(e.target.value)} className={gir + " w-full"} />
            </A>
            <A e="İlçe *">
              <input name="ilce" required value={ilce} onChange={(e) => setIlce(e.target.value)} className={gir + " w-full"} />
            </A>
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
            <A e="Bölge *">
              <input name="bolge" required list="acilis-bolgeler" className={gir + " w-full"} />
            </A>
            <A e="Merkez yetkilisi">
              <input name="merkez_yetkilisi" list="acilis-yetkililer" className={gir + " w-full"} />
            </A>
            <A e="Fiyat grubu">
              <select name="fiyat_grubu" defaultValue="dagitim" className={gir + " w-full"}>
                <option value="dagitim">Dağıtım</option>
                <option value="lojistik">Lojistik</option>
              </select>
            </A>
          </div>
          <datalist id="acilis-bolgeler">
            {bolgeler.map((b) => <option key={b} value={b} />)}
          </datalist>
          <datalist id="acilis-yetkililer">
            {yetkililer.map((y) => <option key={y} value={y} />)}
          </datalist>

          <div className="grid sm:grid-cols-3 gap-2">
            <A e="Açılış tarihi">
              <input name="acilis_tarihi" type="date" className={gir + " w-full"} />
            </A>
            <A e="Şube kodu">
              <input
                name="kod"
                placeholder={kod ?? "otomatik üretilecek"}
                className={gir + " w-full font-mono"}
              />
            </A>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="acilis_tahmini" />
                Açılış tarihi tahmini
              </label>
            </div>
          </div>

          {kod && (
            <p className="text-xs text-neutral-500">
              Üretilecek kod: <span className="font-mono font-medium">{kod}</span> — boş
              bırakırsanız bu kullanılır.
            </p>
          )}
          {kodHata && <p className="text-xs text-amber-600">Kod üretilemiyor: {kodHata}</p>}

          <div className="rounded-md bg-neutral-50 dark:bg-neutral-800/60 px-3 py-2 text-xs text-neutral-500">
            Şube yetkilisi <b>{basvuru.isim}</b>
            {basvuru.telefon ? <> ve telefonu <b>{basvuru.telefon}</b></> : null} olarak
            başvurudan aktarılacak. Sorumlu geçmişine de kendiliğinden düşer.
          </div>

          <button type="submit" disabled={p1} className={btn}>
            {p1 ? "Açılıyor…" : "Şubeyi aç"}
          </button>
        </form>
      )}

      {durum?.ok && <p className="text-sm text-emerald-600 mt-2">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600 mt-2">{durum.hata}</p>}
    </div>
  );
}
