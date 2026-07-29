import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Sube } from "@/types/database";

function fmtKg(n: number) {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n)) + " kg";
}

export default async function GenelBakisSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS sayesinde bu sorgular otomatik olarak kullanıcının rolüne göre scoplanır
  // (denetmen: atandığı şube; bölge müdürü: kendi bölgesi; admin/GM: hepsi).
  const { data: subeler } = await supabase.from("subeler").select("*").returns<Sube[]>();
  const subeIdler = (subeler ?? []).map((s) => s.id);

  let toplamKg = 0;
  if (subeIdler.length) {
    const { data: satislar } = await supabase
      .from("aylik_satislar")
      .select("kg")
      .in("sube_id", subeIdler);
    toplamKg = (satislar ?? []).reduce((t, r) => t + Number(r.kg), 0);
  }

  const aktifSube = (subeler ?? []).filter((s) => s.aktif).length;
  const msSube = (subeler ?? []).filter((s) => s.tip === "MS").length;
  const frSube = (subeler ?? []).filter((s) => s.tip === "FR").length;

  const kartlar = [
    { etiket: "Görünür Şube", deger: String(subeler?.length ?? 0) },
    { etiket: "Aktif Şube", deger: String(aktifSube) },
    { etiket: "MŞ / FR", deger: `${msSube} / ${frSube}` },
    { etiket: "Toplam Satış", deger: fmtKg(toplamKg) },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Genel Bakış</h1>
      <p className="text-sm text-neutral-500 mb-6">
        {profile.ad_soyad ? `Hoş geldin, ${profile.ad_soyad}.` : "Hoş geldin."} Aşağıdaki
        rakamlar yalnızca yetkili olduğun şubeleri kapsar.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kartlar.map((k) => (
          <div
            key={k.etiket}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
          >
            <div className="text-xs text-neutral-500 mb-1">{k.etiket}</div>
            <div className="text-lg font-semibold">{k.deger}</div>
          </div>
        ))}
      </div>

      {!subeler?.length && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Henüz görünür bir şube yok. Admin/Genel Müdür şube ekleyebilir; Denetmen için atanmış
          şube olması gerekir.
        </div>
      )}
    </div>
  );
}
