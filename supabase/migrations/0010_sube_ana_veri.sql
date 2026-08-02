-- 0010_sube_ana_veri.sql
-- Şube ana verisi: iletişim bilgileri, Google konum bilgisi ve
-- sorumlu değişim geçmişi.
--
-- Talep (YAZILIM KONULAR.docx md.3 + KONULAR2):
--   "Şubelerin iletişim bilgileri ve Google konum bilgilerinin de girilmesi
--    için alan açar mısın?"
--   "Tüm şubelerin geçmişini bilmeliyiz. Şubenin sorumlusu zaman zaman
--    değişebilir. Hem Adıyaman çiğköfte tarafında hem de şube tarafında.
--    Bu değişimleri tutmalıyız ve hangi dönemde kimin görevli olduğunu
--    bilmeliyiz."
--
-- Tasarım kararı: geçmiş kaydını EKRAN değil VERİTABANI tutar (trigger).
-- Böylece sorumlu hangi yoldan değişirse değişsin (şube yönetimi ekranı,
-- Excel içe aktarma, elle SQL) geçmiş kaydı atlanmaz.

-- ─── 1) İletişim ve konum alanları ───────────────────────────────────────
alter table public.subeler add column if not exists telefon           text not null default '';
alter table public.subeler add column if not exists yetkili_telefon   text not null default '';
alter table public.subeler add column if not exists eposta            text not null default '';
alter table public.subeler add column if not exists adres             text not null default '';
alter table public.subeler add column if not exists harita_url        text not null default '';
alter table public.subeler add column if not exists enlem             numeric(10,7);
alter table public.subeler add column if not exists boylam            numeric(10,7);
alter table public.subeler add column if not exists iletisim_notu     text not null default '';

comment on column public.subeler.telefon         is 'Şube sabit/işyeri telefonu';
comment on column public.subeler.yetkili_telefon is 'Şube yetkilisinin cep telefonu';
comment on column public.subeler.harita_url      is 'Google Maps bağlantısı (paylaş → bağlantıyı kopyala)';
comment on column public.subeler.enlem           is 'Google konum enlemi; harita_url''den otomatik çıkarılır';
comment on column public.subeler.boylam          is 'Google konum boylamı; harita_url''den otomatik çıkarılır';

