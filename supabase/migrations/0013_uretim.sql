-- 0013_uretim.sql
-- Günlük Üretim Takibi.
--
-- Talep (YAZILIM KONULAR2.docx): günlük üretimin ürün, ambalaj, hat,
-- vardiya ve fabrika kırılımında kaydı; ileride stok/sevkiyat/satış
-- modülleriyle entegre çalışacak veri altyapısı.
--
-- ── Tasarımın can alıcı noktası: ORTAK BİRİM ───────────────────────────
-- Üretim kimi zaman adet, kimi zaman koli, kimi zaman kg olarak girilir.
-- "Günlük toplam üretim" diye bir sayı üretebilmek için hepsinin ortak
-- bir birime çevrilmesi şart; yoksa 500 adet + 20 kg toplanıp anlamsız
-- bir sayı çıkar.
--
-- Çevrim, ürün tanımındaki birim ağırlıktan yapılır ve sonuç kayda
-- YAZILIR (kg_karsiligi). Anlık hesaplanmıyor; çünkü ürünün ambalaj
-- ağırlığı sonradan değişirse geçmiş üretim rakamları değişmemeli.
-- Üretim kaydı, o gün ne üretildiyse onu göstermeye devam etmeli.

-- ─── Tanımlar: tesis, hat, vardiya ───────────────────────────────────────
-- Ayrı tablolar yerine tek tablo: üçü de "ad + sıra"dan ibaret,
-- yönetimi tek ekranda toplansın.
create table if not exists public.uretim_tanimlari (
  id         uuid primary key default gen_random_uuid(),
  tur        text not null check (tur in ('tesis', 'hat', 'vardiya')),
  ad         text not null,
  sira       integer not null default 0,
  aktif      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tur, ad)
);

comment on table public.uretim_tanimlari is
  'Üretim tesisi / hattı / vardiya listeleri. Tek tabloda, tur sütunuyla ayrılır.';

