-- 0011_haftalik_plan.sql
-- Haftalık ziyaret/faaliyet planı.
--
-- Talep (Faz 3 md.4 + KONULAR2 "haftalık faaliyet raporu"):
--   "Bölge müdürleri cumartesi gelecek haftanın planını girsin; hafta içi
--    girilen denetim kayıtları fiili sütuna otomatik düşsün."
--
-- Tasarım kararı: bu tablo YALNIZCA PLANI tutar. Gerçekleşen faaliyet
-- ayrıca yazılmaz — denetimler, skorlar, franchise aramaları ve toplantı
-- görevlerinden okunur. Aynı bilgiyi iki yere yazmak, ikisinin ayrışması
-- demektir; rapor hep kaynağından hesaplanmalı.
--
-- Gün alanı serbest bırakıldı (null olabilir): plan bazen "bu hafta içinde"
-- diye girilir, güne sabitlenmez. Rapor bunu "gün belirtilmemiş" gösterir.

create table if not exists public.haftalik_plan (
  id            uuid primary key default gen_random_uuid(),
  profil_id     uuid not null references public.profiles(id) on delete cascade,
  hafta         date not null,                     -- haftanın PAZARTESİsi
  gun           date,                              -- planlanan gün (opsiyonel)
  tur           text not null default 'ziyaret'
                  check (tur in ('ziyaret', 'denetim', 'toplanti', 'egitim', 'diger')),
  sube_id       uuid references public.subeler(id) on delete set null,
  baslik        text not null default '',          -- şube dışı işler için serbest metin
  aciklama      text not null default '',
  -- Elle işaretleme. Boş bırakılırsa gerçekleşme denetim/skor kayıtlarından
  -- otomatik anlaşılır; yönetici gerekirse buradan ezer.
  durum         text check (durum in ('gerceklesti', 'gerceklesmedi', 'ertelendi')),
  durum_notu    text not null default '',
  olusturan_id  uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.haftalik_plan is
  'Haftalık ziyaret/faaliyet planı. Gerçekleşen faaliyet burada tutulmaz; denetim/skor/franchise/toplantı kayıtlarından hesaplanır.';
comment on column public.haftalik_plan.hafta is 'Haftanın pazartesi tarihi. Hafta pazartesi–pazar.';
comment on column public.haftalik_plan.durum is
  'Elle işaretleme. NULL ise gerçekleşme durumu kayıtlardan otomatik çıkarılır.';

create index if not exists haftalik_plan_hafta on public.haftalik_plan (hafta desc, profil_id);
create index if not exists haftalik_plan_profil on public.haftalik_plan (profil_id, hafta desc);

-- Bir kişi aynı hafta aynı şubeyi iki kez planlamasın (aynı gün için).
create unique index if not exists haftalik_plan_tekil
  on public.haftalik_plan (profil_id, hafta, coalesce(sube_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(gun, '1900-01-01'::date), tur);

-- ─── RLS ─────────────────────────────────────────────────────────────────
-- Kendi planını herkes görür ve yazar. Yönetim hepsini görür ve düzenler.
-- (Ast planlarının görünürlüğü ekran tarafında organizasyon şemasından
--  süzülüyor; RLS burada kaba sınırı çiziyor.)
alter table public.haftalik_plan enable row level security;

drop policy if exists "haftalik_plan_select" on public.haftalik_plan;
create policy "haftalik_plan_select" on public.haftalik_plan
  for select using (auth.uid() is not null);

drop policy if exists "haftalik_plan_kendi" on public.haftalik_plan;
create policy "haftalik_plan_kendi" on public.haftalik_plan
  for all using (profil_id = auth.uid() or public.auth_rol() in ('admin', 'genel_mudur', 'bolge_muduru'))
  with check (profil_id = auth.uid() or public.auth_rol() in ('admin', 'genel_mudur', 'bolge_muduru'));
