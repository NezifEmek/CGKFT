-- 0014_franchise_sube.sql
-- Franchise başvurusu → şube açılışı bağlantısı.
--
-- Talep (YAZILIM KONULAR2.docx):
--   "Franchise başvurularından onaylananlar yeni şube açılışına entegre
--    olmalı."
--
-- Tek sütunluk bir bağ: başvuru hangi şubeye dönüştü. Şube tarafında ayrı
-- bir sütun tutulmuyor; ters yönde arama bu sütun üzerinden yapılıyor.
-- İki yönlü bağ tutmak, ikisinin ayrışma ihtimalini bedavaya satın almak
-- olurdu.
--
-- on delete set null: şube silinirse başvuru kaydı durmaya devam etsin,
-- yalnızca bağı kopsun. Başvuru geçmişi silinmemeli.

alter table public.franchise_basvurulari
  add column if not exists sube_id uuid references public.subeler(id) on delete set null;

alter table public.franchise_basvurulari
  add column if not exists sube_acilis_at timestamptz;

comment on column public.franchise_basvurulari.sube_id is
  'Bu başvurudan açılan şube. Boşsa henüz şubeye dönüşmemiş.';
comment on column public.franchise_basvurulari.sube_acilis_at is
  'Şubenin sistemde açıldığı an (şubenin açılış tarihinden farklı olabilir).';

create index if not exists franchise_basvuru_sube on public.franchise_basvurulari (sube_id);

-- Bir şube birden fazla başvuruya bağlanmasın: yanlışlıkla iki başvurudan
-- aynı şube "açılırsa" hangisinin gerçek olduğu belirsizleşir.
create unique index if not exists franchise_basvuru_sube_tekil
  on public.franchise_basvurulari (sube_id)
  where sube_id is not null;
