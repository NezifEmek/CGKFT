-- 0022_urun_satislari.sql
-- Ürün bazında aylık satış — lavaş, soslar ve diğerleri.
--
-- ── Neden yeni bir tablo ─────────────────────────────────────────────────
-- Mevcut `aylik_satislar` şube başına aylık TEK bir kg değeri tutuyor ve o
-- da çiğköfte satışı. Ürün kırılımı yok. Bu yüzden üretim grafiklerinde
-- lavaş ve sosların satış çubuğu boş kalıyordu.
--
-- ── Şube bazı şimdiden hazır ─────────────────────────────────────────────
-- Nezif: "Şimdilik toplu girilecek ama sonraki aylarda şube bazında da
-- girilmesi durumu oluşacak."
--
-- Bu yüzden sube_id BAŞTAN var ve NULL olabiliyor:
--   sube_id IS NULL     → toplam giriş (bütün şubeler, tek satır)
--   sube_id DOLU        → o şubenin satışı
--
-- Sonradan sütun eklemek, mevcut satırların ne anlama geldiğini belirsiz
-- bırakırdı. Şimdi eklenince "NULL = toplam" kuralı en baştan yazılı.
--
-- ── Çift sayma tehlikesi ─────────────────────────────────────────────────
-- Aynı ürün/ay için hem toplam satırı hem şube satırları olursa ikisini
-- toplamak rakamı ikiye katlar. Kural (kod tarafında da uygulanıyor,
-- bkz. @/lib/urun-satis): ŞUBE SATIRLARI ÖNCELİKLİ. Bir ayda şube satırı
-- varsa toplam satırı yok sayılır ve ekran bunu söyler.
--
-- ── Miktar hangi birimde ─────────────────────────────────────────────────
-- Üretim kayıtlarındaki mantığın aynısı: girilen miktar + ölçü birimi
-- saklanıyor, raporlama birimine okuma anında çevriliyor. Ürünün rapor
-- birimi değiştiğinde (paket → koli gibi) geçmiş satışlar da yeni birimde
-- görünsün diye. Sayıyı çevrilmiş halde saklasaydık birim değişince
-- geçmiş sessizce yanlış olurdu.

create table if not exists public.urun_satislari (
  id            uuid primary key default gen_random_uuid(),
  urun_id       uuid not null references public.uretim_urunleri(id) on delete cascade,
  yil           int  not null,
  ay            text not null,          -- 'TEMMUZ' — aylik_satislar ile aynı biçim
  -- NULL = toplam (şube belirtilmeden). Şube silinirse satır toplama düşer.
  sube_id       uuid references public.subeler(id) on delete cascade,
  miktar        numeric(14,3) not null default 0,
  olcu_birimi   text not null default 'Adet'
                  check (olcu_birimi in ('Adet', 'Kg', 'Koli', 'Kutu', 'Paket')),
  aciklama      text not null default '',
  guncelleyen_id uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint urun_satis_ay_check check (ay in (
    'OCAK','ŞUBAT','MART','NİSAN','MAYIS','HAZİRAN',
    'TEMMUZ','AĞUSTOS','EYLÜL','EKİM','KASIM','ARALIK')),
  constraint urun_satis_yil_check check (yil between 2000 and 2100),
  constraint urun_satis_miktar_check check (miktar >= 0)
);

-- Benzersizlik iki ayrı kısmi indeksle kuruluyor: Postgres'te NULL'lar
-- birbirine eşit sayılmadığı için tek bir unique(…, sube_id) kısıtı toplam
-- satırının iki kez girilmesini ENGELLEMEZDİ.
create unique index if not exists urun_satis_toplam_tek
  on public.urun_satislari (urun_id, yil, ay)
  where sube_id is null;

create unique index if not exists urun_satis_sube_tek
  on public.urun_satislari (urun_id, yil, ay, sube_id)
  where sube_id is not null;

create index if not exists urun_satis_donem_idx
  on public.urun_satislari (yil, ay);

comment on column public.urun_satislari.sube_id is
  'NULL ise bütün şubelerin toplamı. Dolu ise o şubenin satışı. Aynı ürün/ayda ikisi birden varsa şube satırları geçerlidir.';
comment on column public.urun_satislari.olcu_birimi is
  'Girişte kullanılan birim. Raporlama birimine okuma anında çevrilir (bkz. uretim_urunleri.rapor_birimi).';

-- ─── updated_at ──────────────────────────────────────────────────────────
create or replace function public.urun_satis_damga()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists urun_satis_damga_tr on public.urun_satislari;
create trigger urun_satis_damga_tr
  before update on public.urun_satislari
  for each row execute function public.urun_satis_damga();

-- ─── RLS ─────────────────────────────────────────────────────────────────
-- Okuma: giriş yapan herkes (üretim ürün tanımlarıyla aynı yaklaşım —
-- bunlar şirket geneli üretim/satış rakamları, şube gizliliği taşımıyor).
-- Yazma: toplam satırlarını admin/genel müdür girer; şube satırında ise o
-- şubeyi düzenleme yetkisi aranır, böylece şube bazına geçildiğinde bölge
-- müdürü kendi şubesinin satışını girebilir.
alter table public.urun_satislari enable row level security;

drop policy if exists "urun_satis_select" on public.urun_satislari;
create policy "urun_satis_select" on public.urun_satislari
  for select using (auth.uid() is not null);

drop policy if exists "urun_satis_yaz" on public.urun_satislari;
create policy "urun_satis_yaz" on public.urun_satislari
  for insert with check (
    case
      when sube_id is null then public.auth_rol() in ('admin', 'genel_mudur')
      else exists (
        select 1 from public.subeler s
        where s.id = urun_satislari.sube_id
          and public.sube_duzenlenebilir(s.bolge)
      )
    end
  );

drop policy if exists "urun_satis_guncelle" on public.urun_satislari;
create policy "urun_satis_guncelle" on public.urun_satislari
  for update using (
    case
      when sube_id is null then public.auth_rol() in ('admin', 'genel_mudur')
      else exists (
        select 1 from public.subeler s
        where s.id = urun_satislari.sube_id
          and public.sube_duzenlenebilir(s.bolge)
      )
    end
  )
  with check (
    case
      when sube_id is null then public.auth_rol() in ('admin', 'genel_mudur')
      else exists (
        select 1 from public.subeler s
        where s.id = urun_satislari.sube_id
          and public.sube_duzenlenebilir(s.bolge)
      )
    end
  );

drop policy if exists "urun_satis_sil" on public.urun_satislari;
create policy "urun_satis_sil" on public.urun_satislari
  for delete using (
    case
      when sube_id is null then public.auth_rol() in ('admin', 'genel_mudur')
      else exists (
        select 1 from public.subeler s
        where s.id = urun_satislari.sube_id
          and public.sube_duzenlenebilir(s.bolge)
      )
    end
  );
