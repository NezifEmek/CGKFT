import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { FranchiseBasvuru } from "@/lib/franchise";
import { BasvuruArayuz } from "./basvuru-arayuz";

export default async function FranchiseBasvurulariSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // 743 kayıt bugün 1000'in altında ama büyümesi bekleniyor — sayfalama şart.
  let tabloYok = false;
  const basvurular = await tumSatirlariGetir<FranchiseBasvuru>((from, to) =>
    supabase
      .from("franchise_basvurulari")
      .select("*")
      .order("tarih", { ascending: false })
      .range(from, to),
  ).catch(() => {
    tabloYok = true;
    return [] as FranchiseBasvuru[];
  });

  const sorumlular = [
    ...new Set(basvurular.map((b) => b.sirket_sorumlusu).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "tr"));

  const yazabilir = !tabloYok && profile.rol !== "denetmen";
  const silebilir = profile.rol === "admin" || profile.rol === "genel_mudur";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Franchise Başvuruları</h1>
        <p className="text-sm text-neutral-500">
          {basvurular.length} başvuru · kalite puanı dükkan + sermaye + niyet + işi yönetme
          alanlarından otomatik hesaplanır (her biri 0–25)
        </p>
      </div>

      {tabloYok ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          <b>Veritabanı tablosu henüz oluşturulmamış.</b> Bu ekranın çalışması için{" "}
          <code className="text-xs">supabase/migrations/0005_franchise_basvuru.sql</code>{" "}
          dosyasındaki SQL&apos;in Supabase&apos;de çalıştırılması gerekiyor.
        </div>
      ) : (
        <BasvuruArayuz
          basvurular={basvurular}
          sorumlular={sorumlular}
          yazabilir={yazabilir}
          silebilir={silebilir}
        />
      )}
    </div>
  );
}