-- ─── Ürün tanımı ─────────────────────────────────────────────────────────
create table if not exists public.uretim_urunleri (
  id             uuid primary key default gen_random_uuid(),
  kod            text not null unique,
  ad             text not null,
  grup           text not null default '',
  ambalaj_tipi   text not null default '',      -- "100 gr", "250 gr", "1 kg"
  ambalaj_birimi text not null default 'Adet',  -- Adet, Koli, Kutu
  -- Ortak birime çevrim için gereken iki sayı:
  birim_agirlik_kg numeric(12,4),               -- bir ADET kaç kg
  koli_adedi       integer,                     -- bir KOLİ kaç adet
  raf_omru_gun     integer,
  aktif          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.uretim_urunleri.birim_agirlik_kg is
  'Bir adedin kilogram karşılığı. Boşsa adet cinsinden girilen üretim kg''a çevrilemez.';
comment on column public.uretim_urunleri.koli_adedi is
  'Bir kolideki adet sayısı. Boşsa koli cinsinden girilen üretim adet/kg''a çevrilemez.';

create index if not exists uretim_urun_grup on public.uretim_urunleri (grup);

-- ─── Günlük üretim kaydı ─────────────────────────────────────────────────
create table if not exists public.uretim_kayitlari (
  id            uuid primary key default gen_random_uuid(),
  tarih         date not null default current_date,
  tesis         text not null default '',
  hat           text not null default '',
  vardiya       text not null default '',

  urun_id       uuid references public.uretim_urunleri(id) on delete restrict,
  -- Ürün tanımı sonradan değişse/silinse bile kayıt okunabilir kalsın diye
  -- ad ve kod anlık kopyalanıyor.
  urun_kod      text not null default '',
  urun_ad       text not null default '',
  urun_grup     text not null default '',
  ambalaj_tipi  text not null default '',

  miktar        numeric(14,3) not null check (miktar >= 0),
  olcu_birimi   text not null default 'Adet'
                  check (olcu_birimi in ('Adet', 'Kg', 'Koli', 'Kutu', 'Paket')),
  -- Ortak birim. Çevrilemiyorsa NULL — sıfır yazmak "hiç üretilmedi"
  -- anlamına gelirdi, oysa gerçek durum "ölçemiyoruz".
  kg_karsiligi  numeric(14,3),

  parti_no      text not null default '',
  skt           date,
  operator      text not null default '',
  aciklama      text not null default '',

  olusturan_id   uuid references public.profiles(id),
  guncelleyen_id uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.uretim_kayitlari.kg_karsiligi is
  'Kayıt anında hesaplanıp yazılan kg karşılığı. Ürünün ambalaj ağırlığı sonradan değişirse geçmiş üretim değişmesin diye anlık hesaplanmıyor.';

create index if not exists uretim_kayit_tarih on public.uretim_kayitlari (tarih desc);
create index if not exists uretim_kayit_urun  on public.uretim_kayitlari (urun_id, tarih desc);
create index if not exists uretim_kayit_tesis on public.uretim_kayitlari (tesis, tarih desc);
create index if not exists uretim_kayit_parti on public.uretim_kayitlari (parti_no);

-- ─── Değişiklik günlüğü (audit log) ──────────────────────────────────────
-- Üretim rakamı sonradan düzeltilirse kimin neyi değiştirdiği kalsın.
create table if not exists public.uretim_gunlugu (
  id         uuid primary key default gen_random_uuid(),
  kayit_id   uuid,
  islem      text not null check (islem in ('ekleme', 'guncelleme', 'silme')),
  eski       jsonb,
  yeni       jsonb,
  kullanici_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists uretim_gunluk_kayit on public.uretim_gunlugu (kayit_id, created_at desc);

create or replace function public.uretim_gunlukle()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.uretim_gunlugu (kayit_id, islem, yeni, kullanici_id)
    values (new.id, 'ekleme', to_jsonb(new), new.olusturan_id);
    return new;
  elsif TG_OP = 'UPDATE' then
    -- Yalnızca sayısal/anlamlı bir değişiklik varsa yaz; her dokunuşta
    -- satır üretmek günlüğü okunmaz hâle getirir.
    if new.miktar is distinct from old.miktar
       or new.olcu_birimi is distinct from old.olcu_birimi
       or new.urun_id is distinct from old.urun_id
       or new.tarih is distinct from old.tarih
       or new.parti_no is distinct from old.parti_no then
      insert into public.uretim_gunlugu (kayit_id, islem, eski, yeni, kullanici_id)
      values (new.id, 'guncelleme', to_jsonb(old), to_jsonb(new), new.guncelleyen_id);
    end if;
    return new;
  else
    insert into public.uretim_gunlugu (kayit_id, islem, eski)
    values (old.id, 'silme', to_jsonb(old));
    return old;
  end if;
end
$$;

drop trigger if exists uretim_gunluk_trg on public.uretim_kayitlari;
create trigger uretim_gunluk_trg
  after insert or update or delete on public.uretim_kayitlari
  for each row execute function public.uretim_gunlukle();

-- ─── RLS ─────────────────────────────────────────────────────────────────
-- Üretim verisi şubeye bağlı değil, şirket geneli. Giriş yapan herkes
-- görür; yazma yetkisi denetmen dışındakilerde.
alter table public.uretim_tanimlari enable row level security;
alter table public.uretim_urunleri  enable row level security;
alter table public.uretim_kayitlari enable row level security;
alter table public.uretim_gunlugu   enable row level security;

drop policy if exists "uretim_tanim_select" on public.uretim_tanimlari;
create policy "uretim_tanim_select" on public.uretim_tanimlari
  for select using (auth.uid() is not null);
drop policy if exists "uretim_tanim_yonet" on public.uretim_tanimlari;
create policy "uretim_tanim_yonet" on public.uretim_tanimlari
  for all using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));

drop policy if exists "uretim_urun_select" on public.uretim_urunleri;
create policy "uretim_urun_select" on public.uretim_urunleri
  for select using (auth.uid() is not null);
drop policy if exists "uretim_urun_yonet" on public.uretim_urunleri;
create policy "uretim_urun_yonet" on public.uretim_urunleri
  for all using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));

drop policy if exists "uretim_kayit_select" on public.uretim_kayitlari;
create policy "uretim_kayit_select" on public.uretim_kayitlari
  for select using (auth.uid() is not null);
drop policy if exists "uretim_kayit_yaz" on public.uretim_kayitlari;
create policy "uretim_kayit_yaz" on public.uretim_kayitlari
  for all using (public.auth_rol() <> 'denetmen')
  with check (public.auth_rol() <> 'denetmen');

drop policy if exists "uretim_gunluk_select" on public.uretim_gunlugu;
create policy "uretim_gunluk_select" on public.uretim_gunlugu
  for select using (public.auth_rol() in ('admin', 'genel_mudur'));

-- ─── Başlangıç tanımları ─────────────────────────────────────────────────
insert into public.uretim_tanimlari (tur, ad, sira) values
  ('vardiya', 'Sabah', 1),
  ('vardiya', 'Öğle', 2),
  ('vardiya', 'Akşam', 3),
  ('vardiya', 'Gece', 4)
on conflict (tur, ad) do nothing;