-- ─── 2) Sorumlu değişim geçmişi ──────────────────────────────────────────
-- taraf = 'merkez' → Adıyaman Çiğköfte tarafındaki sorumlu (merkez yetkilisi)
-- taraf = 'sube'   → şube tarafındaki yetkili (işletmeci)
--
-- Dönem aralığı [baslangic, bitis) olarak yorumlanır: bitis, görevin
-- devredildiği gündür; o gün artık yeni kişi görevlidir. bitis null ise
-- kişi hâlen görevdedir.
create table if not exists public.sube_sorumlu_gecmisi (
  id          uuid primary key default gen_random_uuid(),
  sube_id     uuid not null references public.subeler(id) on delete cascade,
  taraf       text not null check (taraf in ('merkez', 'sube')),
  kisi_adi    text not null,
  baslangic   date,
  bitis       date,
  aciklama    text not null default '',
  otomatik    boolean not null default false,
  kaydeden_id uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

comment on table public.sube_sorumlu_gecmisi is
  'Şube sorumlusunun zaman içindeki değişimi. Dönem [baslangic, bitis); bitis null = hâlen görevde.';
comment on column public.sube_sorumlu_gecmisi.otomatik is
  'true: subeler tablosundaki değişiklikten trigger ile üretildi. false: elle girildi/düzeltildi.';

create index if not exists sube_sorumlu_gecmisi_sube on public.sube_sorumlu_gecmisi (sube_id, taraf, baslangic desc);
create index if not exists sube_sorumlu_gecmisi_kisi on public.sube_sorumlu_gecmisi (kisi_adi);

-- Aynı şube+taraf için birden fazla "açık" kayıt olmasın.
create unique index if not exists sube_sorumlu_gecmisi_tek_acik
  on public.sube_sorumlu_gecmisi (sube_id, taraf)
  where bitis is null;

-- ─── 3) Değişimi otomatik yakalayan trigger ──────────────────────────────
create or replace function public.sube_sorumlu_gecmisi_yaz()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  bugun date := current_date;
begin
  if TG_OP = 'INSERT' then
    if coalesce(nullif(trim(new.merkez_yetkilisi), ''), '') <> '' then
      insert into public.sube_sorumlu_gecmisi (sube_id, taraf, kisi_adi, baslangic, otomatik)
      values (new.id, 'merkez', trim(new.merkez_yetkilisi), coalesce(new.acilis_tarihi, bugun), true);
    end if;
    if coalesce(nullif(trim(new.sube_yetkilisi), ''), '') <> '' then
      insert into public.sube_sorumlu_gecmisi (sube_id, taraf, kisi_adi, baslangic, otomatik)
      values (new.id, 'sube', trim(new.sube_yetkilisi), coalesce(new.acilis_tarihi, bugun), true);
    end if;
    return new;
  end if;

  -- UPDATE: yalnızca gerçekten değişen taraf için kayıt aç/kapat.
  if trim(coalesce(new.merkez_yetkilisi, '')) is distinct from trim(coalesce(old.merkez_yetkilisi, '')) then
    update public.sube_sorumlu_gecmisi
       set bitis = bugun
     where sube_id = new.id and taraf = 'merkez' and bitis is null;
    if trim(coalesce(new.merkez_yetkilisi, '')) <> '' then
      insert into public.sube_sorumlu_gecmisi (sube_id, taraf, kisi_adi, baslangic, otomatik)
      values (new.id, 'merkez', trim(new.merkez_yetkilisi), bugun, true);
    end if;
  end if;

  if trim(coalesce(new.sube_yetkilisi, '')) is distinct from trim(coalesce(old.sube_yetkilisi, '')) then
    update public.sube_sorumlu_gecmisi
       set bitis = bugun
     where sube_id = new.id and taraf = 'sube' and bitis is null;
    if trim(coalesce(new.sube_yetkilisi, '')) <> '' then
      insert into public.sube_sorumlu_gecmisi (sube_id, taraf, kisi_adi, baslangic, otomatik)
      values (new.id, 'sube', trim(new.sube_yetkilisi), bugun, true);
    end if;
  end if;

  -- Şube kapandıysa açık görevleri de kapat.
  if coalesce(new.aktif, true) = false and coalesce(old.aktif, true) = true then
    update public.sube_sorumlu_gecmisi
       set bitis = coalesce(new.kapanis_tarihi, bugun)
     where sube_id = new.id and bitis is null;
  end if;

  -- Şube yeniden açıldıysa görevler de yeniden açılsın; yoksa şubede sorumlu
  -- yazılı olduğu hâlde geçmişte "görevde kimse yok" görünürdü.
  if coalesce(new.aktif, true) = true and coalesce(old.aktif, true) = false then
    if trim(coalesce(new.merkez_yetkilisi, '')) <> ''
       and not exists (select 1 from public.sube_sorumlu_gecmisi
                        where sube_id = new.id and taraf = 'merkez' and bitis is null) then
      insert into public.sube_sorumlu_gecmisi (sube_id, taraf, kisi_adi, baslangic, aciklama, otomatik)
      values (new.id, 'merkez', trim(new.merkez_yetkilisi), bugun, 'Şube yeniden açıldı', true);
    end if;
    if trim(coalesce(new.sube_yetkilisi, '')) <> ''
       and not exists (select 1 from public.sube_sorumlu_gecmisi
                        where sube_id = new.id and taraf = 'sube' and bitis is null) then
      insert into public.sube_sorumlu_gecmisi (sube_id, taraf, kisi_adi, baslangic, aciklama, otomatik)
      values (new.id, 'sube', trim(new.sube_yetkilisi), bugun, 'Şube yeniden açıldı', true);
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists sube_sorumlu_gecmisi_trg on public.subeler;
create trigger sube_sorumlu_gecmisi_trg
  after insert or update of merkez_yetkilisi, sube_yetkilisi, aktif on public.subeler
  for each row execute function public.sube_sorumlu_gecmisi_yaz();

