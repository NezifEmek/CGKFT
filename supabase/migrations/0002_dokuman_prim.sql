-- 0002_dokuman_prim.sql
-- Doküman Yönetimi (görev tanımları) + Prim Hakediş / Prim Projeksiyonu ekranları için
-- tek satırlık yapılandırma tablosu. Eski panelde bu veri yalnızca tarayıcının
-- localStorage'ında (cigkofte_docs_v1) duruyordu; artık veritabanında.
--
-- Varsayılan içerik kodda: src/lib/dokuman-varsayilan.ts
-- Tablo yalnızca panelden yapılan DEĞİŞİKLİKLERİ tutar; boş jsonb = "varsayılanı kullan".

create table if not exists public.dokuman_ayarlari (
  id smallint primary key default 1 check (id = 1),
  -- Pozisyon listesi; null/[] ise koddaki varsayılan 14 pozisyon gösterilir.
  pozisyonlar jsonb not null default '[]'::jsonb,
  -- Prim sistemi katsayıları; {} ise koddaki varsayılanlar geçerli.
  prim_ayarlari jsonb not null default '{}'::jsonb,
  guncelleyen_id uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.dokuman_ayarlari (id) values (1)
on conflict (id) do nothing;

alter table public.dokuman_ayarlari enable row level security;

-- Görev tanımları ve prim kuralları tüm giriş yapmış kullanıcılar tarafından okunur;
-- yalnızca admin / genel müdür değiştirebilir (segment_ayarlari ile aynı desen).
create policy "dokuman_ayarlari_select" on public.dokuman_ayarlari
  for select using (auth.uid() is not null);

create policy "dokuman_ayarlari_yonet" on public.dokuman_ayarlari
  for all using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));
