-- 0006_toplanti.sql
-- Haftalık yönetim toplantısı yönetimi.
--
-- Akış: her toplantının numarası ve tarihi var. Herkes gündem ekler.
-- Raportör (Ümran Balcı) gündemi toplantı öncesi gönderir, toplantı sırasında
-- her gündemin altına not ve karar yazar, görev atar, sonra toplantıyı bitirir.
-- Toplantı bitince sıradaki toplantı otomatik açılır.
--
-- Görev termini yalnızca GENEL MÜDÜR ONAYIYLA değişir: erteleme bir talep
-- olarak kaydedilir, onaylanana kadar termin değişmez. Kaç kez ertelendiği
-- talep sayısından okunur.
--
-- E-posta: şimdilik gönderim yok. Altyapı hazır olsun diye "gönderildi"
-- damgaları ve yöntem alanı baştan duruyor; ileride e-posta eklenince
-- yalnızca gönderim fonksiyonunun içi dolacak, şema değişmeyecek.

-- ─── Ayarlar (tek satır) ─────────────────────────────────────────────────
create table if not exists public.toplanti_ayarlari (
  id smallint primary key default 1 check (id = 1),
  raportor_id uuid references public.profiles(id),
  -- Varsayılan katılımcılar; her toplantı bunu devralır.
  katilimcilar jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.toplanti_ayarlari (id) values (1) on conflict (id) do nothing;

-- ─── Toplantılar ─────────────────────────────────────────────────────────
create table if not exists public.toplantilar (
  id uuid primary key default gen_random_uuid(),
  no integer not null unique,
  tarih date not null,
  durum text not null default 'planlaniyor'
    check (durum in ('planlaniyor', 'gundem_gonderildi', 'tamamlandi')),
  genel_not text not null default '',
  katilimcilar jsonb not null default '[]'::jsonb,
  gundem_gonderildi_at timestamptz,
  gundem_gonderim_yontemi text,
  sonuc_gonderildi_at timestamptz,
  sonuc_gonderim_yontemi text,
  tamamlayan_id uuid references public.profiles(id),
  tamamlandi_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── Gündem maddeleri ────────────────────────────────────────────────────
create table if not exists public.toplanti_gundem (
  id uuid primary key default gen_random_uuid(),
  toplanti_id uuid not null references public.toplantilar(id) on delete cascade,
  sira integer not null default 0,
  baslik text not null,
  aciklama text not null default '',
  ekleyen_id uuid not null references public.profiles(id),
  -- Toplantı sırasında raportör dolduruyor
  toplanti_notu text not null default '',
  karar text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists toplanti_gundem_toplanti on public.toplanti_gundem (toplanti_id, sira);

-- ─── Görevler ────────────────────────────────────────────────────────────
create table if not exists public.toplanti_gorevleri (
  id uuid primary key default gen_random_uuid(),
  toplanti_id uuid not null references public.toplantilar(id) on delete cascade,
  gundem_id uuid references public.toplanti_gundem(id) on delete set null,
  baslik text not null,
  aciklama text not null default '',
  atanan_id uuid not null references public.profiles(id),
  termin date not null,
  durum text not null default 'acik' check (durum in ('acik', 'tamamlandi', 'iptal')),
  tamamlanma_tarihi date,
  sonuc_notu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists toplanti_gorev_atanan on public.toplanti_gorevleri (atanan_id, durum);
create index if not exists toplanti_gorev_termin on public.toplanti_gorevleri (termin);

-- ─── Erteleme talepleri ──────────────────────────────────────────────────
-- Termin yalnızca onaylanmış talep sonrası değişir; kaç kez ertelendiği
-- bu tablodaki onaylı kayıt sayısıdır.
create table if not exists public.gorev_ertelemeleri (
  id uuid primary key default gen_random_uuid(),
  gorev_id uuid not null references public.toplanti_gorevleri(id) on delete cascade,
  eski_termin date not null,
  yeni_termin date not null,
  gerekce text not null,
  talep_eden_id uuid not null references public.profiles(id),
  talep_at timestamptz not null default now(),
  onay_durumu text not null default 'bekliyor'
    check (onay_durumu in ('bekliyor', 'onaylandi', 'reddedildi')),
  karar_veren_id uuid references public.profiles(id),
  karar_at timestamptz,
  karar_notu text not null default ''
);
create index if not exists gorev_erteleme_gorev on public.gorev_ertelemeleri (gorev_id);
create index if not exists gorev_erteleme_bekleyen on public.gorev_ertelemeleri (onay_durumu);

-- ─── RLS ─────────────────────────────────────────────────────────────────
alter table public.toplanti_ayarlari enable row level security;
alter table public.toplantilar enable row level security;
alter table public.toplanti_gundem enable row level security;
alter table public.toplanti_gorevleri enable row level security;
alter table public.gorev_ertelemeleri enable row level security;

-- Okuma: giriş yapmış herkes (toplantı kurum geneli).
create policy "toplanti_ayarlari_select" on public.toplanti_ayarlari for select using (auth.uid() is not null);
create policy "toplantilar_select" on public.toplantilar for select using (auth.uid() is not null);
create policy "toplanti_gundem_select" on public.toplanti_gundem for select using (auth.uid() is not null);
create policy "toplanti_gorevleri_select" on public.toplanti_gorevleri for select using (auth.uid() is not null);
create policy "gorev_ertelemeleri_select" on public.gorev_ertelemeleri for select using (auth.uid() is not null);

-- Ayarlar ve toplantı kaydı: admin / genel müdür / raportör
create or replace function public.toplanti_raportoru_mu()
returns boolean language sql security definer set search_path = public stable as $$
  select public.auth_rol() in ('admin', 'genel_mudur')
      or auth.uid() = (select raportor_id from public.toplanti_ayarlari where id = 1)
$$;

create policy "toplanti_ayarlari_yonet" on public.toplanti_ayarlari
  for all using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));

create policy "toplantilar_yonet" on public.toplantilar
  for all using (public.toplanti_raportoru_mu()) with check (public.toplanti_raportoru_mu());

-- Gündem: herkes EKLER, kendi maddesini düzenler/siler; not ve kararı
-- yalnızca raportör yazar (uygulama tarafında alan bazlı ayrılıyor).
create policy "toplanti_gundem_ekle" on public.toplanti_gundem
  for insert with check (auth.uid() = ekleyen_id);
create policy "toplanti_gundem_guncelle" on public.toplanti_gundem
  for update using (auth.uid() = ekleyen_id or public.toplanti_raportoru_mu())
  with check (auth.uid() = ekleyen_id or public.toplanti_raportoru_mu());
create policy "toplanti_gundem_sil" on public.toplanti_gundem
  for delete using (auth.uid() = ekleyen_id or public.toplanti_raportoru_mu());

-- Görev: raportör atar; atanan kişi kendi görevinin durumunu günceller.
create policy "toplanti_gorevleri_yonet" on public.toplanti_gorevleri
  for all using (public.toplanti_raportoru_mu() or auth.uid() = atanan_id)
  with check (public.toplanti_raportoru_mu() or auth.uid() = atanan_id);

-- Erteleme: herkes kendi görevine talep açar; kararı genel müdür/admin verir.
create policy "gorev_ertelemeleri_talep" on public.gorev_ertelemeleri
  for insert with check (auth.uid() = talep_eden_id);
create policy "gorev_ertelemeleri_karar" on public.gorev_ertelemeleri
  for update using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));