-- ─── 4) Bugünkü durumu geçmişe taşı (bir kez) ────────────────────────────
-- Var olan 238 şubenin bugünkü sorumluları geçmişe yazılır.
-- Başlangıç, biliniyorsa şubenin açılış tarihi; yoksa boş bırakılır —
-- uydurma tarih yazmaktansa "bilinmiyor" göstermek doğru.
-- Kapalı şubede kimse "görevde" görünmemeli: dönem kapanış tarihinde biter.
insert into public.sube_sorumlu_gecmisi (sube_id, taraf, kisi_adi, baslangic, bitis, aciklama, otomatik)
select s.id, 'merkez', trim(s.merkez_yetkilisi), s.acilis_tarihi,
       case when coalesce(s.aktif, true) then null
            else coalesce(s.kapanis_tarihi, current_date) end,
       'Sisteme geçişte mevcut durumdan aktarıldı', true
  from public.subeler s
 where trim(coalesce(s.merkez_yetkilisi, '')) <> ''
   and not exists (
     select 1 from public.sube_sorumlu_gecmisi g
      where g.sube_id = s.id and g.taraf = 'merkez'
   );

insert into public.sube_sorumlu_gecmisi (sube_id, taraf, kisi_adi, baslangic, bitis, aciklama, otomatik)
select s.id, 'sube', trim(s.sube_yetkilisi), s.acilis_tarihi,
       case when coalesce(s.aktif, true) then null
            else coalesce(s.kapanis_tarihi, current_date) end,
       'Sisteme geçişte mevcut durumdan aktarıldı', true
  from public.subeler s
 where trim(coalesce(s.sube_yetkilisi, '')) <> ''
   and not exists (
     select 1 from public.sube_sorumlu_gecmisi g
      where g.sube_id = s.id and g.taraf = 'sube'
   );

-- ─── 5) RLS ──────────────────────────────────────────────────────────────
-- Görünürlük şubenin kendisiyle aynı: şubeyi görebilen geçmişini de görür.
alter table public.sube_sorumlu_gecmisi enable row level security;

drop policy if exists "sube_sorumlu_gecmisi_select" on public.sube_sorumlu_gecmisi;
create policy "sube_sorumlu_gecmisi_select" on public.sube_sorumlu_gecmisi
  for select using (
    exists (
      select 1 from public.subeler s
      where s.id = sube_sorumlu_gecmisi.sube_id
        and public.sube_erisilebilir(s.id, s.bolge)
    )
  );

drop policy if exists "sube_sorumlu_gecmisi_yonet" on public.sube_sorumlu_gecmisi;
create policy "sube_sorumlu_gecmisi_yonet" on public.sube_sorumlu_gecmisi
  for all using (
    exists (
      select 1 from public.subeler s
      where s.id = sube_sorumlu_gecmisi.sube_id
        and public.sube_duzenlenebilir(s.bolge)
    )
  )
  with check (
    exists (
      select 1 from public.subeler s
      where s.id = sube_sorumlu_gecmisi.sube_id
        and public.sube_duzenlenebilir(s.bolge)
    )
  );

-- ─── 6) Belirli bir tarihte kim görevliydi? ──────────────────────────────
create or replace function public.sube_sorumlusu(hedef_sube_id uuid, hedef_tarih date, hedef_taraf text default 'merkez')
returns text
language sql stable security definer set search_path = public
as $$
  select g.kisi_adi
    from public.sube_sorumlu_gecmisi g
   where g.sube_id = hedef_sube_id
     and g.taraf = hedef_taraf
     and (g.baslangic is null or g.baslangic <= hedef_tarih)
     and (g.bitis is null or g.bitis > hedef_tarih)
   order by g.baslangic desc nulls last
   limit 1
$$;
