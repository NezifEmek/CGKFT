import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir, sonuclaGetir } from "@/lib/supabase/fetch-all";
import type { FranchiseBasvuru } from "@/lib/franchise";
import { BasvuruArayuz } from "./basvuru-arayuz";

export default async function FranchiseBasvurulariSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // 743 kayıt bugün 1000'in altında ama büyümesi bekleniyor — sayfalama şart.
  const basvuruSonuc = await sonuclaGetir<FranchiseBasvuru>(() =>
    tumSatirlariGetir<FranchiseBasvuru>((from, to) =>
      supabase
        .from("franchise_basvurulari")
        .select("*")
        .order("tarih", { ascending: false })
        .range(from, to),
    ),
  );
  const basvurular = basvuruSonuc.veri;
  const tabloYok = Boolean(basvuruSonuc.hata);

  // Sorumlu artık serbest metin değil, sistemdeki kişilerden seçiliyor.
  // Serbest metin olduğu sürece "Genel Ekip" gibi kişi olmayan değerler
  // giriliyordu; bunlar kimsenin faaliyet raporuna düşmüyordu.
  const { data: profiller } = await supabase
    .from("profiles")
    .select("ad_soyad")
    .order("ad_soyad")
    .returns<{ ad_soyad: string | null }[]>();

  const kisiler = (profiller ?? [])
    .map((p) => (p.ad_soyad ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "tr"));

  // Filtre listesi: kişiler + veride geçen ama artık seçilemeyen eski
  // değerler (varsa) — eski kayıtlar süzülebilsin diye.
  const sorumlular = [
    ...new Set([...kisiler, ...basvurular.map((b) => b.sirket_sorumlusu).filter(Boolean)]),
  ].sort((a, b) => a.localeCompare(b, "tr"));

  // Şube açma paneli için: bölge ve merkez yetkilisi seçenekleri, ve
  // hâlihazırda açılmış şubelerin adları.
  const subeler = await tumSatirlariGetir<{
    id: string;
    ad: string;
    bolge: string;
    merkez_yetkilisi: string;
  }>((from, to) =>
    supabase
      .from("subeler")
      .select("id, ad, bolge, merkez_yetkilisi")
      .range(from, to)
      .returns<{ id: string; ad: string; bolge: string; merkez_yetkilisi: string }[]>(),
  ).catch(() => []);

  const bolgeler = [...new Set(subeler.map((s) => s.bolge).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
  const yetkililer = [...new Set(subeler.map((s) => s.merkez_yetkilisi).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "tr"),
  );
  const subeAdlari = Object.fromEntries(subeler.map((s) => [s.id, s.ad]));

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
          kisiler={kisiler}
          yazabilir={yazabilir}
          silebilir={silebilir}
          bolgeler={bolgeler}
          yetkililer={yetkililer}
          subeAdlari={subeAdlari}
        />
      )}
    </div>
  );
}
