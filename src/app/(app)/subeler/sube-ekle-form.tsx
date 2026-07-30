"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { subeEkle, kodOnizle } from "./actions";

const girdiSinif =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";

export function SubeEkleForm({ kilitliBolge }: { kilitliBolge: string | null }) {
  const [state, action, pending] = useActionState(subeEkle, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Kod önizlemesi: sıra no il genelinde tek sayaç olduğu ve istemci tüm
  // şubeleri göremediği için hesabı sunucuya soruyoruz.
  const [tip, setTip] = useState<"MS" | "FR">("MS");
  const [il, setIl] = useState("");
  const [ilce, setIlce] = useState("");
  const [onizleme, setOnizleme] = useState<{ kod: string | null; hata: string | null }>({
    kod: null,
    hata: null,
  });
  const [onizlemeBekliyor, onizlemeBaslat] = useTransition();
  const [elleGir, setElleGir] = useState(false);

  function onizlemeYenile(yeniTip = tip, yeniIl = il, yeniIlce = ilce) {
    if (elleGir || !yeniIl.trim() || !yeniIlce.trim()) {
      setOnizleme({ kod: null, hata: null });
      return;
    }
    onizlemeBaslat(async () => {
      const s = await kodOnizle(yeniTip, yeniIl, yeniIlce);
      setOnizleme({ kod: s.kod, hata: s.hata });
    });
  }

  return (
    <details className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <summary className="cursor-pointer text-sm font-medium">＋ Yeni Şube Ekle</summary>
      <form
        ref={formRef}
        action={async (fd) => {
          await action(fd);
          formRef.current?.reset();
          // il/ilçe/tip kontrollü alanlar — form.reset() bunları temizlemez.
          setIl("");
          setIlce("");
          setTip("MS");
          setOnizleme({ kod: null, hata: null });
        }}
        className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3"
      >
        <input
          name="ad"
          placeholder="Şube adı"
          required
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <select
          name="tip"
          value={tip}
          onChange={(e) => {
            const v = e.target.value === "FR" ? "FR" : "MS";
            setTip(v);
            onizlemeYenile(v, il, ilce);
          }}
          className={girdiSinif}
        >
          <option value="MS">Merkez Şube (MŞ)</option>
          <option value="FR">Franchise (FR)</option>
        </select>
        {kilitliBolge ? (
          <input type="hidden" name="bolge" value={kilitliBolge} />
        ) : (
          <input
            name="bolge"
            placeholder="Bölge"
            required
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          />
        )}
        <input
          name="il"
          placeholder="İl"
          value={il}
          onChange={(e) => setIl(e.target.value)}
          onBlur={() => onizlemeYenile()}
          className={girdiSinif}
        />
        <input
          name="ilce"
          placeholder="İlçe"
          value={ilce}
          onChange={(e) => setIlce(e.target.value)}
          onBlur={() => onizlemeYenile()}
          className={girdiSinif}
        />

        {/* Şube kodu — varsayılan olarak otomatik üretilir. */}
        {elleGir ? (
          <input
            name="kod"
            placeholder="Örn. F41-039GE"
            className={girdiSinif + " font-mono tracking-wide"}
          />
        ) : (
          <>
            <input type="hidden" name="kod" value="" />
            <div
              className={
                girdiSinif +
                " font-mono tracking-wide flex items-center bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500"
              }
            >
              {onizlemeBekliyor
                ? "hesaplanıyor…"
                : onizleme.kod ?? (il && ilce ? "—" : "kod otomatik")}
            </div>
          </>
        )}

        <div className="col-span-full flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Ekleniyor…" : "Şube Ekle"}
          </button>
          <button
            type="button"
            onClick={() => {
              setElleGir((v) => !v);
              setOnizleme({ kod: null, hata: null });
            }}
            className="text-xs text-neutral-500 hover:underline"
          >
            {elleGir ? "↩ Kodu otomatik üret" : "✎ Kodu elle gireceğim"}
          </button>
          {kilitliBolge && (
            <span className="text-xs text-neutral-500">Bölge: {kilitliBolge} (otomatik)</span>
          )}
          {onizleme.hata && <span className="text-xs text-amber-600">{onizleme.hata}</span>}
          {state?.hata && <span className="text-sm text-red-600">{state.hata}</span>}
        </div>

        <p className="col-span-full text-[11px] text-neutral-400 leading-relaxed">
          Kod biçimi: <span className="font-mono">Tip + İlPlaka − SıraNo + İlçe</span> (örn.{" "}
          <span className="font-mono">F41-039GE</span>). Sıra no il içinde merkez ve franchise için
          ortak tek sayaçtır ve mevcut en büyüğün bir fazlası verilir; kapanan şubenin numarası
          yeniden kullanılmaz.
        </p>
      </form>
    </details>
  );
}
