-- 0005_franchise_basvuru.sql
-- Franchise başvuruları (CRM). Excel'deki "FRANCHISE BAŞVURULARI_v3" dosyasının
-- yerini alır: 743 kayıt, 22 alan, 0–100 kalite puanı.
--
-- Seçenek listeleri ve puan ağırlıkları dosyanın "⚙️ Ayarlar" sayfasından
-- birebir alındı; kod tarafındaki karşılığı src/lib/franchise.ts.
--
-- Kalite puanı VERİTABANINDA hesaplanıyor (generated column): dükkan + sermaye
-- + niyet + işi yönetme, her biri 0–25. Böylece elle girişte de içe aktarmada
-- da aynı sonuç çıkıyor, tutarsızlık ihtimali kalmıyor.

create table if not exists public.franchise_basvurulari (
  id uuid primary key default gen_random_uuid(),
  basvuru_no text unique,                    -- FRN-1001
  tarih date not null,
  isim text not null,
  telefon text default '',
  il text default '',
  ilce text default '',
  ilave_iller text default '',
  ilave_ilceler text default '',
  kanal text default '',

  -- Değerlendirme (puanlanan dört alan)
  dukkan text default '',
  sermaye text default '',
  niyet_istek text default '',
  isi_yonetme text default '',

  -- Süreç
  sirket_sorumlusu text default '',
  son_durum text not null default 'Yeni Başvuru',
  sorumlu_arama_tarihi date,
  kaybetme_nedeni text default '',
  gorusme_notu text default '',

  -- Memnuniyet takibi
  memnuniyet_arama_tarihi date,
  memnuniyet_neticesi text default '',
  memnuniyet_notu text default '',

  -- Kim girdi / kim güncelledi
  olusturan_id uuid references public.profiles(id),
  guncelleyen_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists franchise_basvuru_durum on public.franchise_basvurulari (son_durum);
create index if not exists franchise_basvuru_tarih on public.franchise_basvurulari (tarih desc);
create index if not exists franchise_basvuru_sorumlu on public.franchise_basvurulari (sirket_sorumlusu);

-- Kalite puanı: dört alanın ağırlıklarının toplamı (0–100)
create or replace function public.franchise_kalite_puani(
  p_dukkan text, p_sermaye text, p_niyet text, p_yonetme text
) returns integer
language sql immutable
as $$
  select
    case p_dukkan
      when 'Dükkan Var' then 25
      when 'Bizden Talep Ediyor' then 15
      when 'Dükkan Araştıracak' then 10
      else 0 end
  + case p_sermaye
      when 'Yatırım Bütçesi Hazır' then 25
      when 'Bütçesi Hazır Değil, Mülk Satacak' then 15
      when 'Bütçesi Hazır Değil, Kredi Bekliyor' then 10
      when 'Bütçesi Yok, Taksit Soruyor' then 5
      else 0 end
  + case p_niyet
      when 'İletişimi Çok Güçlü, Detaylı Araştırma Yapmış' then 25
      when 'İstekli Ama Bilgi Eksikliği Var' then 15
      else 0 end
  + case p_yonetme
      when 'Kendisi İşletecek' then 25
      when 'Ailesinden Biri İşletecek' then 20
      when 'Ortağıyla Birlikte İşletecek' then 15
      when 'Personel Çalıştıracak' then 10
      else 0 end
$$;

alter table public.franchise_basvurulari
  drop column if exists kalite_puani;
alter table public.franchise_basvurulari
  add column kalite_puani integer
  generated always as (
    public.franchise_kalite_puani(dukkan, sermaye, niyet_istek, isi_yonetme)
  ) stored;

alter table public.franchise_basvurulari enable row level security;

-- Okuma: giriş yapmış herkes. Yazma: denetmen hariç herkes.
-- (Nezif'in kuralı: ilk girişi Tuğçe yapar, sonrasını atanan sorumlu —
--  bu ayrım uygulama tarafında, sayfa yetkileriyle yönetiliyor.)
create policy "franchise_basvuru_select" on public.franchise_basvurulari
  for select using (auth.uid() is not null);

create policy "franchise_basvuru_yaz" on public.franchise_basvurulari
  for all using (public.auth_rol() <> 'denetmen')
  with check (public.auth_rol() <> 'denetmen');
