"use client";

// sube-secici.tsx — Şubeyi KODUNU YAZARAK seçme alanı.
//
// Nezif'in isteği: "Şikayet alanında ilgili şube kodu yazacak bir alan
// eklemeni istiyorum."
//
// ── Neden açılır liste yetmiyordu ────────────────────────────────────────
// 235 şube var ve açılır listede yalnızca ad görünüyordu. Telefondaki
// müşteri "M03-003SA" diyor, kullanıcı listede o kodu arayamıyordu.
// Artık kod da ad da yazılabiliyor; yazılan değer gerçek şubeye
// çözülemezse ekran bunu SÖYLÜYOR — sessizce "şube yok" kaydetmiyor.

import { useMemo, useState } from "react";

export interface SubeSecim {
  id: string;
  kod?: string | null;
  ad: string;
  il?: string | null;
  ilce?: string | null;
  aktif?: boolean | null;
}

/** Türkçe harfleri katlayıp karşılaştırma anahtarı üretir. */
function anahtar(s: string): string {
  return s
    .toLocaleUpperCase("tr")
    .replace(/[İIıi]/g, "I")
    .replace(/Ö/g, "O").replace(/Ü/g, "U").replace(/Ş/g, "S")
    .replace(/Ç/g, "C").replace(/Ğ/g, "G")
    .replace(/[^A-Z0-9]/g, "");
}

export function subeEtiketi(s: SubeSecim): string {
  const yer = [s.il, s.ilce].filter(Boolean).join(" / ");
  return `${s.kod ? s.kod + " — " : ""}${s.ad}${yer ? ` (${yer})` : ""}`;
}

export function SubeSecici({
  subeler,
  ad = "sube_id",
  varsayilanId = "",
  etiket = "İlgili şube (kod ya da ad yazın)",
  gir,
}: {
  subeler: SubeSecim[];
  /** form alanı adı — çözülen şube kimliği bu adla gönderilir */
  ad?: string;
  varsayilanId?: string;
  etiket?: string;
  /** input sınıfı — çağıran ekranın stiliyle aynı olsun diye dışarıdan */
  gir: string;
}) {
  const baslangic = subeler.find((s) => s.id === varsayilanId);
  const [metin, setMetin] = useState(baslangic ? subeEtiketi(baslangic) : "");

  // Kod, ad ve tam etiket üzerinden arama yapılabilsin.
  const dizin = useMemo(() => {
    const m = new Map<string, SubeSecim>();
    for (const s of subeler) {
      if (s.kod) m.set("K" + anahtar(s.kod), s);
      m.set("A" + anahtar(s.ad), s);
      m.set("E" + anahtar(subeEtiketi(s)), s);
    }
    return m;
  }, [subeler]);

  const secili = useMemo(() => {
    const t = metin.trim();
    if (!t) return null;
    const a = anahtar(t);
    return dizin.get("E" + a) ?? dizin.get("K" + a) ?? dizin.get("A" + a) ?? null;
  }, [metin, dizin]);

  // Yazıldı ama hiçbir şubeye denk gelmiyor — uyarılmalı.
  const cozulemedi = metin.trim().length > 0 && !secili;

  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{etiket}</span>
      {/* Çözülen kimlik gizli alanla gönderiliyor; boşsa "şube yok / genel" */}
      <input type="hidden" name={ad} value={secili?.id ?? ""} />
      <input
        list="sube-listesi"
        value={metin}
        onChange={(e) => setMetin(e.target.value)}
        placeholder="M03-003SA ya da SANDIKLI"
        autoComplete="off"
        className={gir + " w-full" + (cozulemedi ? " border-amber-400" : "")}
      />
      <datalist id="sube-listesi">
        {subeler.map((s) => (
          <option key={s.id} value={subeEtiketi(s)} />
        ))}
      </datalist>

      {secili ? (
        <span className="block text-[11px] text-emerald-600 mt-0.5">
          ✓ {secili.kod ? secili.kod + " · " : ""}
          {secili.ad}
          {secili.aktif === false ? " (kapalı şube)" : ""}
        </span>
      ) : cozulemedi ? (
        <span className="block text-[11px] text-amber-600 mt-0.5">
          Bu kodda/adda şube bulunamadı — kayıt <b>şubesiz</b> açılacak. Listeden seçebilir
          ya da boş bırakabilirsiniz.
        </span>
      ) : (
        <span className="block text-[11px] text-neutral-400 mt-0.5">
          Boş bırakılırsa şube yok / genel sayılır.
        </span>
      )}
    </label>
  );
}
