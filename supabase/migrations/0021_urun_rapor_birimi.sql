-- 0021_urun_rapor_birimi.sql
-- Her ürün kendi raporlama biriminde görünsün.
--
-- Talep (Nezif): "Lavaş'ı KG bazlı görmek istemiyorlar, paket bazlı olsun
-- (1 paket 50 adet). Mini sosları 250'şer adetli paket, ekşi sosu 12'li
-- paket, diğer iki sosu adet olarak görmek istiyorlar. Açıklamalarında da
-- böyle olduğu açıkça yazılsın."
--
-- ── Neden kayda değil ÜRÜNE yazılıyor ─────────────────────────────────
-- Raporlama birimi bir GÖRÜNTÜLEME tercihi. Kayda yazsaydık (kg_karsiligi
-- gibi) bugünkü isteği geçmiş 217 kayda uygulayamazdık — oysa istenen tam
-- olarak geçmişin de yeni birimde görünmesi. Bu yüzden ürün tanımından
-- okunuyor ve rapor her açılışta güncel tercihe göre çiziliyor.
--
-- Girişler değişmiyor: üretim yine ADET olarak giriliyor, kg karşılığı da
-- hesaplanmaya devam ediyor. Değişen sadece raporda hangi birimin
-- gösterildiği.

alter table public.uretim_urunleri
  add column if not exists rapor_birimi text not null default 'kg';

alter table public.uretim_urunleri
  add column if not exists rapor_bolen numeric(12,4) not null default 1;

alter table public.uretim_urunleri
  drop constraint if exists urun_rapor_birimi_check;

alter table public.uretim_urunleri
  add constraint urun_rapor_birimi_check
  check (rapor_birimi in ('kg', 'adet', 'paket', 'koli'));

alter table public.uretim_urunleri
  drop constraint if exists urun_rapor_bolen_check;

alter table public.uretim_urunleri
  add constraint urun_rapor_bolen_check check (rapor_bolen > 0);

comment on column public.uretim_urunleri.rapor_birimi is
  'Raporlarda gösterilecek birim. kg ise kg_karsiligi kullanılır; diğerlerinde girilen adet rapor_bolen''e bölünür.';
comment on column public.uretim_urunleri.rapor_bolen is
  'Bir raporlama biriminde kaç adet var. Lavaş 50, ekşi sos 12, mini soslar 250, adet bazlılarda 1.';

-- ─── Mevcut ürünlerin ayarı ──────────────────────────────────────────────
-- Ad üzerinden eşleştiriliyor; ürün yeniden adlandırılırsa Ürünler
-- ekranından elle ayarlanır.
update public.uretim_urunleri set rapor_birimi = 'kg',    rapor_bolen = 1   where upper(ad) = 'ÇİĞKÖFTE';
update public.uretim_urunleri set rapor_birimi = 'paket', rapor_bolen = 50  where upper(ad) = 'LAVAŞ';
update public.uretim_urunleri set rapor_birimi = 'paket', rapor_bolen = 12  where upper(ad) = 'EKŞİ SOS';
update public.uretim_urunleri set rapor_birimi = 'paket', rapor_bolen = 250 where upper(ad) = 'MİNİ EKŞİ SOS';
update public.uretim_urunleri set rapor_birimi = 'paket', rapor_bolen = 250 where upper(ad) = 'MİNİ ACI SOS';
update public.uretim_urunleri set rapor_birimi = 'adet',  rapor_bolen = 1   where upper(ad) = 'ACI SOS';
update public.uretim_urunleri set rapor_birimi = 'adet',  rapor_bolen = 1   where upper(ad) = 'ÇOK ACI SOS';
