-- 0009_oneriler.sql
-- Öneri kutusu: herkes yazılım/süreç önerisini girer, kayıtlı ve sıralı olur.
--
-- Nezif: "Yazılıma öneri sayfası ekler misin? Böylece herkes önerilerini
-- oradan girer. Hem kayıtlı olur hem de sırası olur."
--
-- "Sırası olur" iki şekilde karşılanıyor: kayıt sırası (created_at) ve
-- oylama (destek sayısı) — hangisinin önce yapılacağına bakarken ikisi de
-- işe yarıyor.

create table if not exists public.oneriler (
  id uuid primary key default gen_random_uuid(),
  baslik text not null,
  aciklama text not null default '',
  kategori text not null default 'Diğer',
  durum text not null default 'yeni'
    check (durum in ('yeni', 'inceleniyor', 'planlandi', 'yapildi', 'reddedildi')),
  oncelik text not null default 'orta' check (oncelik in ('dusuk', 'orta', 'yuksek')),
  yonetim_notu text not null default '',
  ekleyen_id uuid not null references public.profiles(id),
  karar_veren_id uuid references public.profiles(id),
  karar_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oneriler_durum on public.oneriler (durum, created_at desc);

-- Destek (oy). Kişi başına bir kez.
create table if not exists public.oneri_destekleri (
  oneri_id uuid not null references public.oneriler(id) on delete cascade,
  profil_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (oneri_id, profil_id)
);

alter table public.oneriler enable row level security;
alter table public.oneri_destekleri enable row level security;

-- Öneriler kurum geneli görünür: herkes okur, herkes ekler.
create policy "oneriler_select" on public.oneriler
  for select using (auth.uid() is not null);
create policy "oneriler_ekle" on public.oneriler
  for insert with check (auth.uid() = ekleyen_id);
-- Kendi önerisini düzeltebilir; durum/karar alanlarını yalnızca yönetim
-- değiştirir (uygulama tarafında alan bazlı ayrılıyor).
create policy "oneriler_guncelle" on public.oneriler
  for update using (auth.uid() = ekleyen_id or public.auth_rol() in ('admin', 'genel_mudur'))
  with check (auth.uid() = ekleyen_id or public.auth_rol() in ('admin', 'genel_mudur'));
create policy "oneriler_sil" on public.oneriler
  for delete using (auth.uid() = ekleyen_id or public.auth_rol() in ('admin', 'genel_mudur'));

create policy "oneri_destekleri_select" on public.oneri_destekleri
  for select using (auth.uid() is not null);
create policy "oneri_destekleri_yonet" on public.oneri_destekleri
  for all using (auth.uid() = profil_id) with check (auth.uid() = profil_id);
