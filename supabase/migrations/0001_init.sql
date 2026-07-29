-- Çiğköfte Panel — Faz 1 şema + RLS
-- Bu dosyayı Supabase Dashboard → SQL Editor'e yapıştırıp çalıştırın
-- (ya da `supabase db push` ile, Supabase CLI kuruluysa).

create extension if not exists pgcrypto;

-- ─── profiles ────────────────────────────────────────────────────────────
-- auth.users ile bire-bir eşleşir; rol ve kapsam (bölge/şube) burada tutulur.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  ad_soyad text not null default '',
  rol text not null check (rol in ('admin', 'genel_mudur', 'bolge_muduru', 'denetmen')),
  bolge text,
  created_at timestamptz not null default now()
);

-- ─── subeler ─────────────────────────────────────────────────────────────
create table public.subeler (
  id uuid primary key default gen_random_uuid(),
  eski_id text unique, -- data.json'daki eski şube id'si (veri taşıma için, idempotent upsert)
  bolge text not null default 'TANIMSIZ',
  tip text not null check (tip in ('MS', 'FR')),
  ad text not null,
  il text default '',
  ilce text default '',
  kod text default '',
  merkez_yetkilisi text default '',
  sube_yetkilisi text default '',
  il_sube_sirasi text default '',
  aktif boolean not null default true,
  acilis_tarihi date,
  kapanis_tarihi date,
  acilis_tahmini boolean not null default false,
  fiyat_grubu text check (fiyat_grubu in ('dagitim', 'lojistik')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── sube_erisim ─────────────────────────────────────────────────────────
-- Denetmenin hangi şube(ler)e atandığı (çoktan-çoğa).
create table public.sube_erisim (
  profil_id uuid not null references public.profiles(id) on delete cascade,
  sube_id uuid not null references public.subeler(id) on delete cascade,
  primary key (profil_id, sube_id)
);

-- ─── aylar ───────────────────────────────────────────────────────────────
-- Sistem genelinde tanımlı (yıl, ay) + o ayın gün sayısı.
create table public.aylar (
  yil int not null,
  ay text not null check (ay in (
    'OCAK','ŞUBAT','MART','NİSAN','MAYIS','HAZİRAN',
    'TEMMUZ','AĞUSTOS','EYLÜL','EKİM','KASIM','ARALIK'
  )),
  gun_sayisi int not null default 30,
  primary key (yil, ay)
);

-- ─── aylik_satislar ──────────────────────────────────────────────────────
-- Mevcut sube.satislar / sube.satislar2025 nesnelerinin normalize edilmiş hali.
create table public.aylik_satislar (
  id uuid primary key default gen_random_uuid(),
  sube_id uuid not null references public.subeler(id) on delete cascade,
  yil int not null,
  ay text not null,
  kg numeric not null default 0,
  guncelleyen_id uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (sube_id, yil, ay)
);

-- ─── denetimler ──────────────────────────────────────────────────────────
create table public.denetimler (
  id uuid primary key default gen_random_uuid(),
  sube_id uuid not null references public.subeler(id) on delete cascade,
  denetmen_id uuid not null references public.profiles(id),
  tarih date not null default current_date,
  puan numeric,
  notlar text default '',
  detay jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─── skorlar ─────────────────────────────────────────────────────────────
create table public.skorlar (
  id uuid primary key default gen_random_uuid(),
  sube_id uuid not null references public.subeler(id) on delete cascade,
  olusturan_id uuid not null references public.profiles(id),
  tarih date not null default current_date,
  puan numeric,
  detay jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─── segment_ayarlari / fiyat_modeli (Faz 2 arayüzü, şema şimdiden hazır) ─
create table public.segment_ayarlari (
  id smallint primary key default 1 check (id = 1),
  baz text not null default 'KÜMÜLATİF',
  esikler jsonb not null default '[]'::jsonb
);

create table public.fiyat_modeli (
  id smallint primary key default 1 check (id = 1),
  para_birimi text not null default 'TL',
  satis_fiyati jsonb not null default '{"MS":100,"FR_dagitim":120,"FR_lojistik":126}'::jsonb,
  birim_maliyet_varsayilan numeric not null default 70.4,
  birim_maliyet_aylik jsonb not null default '{}'::jsonb,
  sabit_gider_aylik numeric not null default 0
);

insert into public.segment_ayarlari (id) values (1);
insert into public.fiyat_modeli (id) values (1);

-- ─── Yardımcı fonksiyonlar (RLS içinde profiles'a recursion olmadan erişim) ─
-- security definer + tablo sahibi (postgres) RLS'i atlar; böylece RLS
-- politikaları içinde profiles'a bakan bu fonksiyonlar sonsuz döngüye girmez.

create or replace function public.auth_rol()
returns text
language sql security definer set search_path = public stable
as $$
  select rol from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_bolge()
returns text
language sql security definer set search_path = public stable
as $$
  select bolge from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_sube_ids()
returns setof uuid
language sql security definer set search_path = public stable
as $$
  select sube_id from public.sube_erisim where profil_id = auth.uid()
$$;

create or replace function public.sube_erisilebilir(hedef_sube_id uuid, hedef_bolge text)
returns boolean
language sql security definer set search_path = public stable
as $$
  select
    public.auth_rol() in ('admin', 'genel_mudur')
    or (public.auth_rol() = 'bolge_muduru' and hedef_bolge = public.auth_bolge())
    or (public.auth_rol() = 'denetmen' and hedef_sube_id in (select public.auth_sube_ids()))
$$;

create or replace function public.sube_duzenlenebilir(hedef_bolge text)
returns boolean
language sql security definer set search_path = public stable
as $$
  select
    public.auth_rol() in ('admin', 'genel_mudur')
    or (public.auth_rol() = 'bolge_muduru' and hedef_bolge = public.auth_bolge())
$$;

-- ─── RLS aç ──────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.subeler enable row level security;
alter table public.sube_erisim enable row level security;
alter table public.aylar enable row level security;
alter table public.aylik_satislar enable row level security;
alter table public.denetimler enable row level security;
alter table public.skorlar enable row level security;
alter table public.segment_ayarlari enable row level security;
alter table public.fiyat_modeli enable row level security;

-- ─── profiles politikaları ───────────────────────────────────────────────
-- Kullanıcı yönetimi (oluşturma/rol atama) admin panelinde service_role
-- anahtarıyla server tarafında yapılır (RLS'i atlar); buradaki politikalar
-- sadece normal client okumaları içindir.
create policy "profiles_kendi_kaydi" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_admin_tumu_gorur" on public.profiles
  for select using (public.auth_rol() in ('admin', 'genel_mudur'));

-- ─── subeler politikaları ────────────────────────────────────────────────
create policy "subeler_select" on public.subeler
  for select using (public.sube_erisilebilir(id, bolge));

create policy "subeler_insert" on public.subeler
  for insert with check (public.sube_duzenlenebilir(bolge));

create policy "subeler_update" on public.subeler
  for update using (public.sube_duzenlenebilir(bolge))
  with check (public.sube_duzenlenebilir(bolge));

create policy "subeler_delete" on public.subeler
  for delete using (public.auth_rol() in ('admin', 'genel_mudur'));

-- ─── sube_erisim politikaları (yalnızca admin/GM yönetir) ────────────────
create policy "sube_erisim_select" on public.sube_erisim
  for select using (
    public.auth_rol() in ('admin', 'genel_mudur') or profil_id = auth.uid()
  );

create policy "sube_erisim_yonet" on public.sube_erisim
  for all using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));

-- ─── aylar politikaları ──────────────────────────────────────────────────
create policy "aylar_select" on public.aylar
  for select using (auth.uid() is not null);

create policy "aylar_yonet" on public.aylar
  for all using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));

-- ─── aylik_satislar politikaları ─────────────────────────────────────────
-- Denetmen sadece görüntüler (kg verisini değiştiremez); Bölge Müdürü kendi
-- bölgesinde tam giriş yapar; admin/GM her şeyi yapar.
create policy "aylik_satislar_select" on public.aylik_satislar
  for select using (
    exists (
      select 1 from public.subeler s
      where s.id = aylik_satislar.sube_id
        and public.sube_erisilebilir(s.id, s.bolge)
    )
  );

create policy "aylik_satislar_yaz" on public.aylik_satislar
  for insert with check (
    exists (
      select 1 from public.subeler s
      where s.id = aylik_satislar.sube_id
        and public.sube_duzenlenebilir(s.bolge)
    )
  );

create policy "aylik_satislar_guncelle" on public.aylik_satislar
  for update using (
    exists (
      select 1 from public.subeler s
      where s.id = aylik_satislar.sube_id
        and public.sube_duzenlenebilir(s.bolge)
    )
  )
  with check (
    exists (
      select 1 from public.subeler s
      where s.id = aylik_satislar.sube_id
        and public.sube_duzenlenebilir(s.bolge)
    )
  );

create policy "aylik_satislar_sil" on public.aylik_satislar
  for delete using (
    exists (
      select 1 from public.subeler s
      where s.id = aylik_satislar.sube_id
        and public.sube_duzenlenebilir(s.bolge)
    )
  );

-- ─── denetimler politikaları ─────────────────────────────────────────────
-- Denetmen: kendi atandığı şube için oluşturabilir + kendi kayıtlarını görür.
-- Bölge Müdürü: kendi bölgesindeki tüm denetimleri görür. Admin/GM: her şey.
create policy "denetimler_select" on public.denetimler
  for select using (
    public.auth_rol() in ('admin', 'genel_mudur')
    or denetmen_id = auth.uid()
    or exists (
      select 1 from public.subeler s
      where s.id = denetimler.sube_id
        and public.auth_rol() = 'bolge_muduru'
        and s.bolge = public.auth_bolge()
    )
  );

create policy "denetimler_insert" on public.denetimler
  for insert with check (
    public.auth_rol() in ('admin', 'genel_mudur')
    or (
      public.auth_rol() = 'denetmen'
      and denetmen_id = auth.uid()
      and sube_id in (select public.auth_sube_ids())
    )
    or exists (
      select 1 from public.subeler s
      where s.id = denetimler.sube_id
        and public.auth_rol() = 'bolge_muduru'
        and s.bolge = public.auth_bolge()
    )
  );

create policy "denetimler_guncelle" on public.denetimler
  for update using (
    public.auth_rol() in ('admin', 'genel_mudur') or denetmen_id = auth.uid()
  )
  with check (
    public.auth_rol() in ('admin', 'genel_mudur') or denetmen_id = auth.uid()
  );

create policy "denetimler_sil" on public.denetimler
  for delete using (
    public.auth_rol() in ('admin', 'genel_mudur') or denetmen_id = auth.uid()
  );

-- ─── skorlar politikaları (denetimler ile aynı desen) ────────────────────
create policy "skorlar_select" on public.skorlar
  for select using (
    public.auth_rol() in ('admin', 'genel_mudur')
    or olusturan_id = auth.uid()
    or exists (
      select 1 from public.subeler s
      where s.id = skorlar.sube_id
        and public.auth_rol() = 'bolge_muduru'
        and s.bolge = public.auth_bolge()
    )
  );

create policy "skorlar_insert" on public.skorlar
  for insert with check (
    public.auth_rol() in ('admin', 'genel_mudur')
    or (
      public.auth_rol() = 'denetmen'
      and olusturan_id = auth.uid()
      and sube_id in (select public.auth_sube_ids())
    )
    or exists (
      select 1 from public.subeler s
      where s.id = skorlar.sube_id
        and public.auth_rol() = 'bolge_muduru'
        and s.bolge = public.auth_bolge()
    )
  );

create policy "skorlar_guncelle" on public.skorlar
  for update using (
    public.auth_rol() in ('admin', 'genel_mudur') or olusturan_id = auth.uid()
  )
  with check (
    public.auth_rol() in ('admin', 'genel_mudur') or olusturan_id = auth.uid()
  );

create policy "skorlar_sil" on public.skorlar
  for delete using (
    public.auth_rol() in ('admin', 'genel_mudur') or olusturan_id = auth.uid()
  );

-- ─── segment_ayarlari / fiyat_modeli politikaları ────────────────────────
create policy "segment_ayarlari_select" on public.segment_ayarlari
  for select using (auth.uid() is not null);

create policy "segment_ayarlari_yonet" on public.segment_ayarlari
  for all using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));

create policy "fiyat_modeli_select" on public.fiyat_modeli
  for select using (auth.uid() is not null);

create policy "fiyat_modeli_yonet" on public.fiyat_modeli
  for all using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));
