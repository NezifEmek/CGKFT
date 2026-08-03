-- 0021_urun_rapor_birimi.sql
-- Her ürün kendi raporlama biriminde görünsün.
--
-- Talep (Nezif, güncel liste): "Ürünler KG, Koli, Paket gibi en üst birimine
-- göre özetlensin. Yani hepsi KG olarak görünmesin.
--   Çiğköfte — KG / Lavaş — Paket / Ekşi Sos — Koli /
--   Mini Ekşi Sos — Koli / Çok Acı Sos — Adet vb..."
--
-- Belirtilmeyen iki ürün benzerlerine göre eşlendi: Mini Acı Sos → koli
-- (mini ekşi sos gibi), Acı Sos → adet (çok acı sos gibi). Yanlışsa Ürünler
-- sekmesinden tek tıkla değiştirilebilir, geçmiş kayıtlar da anında uyar.
--
-- Bölen değerleri ürünlerin kendi koli_adedi alanından geliyor:
-- ekşi sos 12, mini soslar 250, lavaş 50.
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
-- upper() KULLANILMIYOR: Türkçe 'i' harfinin büyütülmesi veritabanının
-- diline bağlı ve "MİNİ" gibi adlarda beklenmedik sonuç verebiliyor.
-- Adlar zaten büyük harfle kayıtlı, doğrudan eşleştiriliyor.
update public.uretim_urunleri set rapor_birimi = 'kg',    rapor_bolen = 1   where ad = 'ÇİĞKÖFTE';
update public.uretim_urunleri set rapor_birimi = 'paket', rapor_bolen = 50  where ad = 'LAVAŞ';
update public.uretim_urunleri set rapor_birimi = 'koli',  rapor_bolen = 12  where ad = 'EKŞİ SOS';
update public.uretim_urunleri set rapor_birimi = 'koli',  rapor_bolen = 250 where ad = 'MİNİ EKŞİ SOS';
update public.uretim_urunleri set rapor_birimi = 'koli',  rapor_bolen = 250 where ad = 'MİNİ ACI SOS';
update public.uretim_urunleri set rapor_birimi = 'adet',  rapor_bolen = 1   where ad = 'ACI SOS';
update public.uretim_urunleri set rapor_birimi = 'adet',  rapor_bolen = 1   where ad = 'ÇOK ACI SOS';

-- Sonucu görmek için:
--   select ad, rapor_birimi, rapor_bolen from public.uretim_urunleri order by ad;
