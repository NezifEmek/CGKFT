-- 0012_sikayet.sql
-- Şikayet Yönetimi (CRM).
--
-- Talep (YAZILIM KONULAR2.docx): müşteri, tüketici, franchise, tedarikçi,
-- personel vb.'den gelen şikayetlerin tek platformda kaydı, takibi,
-- atanması, iletişim geçmişi ve raporlanması.
--
-- Üç tablo:
--   sikayetler          → kaydın kendisi
--   sikayet_atamalari   → birden fazla kişi görevlendirilebilsin diye ayrı
--   sikayet_hareketleri → iletişim geçmişi VE durum değişim günlüğü
--
-- "Her aşama için tarih ve kullanıcı bilgisi otomatik kaydedilmelidir"
-- gereği trigger ile karşılanıyor: durum her değiştiğinde hareket satırı
-- kendiliğinden düşüyor. Ekrana bırakılsaydı bir yol atlandığında geçmiş
-- eksik kalırdı.

-- ─── Şikayet numarası ────────────────────────────────────────────────────
create sequence if not exists public.sikayet_no_seq start 1001;

-- ─── Ana tablo ───────────────────────────────────────────────────────────
create table if not exists public.sikayetler (
  id                uuid primary key default gen_random_uuid(),
  sikayet_no        text unique not null default 'ŞKY-' || nextval('public.sikayet_no_seq'),
  basvuru_tarihi    date not null default current_date,

  -- Kaynak
  kanal             text not null default 'Telefon',
  basvuran_turu     text not null default 'Müşteri',
  ad_soyad          text not null default '',
  firma             text not null default '',
  telefon           text not null default '',
  eposta            text not null default '',

  -- Konu
  sube_id           uuid references public.subeler(id) on delete set null,
  urun              text not null default '',
  kategori          text not null default 'Diğer',
  aciklama          text not null default '',
  oncelik           text not null default 'orta'
                      check (oncelik in ('dusuk', 'orta', 'yuksek', 'kritik')),

  -- Süreç
  durum             text not null default 'yeni'
                      check (durum in ('yeni', 'inceleniyor', 'atandi',
                                       'musteri_bekleniyor', 'cozuldu',
                                       'kapatildi', 'iptal')),
  departman         text not null default '',
  son_cozum_tarihi  date,                       -- SLA hedefi
  cozum_notu        text not null default '',
  kok_neden         text not null default '',

  -- Zaman damgaları (KPI hesapları buradan)
  cozuldu_at        timestamptz,
  kapatildi_at      timestamptz,

  olusturan_id      uuid references public.profiles(id),
  guncelleyen_id    uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.sikayetler is
  'Şikayet/talep/geri bildirim kayıtları. Durum geçmişi sikayet_hareketleri tablosunda.';
comment on column public.sikayetler.son_cozum_tarihi is
  'SLA hedefi. Bu tarih geçtiği hâlde çözülmemiş kayıtlar "geciken" sayılır.';

create index if not exists sikayet_durum   on public.sikayetler (durum, basvuru_tarihi desc);
create index if not exists sikayet_sube    on public.sikayetler (sube_id);
create index if not exists sikayet_tarih   on public.sikayetler (basvuru_tarihi desc);
create index if not exists sikayet_kategori on public.sikayetler (kategori);

-- ─── Atamalar (birden fazla kişi) ────────────────────────────────────────
create table if not exists public.sikayet_atamalari (
  sikayet_id  uuid not null references public.sikayetler(id) on delete cascade,
  profil_id   uuid not null references public.profiles(id) on delete cascade,
  atayan_id   uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  primary key (sikayet_id, profil_id)
);
create index if not exists sikayet_atama_profil on public.sikayet_atamalari (profil_id);

-- ─── İletişim geçmişi ve durum günlüğü ───────────────────────────────────
create table if not exists public.sikayet_hareketleri (
  id          uuid primary key default gen_random_uuid(),
  sikayet_id  uuid not null references public.sikayetler(id) on delete cascade,
  tur         text not null default 'ic_not'
                check (tur in ('durum', 'gorusme', 'telefon', 'eposta',
                               'ic_not', 'atama', 'musteri_yaniti')),
  eski_durum  text,
  yeni_durum  text,
  metin       text not null default '',
  kaydeden_id uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists sikayet_hareket_sikayet on public.sikayet_hareketleri (sikayet_id, created_at);

-- ─── Durum değişimini otomatik günlüğe yaz ───────────────────────────────
create or replace function public.sikayet_durum_gunlukle()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.sikayet_hareketleri (sikayet_id, tur, yeni_durum, metin, kaydeden_id)
    values (new.id, 'durum', new.durum, 'Kayıt oluşturuldu', new.olusturan_id);
    return new;
  end if;

  if new.durum is distinct from old.durum then
    insert into public.sikayet_hareketleri (sikayet_id, tur, eski_durum, yeni_durum, kaydeden_id)
    values (new.id, 'durum', old.durum, new.durum, new.guncelleyen_id);

    -- Çözüm/kapanış anını KPI için sabitle.
    if new.durum = 'cozuldu' and new.cozuldu_at is null then
      new.cozuldu_at := now();
    end if;
    if new.durum in ('kapatildi', 'iptal') and new.kapatildi_at is null then
      new.kapatildi_at := now();
    end if;
    -- Geri açılırsa damgalar temizlensin; yoksa çözüm süresi yanlış çıkar.
    if new.durum in ('yeni', 'inceleniyor', 'atandi', 'musteri_bekleniyor') then
      new.cozuldu_at := null;
      new.kapatildi_at := null;
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists sikayet_durum_trg on public.sikayetler;
create trigger sikayet_durum_trg
  before update of durum on public.sikayetler
  for each row execute function public.sikayet_durum_gunlukle();

-- INSERT'te "before" yerine "after": id üretilmiş olmalı.
drop trigger if exists sikayet_olustu_trg on public.sikayetler;
create trigger sikayet_olustu_trg
  after insert on public.sikayetler
  for each row execute function public.sikayet_durum_gunlukle();

-- ─── RLS ─────────────────────────────────────────────────────────────────
-- Görünürlük: yönetim hepsini görür; diğerleri (a) kendi açtığı,
-- (b) kendisine atanan, (c) şube kapsamına giren kayıtları görür.
-- Şubesiz kayıtlar (genel şikayetler) yalnızca yönetim + ilgililerde.
alter table public.sikayetler enable row level security;
alter table public.sikayet_atamalari enable row level security;
alter table public.sikayet_hareketleri enable row level security;

create or replace function public.sikayet_gorunur(hedef_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select
    public.auth_rol() in ('admin', 'genel_mudur')
    or exists (select 1 from public.sikayetler s
                where s.id = hedef_id and s.olusturan_id = auth.uid())
    or exists (select 1 from public.sikayet_atamalari a
                where a.sikayet_id = hedef_id and a.profil_id = auth.uid())
    or exists (select 1 from public.sikayetler s
               join public.subeler b on b.id = s.sube_id
                where s.id = hedef_id
                  and public.sube_erisilebilir(b.id, b.bolge))
$$;

drop policy if exists "sikayet_select" on public.sikayetler;
create policy "sikayet_select" on public.sikayetler
  for select using (public.sikayet_gorunur(id));

drop policy if exists "sikayet_insert" on public.sikayetler;
create policy "sikayet_insert" on public.sikayetler
  for insert with check (auth.uid() is not null);

drop policy if exists "sikayet_update" on public.sikayetler;
create policy "sikayet_update" on public.sikayetler
  for update using (public.sikayet_gorunur(id))
  with check (public.sikayet_gorunur(id));

drop policy if exists "sikayet_delete" on public.sikayetler;
create policy "sikayet_delete" on public.sikayetler
  for delete using (public.auth_rol() in ('admin', 'genel_mudur'));

drop policy if exists "sikayet_atama_select" on public.sikayet_atamalari;
create policy "sikayet_atama_select" on public.sikayet_atamalari
  for select using (public.sikayet_gorunur(sikayet_id));

drop policy if exists "sikayet_atama_yonet" on public.sikayet_atamalari;
create policy "sikayet_atama_yonet" on public.sikayet_atamalari
  for all using (public.sikayet_gorunur(sikayet_id))
  with check (public.sikayet_gorunur(sikayet_id));

drop policy if exists "sikayet_hareket_select" on public.sikayet_hareketleri;
create policy "sikayet_hareket_select" on public.sikayet_hareketleri
  for select using (public.sikayet_gorunur(sikayet_id));

drop policy if exists "sikayet_hareket_ekle" on public.sikayet_hareketleri;
create policy "sikayet_hareket_ekle" on public.sikayet_hareketleri
  for insert with check (public.sikayet_gorunur(sikayet_id));

drop policy if exists "sikayet_hareket_sil" on public.sikayet_hareketleri;
create policy "sikayet_hareket_sil" on public.sikayet_hareketleri
  for delete using (public.auth_rol() in ('admin', 'genel_mudur'));
