-- 0017_denetim_yetki_duzeltme.sql
-- Bölge müdürleri denetim ve hızlı skor kaydedemiyordu.
--
-- BELİRTİ: Umut Can Doğan 40 soruluk denetimi doldurup kaydedince
-- "new row violates row-level security policy for table denetimler".
--
-- SEBEP: denetimler ve skorlar politikaları 0001'den kalma; yetkiyi
-- doğrudan `s.bolge = auth_bolge()` ile, yani profiles.bolge alanından
-- okuyorlar. Oysa 0004 ve 0007 ile yetkilendirme kapsam sistemine geçti
-- (kapsam_turu / kapsam_yetkilisi) ve profiles.bolge artık HİÇ KİMSEDE
-- dolu değil. NULL karşılaştırması hep false döndüğü için bölge
-- müdürlerinin tamamı denetim ve skor girişinden kilitlenmişti.
--
-- Diğer tablolar (subeler, aylik_satislar…) sube_erisilebilir /
-- sube_duzenlenebilir yardımcılarını kullandığı için 0007'de kendiliğinden
-- düzelmişti; bu iki tablo o geçişte atlanmış.
--
-- ÇÖZÜM: bu politikalar da tek kaynağa, yardımcı fonksiyonlara bağlanıyor.
--
-- Yazma kuralı olarak sube_duzenlenebilir DEĞİL sube_erisilebilir seçildi:
-- denetim, şube ana verisini değiştirmek değil kendi gözlemini kaydetmektir.
-- Kişi zaten yalnızca KENDİ adına kayıt açabiliyor (denetmen_id = auth.uid()).
-- Böylece salt okunur yetkili biri de gördüğü şubeyi denetleyebilir; şube
-- verisini yine değiştiremez.

-- ─── denetimler ──────────────────────────────────────────────────────────
drop policy if exists "denetimler_select" on public.denetimler;
create policy "denetimler_select" on public.denetimler
  for select using (
    denetmen_id = auth.uid()
    or exists (
      select 1 from public.subeler s
      where s.id = denetimler.sube_id
        and public.sube_erisilebilir(s.id, s.bolge)
    )
  );

drop policy if exists "denetimler_insert" on public.denetimler;
create policy "denetimler_insert" on public.denetimler
  for insert with check (
    denetmen_id = auth.uid()
    and exists (
      select 1 from public.subeler s
      where s.id = denetimler.sube_id
        and public.sube_erisilebilir(s.id, s.bolge)
    )
  );

-- Güncelleme ve silme değişmedi: kişi yalnızca kendi kaydına dokunur,
-- admin ve genel müdür hepsine.
drop policy if exists "denetimler_guncelle" on public.denetimler;
create policy "denetimler_guncelle" on public.denetimler
  for update using (
    public.auth_rol() in ('admin', 'genel_mudur') or denetmen_id = auth.uid()
  )
  with check (
    public.auth_rol() in ('admin', 'genel_mudur') or denetmen_id = auth.uid()
  );

-- ─── skorlar (aynı desen) ────────────────────────────────────────────────
drop policy if exists "skorlar_select" on public.skorlar;
create policy "skorlar_select" on public.skorlar
  for select using (
    olusturan_id = auth.uid()
    or exists (
      select 1 from public.subeler s
      where s.id = skorlar.sube_id
        and public.sube_erisilebilir(s.id, s.bolge)
    )
  );

drop policy if exists "skorlar_insert" on public.skorlar;
create policy "skorlar_insert" on public.skorlar
  for insert with check (
    olusturan_id = auth.uid()
    and exists (
      select 1 from public.subeler s
      where s.id = skorlar.sube_id
        and public.sube_erisilebilir(s.id, s.bolge)
    )
  );

drop policy if exists "skorlar_guncelle" on public.skorlar;
create policy "skorlar_guncelle" on public.skorlar
  for update using (
    public.auth_rol() in ('admin', 'genel_mudur') or olusturan_id = auth.uid()
  )
  with check (
    public.auth_rol() in ('admin', 'genel_mudur') or olusturan_id = auth.uid()
  );
