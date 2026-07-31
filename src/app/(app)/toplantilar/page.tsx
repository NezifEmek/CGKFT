import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Profile } from "@/types/database";
import type { Toplanti, Gundem, Gorev, Erteleme } from "@/lib/toplanti";
import { ToplantiArayuz, type Kisi } from "./toplanti-arayuz";

export default async function ToplantilarSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Hangi sorgunun neden patladığını göstermek şart: "tablo yok" demek
  // yetmiyordu, tablolar duruyor ama sorgu başka bir sebeple hata verebiliyor
  // (eksik politika, eksik fonksiyon vb.).
  const hatalar: string[] = [];
  const yakala = <T,>(ad: string, p: Promise<T[]>) =>
    p.catch((e: unknown) => {
      hatalar.push(`${ad}: ${e instanceof Error ? e.message : String(e)}`);
      return [] as T[];
    });

  const [toplantilar, gundemler, gorevler, ertelemeler, { data: profiller }, ayarSonuc] =
    await Promise.all([
      yakala(
        "toplantilar",
        tumSatirlariGetir<Toplanti>((f, t) =>
          supabase.from("toplantilar").select("*").order("no", { ascending: false }).range(f, t),
        ),
      ),
      yakala("toplanti_gundem", tumSatirlariGetir<Gundem>((f, t) => supabase.from("toplanti_gundem").select("*").range(f, t))),
      yakala("toplanti_gorevleri", tumSatirlariGetir<Gorev>((f, t) => supabase.from("toplanti_gorevleri").select("*").range(f, t))),
      yakala("gorev_ertelemeleri", tumSatirlariGetir<Erteleme>((f, t) => supabase.from("gorev_ertelemeleri").select("*").range(f, t))),
      supabase.from("profiles").select("id, ad_soyad").order("ad_soyad").returns<Profile[]>(),
      supabase
        .from("toplanti_ayarlari")
        .select("raportor_id, katilimcilar")
        .eq("id", 1)
        .maybeSingle<{ raportor_id: string | null; katilimcilar: string[] }>(),
    ]);

  const kisiler: Kisi[] = (profiller ?? []).map((p) => ({
    id: p.id,
    ad: p.ad_soyad || "(adsız)",
  }));

  const raportorId = ayarSonuc.data?.raportor_id ?? null;
  const genelMudurMuyum = profile.rol === "admin" || profile.rol === "genel_mudur";
  const raportorMuyum = genelMudurMuyum || (!!raportorId && raportorId === profile.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Toplantı Yönetimi</h1>
        <p className="text-sm text-neutral-500">
          Haftalık yönetim toplantısı · gündem, karar ve görev takibi
          {toplantilar.length ? ` · ${toplantilar.length} toplantı` : ""}
        </p>
      </div>

      {hatalar.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300 space-y-2">
          <p>
            <b>Bazı toplantı verileri okunamadı.</b> Aşağıdaki hata, sorunun tabloların hiç
            oluşturulmamasından mı yoksa eksik bir yetki kuralından mı kaynaklandığını gösterir.
          </p>
          <ul className="text-[13px] font-mono space-y-1">
            {hatalar.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <p className="text-[13px]">
            Tablolar hiç yoksa{" "}
            <code className="text-xs">supabase/migrations/0006_toplanti.sql</code>{" "}
            çalıştırılmalı. Ekran yine de aşağıda açık; eksik veriyle çalışır.
          </p>
        </div>
      )}

      {/* Hata olsa da ekranı açıyoruz: Ayarlar sekmesi kapalı kalınca
          raportör seçilemiyor ve kullanıcı kilitleniyordu. */}
      <ToplantiArayuz
        toplantilar={toplantilar}
        gundemler={gundemler}
        gorevler={gorevler}
        ertelemeler={ertelemeler}
        kisiler={kisiler}
        raportorId={raportorId}
        varsayilanKatilimcilar={ayarSonuc.data?.katilimcilar ?? []}
        benId={profile.id}
        raportorMuyum={raportorMuyum}
        genelMudurMuyum={genelMudurMuyum}
      />
    </div>
  );
}
