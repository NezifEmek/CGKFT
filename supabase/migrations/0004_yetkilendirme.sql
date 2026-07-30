-- 0004_yetkilendirme.sql
-- Detaylı yetkilendirme: rol dışında kişi bazlı kapsam ve sayfa izinleri.
--
-- Sorun: 4 rol (admin / genel_mudur / bolge_muduru / denetmen) gerçek
-- ihtiyaçları karşılamıyordu. Merkez şubelerden sorumlu kişi hiçbirine
-- tam oturmuyor; bölge müdürü yapılıp bölgesi elle yazıldığında yazım
-- eşleşmediği için HİÇBİR şube göremiyordu. Bu yüzden herkes admin
-- yapılmıştı — yani rol koruması fiilen kapalıydı.
--
-- Çözüm: role ek olarak "kapsam" (hangi şubeleri görür) ve "sayfa
-- yetkileri" (hangi ekranları görür) alanları. Varsayılan 'rol' olduğu
-- için bu migration mevcut davranışı DEĞİŞTİRMEZ; yetkiler panelden
-- tek tek verildikçe devreye girer.

alter table public.profiles
  add column if not exists kapsam_turu text not null default 'rol'
    check (kapsam_turu in ('rol', 'tum', 'bolge', 'tip', 'secili')),
  add column if not exists kapsam_tipi text
    check (kapsam_tipi is null or kapsam_tipi in ('MS', 'FR')),
  add column if not exists yazabilir boolean not null default false,
  add column if not exists sayfa_yetkileri jsonb not null default '[]'::jsonb;

comment on column public.profiles.kapsam_turu is
  'rol = rolün varsayılanı | tum = bütün şubeler | bolge = profildeki bölge | tip = kapsam_tipi (MS/FR) | secili = sube_erisim tablosundaki şubeler';
comment on column public.profiles.yazabilir is
  'kapsam_turu rol dışındaysa: kapsamı içinde veri değiştirebilir mi';
comment on column public.profiles.sayfa_yetkileri is
  'İzin verilen ekran anahtarları. Boş dizi = rolün varsayılan ekranları.';

-- ─── Şube görünürlüğü ────────────────────────────────────────────────────
-- İmza değişmiyor; böylece bu fonksiyonu çağıran tüm politikalar aynen
-- çalışmaya devam ediyor. SECURITY DEFINER olduğu için içeride subeler'e
-- bakmak RLS döngüsü yaratmıyor.
create or replace function public.sube_erisilebilir(hedef_sube_id uuid, hedef_bolge text)
returns boolean
language sql security definer set search_path = public stable
as $$
  with p as (
    select rol, bolge, kapsam_turu, kapsam_tipi
    from public.profiles where id = auth.uid()
  )
  select case
    when (select rol from p) in ('admin', 'genel_mudur') then true
    when (select kapsam_turu from p) = 'tum' then true
    when (select kapsam_turu from p) = 'bolge' then hedef_bolge = (select bolge from p)
    when (select kapsam_turu from p) = 'tip' then exists (
      select 1 from public.subeler s
      where s.id = hedef_sube_id and s.tip = (select kapsam_tipi from p)
    )
    when (select kapsam_turu from p) = 'secili'
      then hedef_sube_id in (select public.auth_sube_ids())
    -- kapsam_turu = 'rol' → eski davranış birebir korunur
    when (select rol from p) = 'bolge_muduru' then hedef_bolge = (select bolge from p)
    when (select rol from p) = 'denetmen'
      then hedef_sube_id in (select public.auth_sube_ids())
    else false
  end
$$;

-- ─── Şube üzerinde yazma ─────────────────────────────────────────────────
-- İmza (bolge) olduğu için tip bazlı kapsamda şubeyi id ile bulamıyoruz;
-- bu durumda bölge yerine "kapsamı içindeki tipe ait herhangi bir şube mi"
-- sorusunu bölge üzerinden yanıtlıyoruz.
create or replace function public.sube_duzenlenebilir(hedef_bolge text)
returns boolean
language sql security definer set search_path = public stable
as $$
  with p as (
    select rol, bolge, kapsam_turu, kapsam_tipi, yazabilir
    from public.profiles where id = auth.uid()
  )
  select case
    when (select rol from p) in ('admin', 'genel_mudur') then true
    when (select kapsam_turu from p) <> 'rol' and not (select yazabilir from p) then false
    when (select kapsam_turu from p) = 'tum' then true
    when (select kapsam_turu from p) = 'bolge' then hedef_bolge = (select bolge from p)
    when (select kapsam_turu from p) = 'tip' then exists (
      select 1 from public.subeler s
      where s.bolge = hedef_bolge and s.tip = (select kapsam_tipi from p)
    )
    when (select kapsam_turu from p) = 'secili' then exists (
      select 1 from public.subeler s
      where s.id in (select public.auth_sube_ids()) and s.bolge = hedef_bolge
    )
    when (select rol from p) = 'bolge_muduru' then hedef_bolge = (select bolge from p)
    else false
  end
$$;

-- ─── Sayfa yetkisi ───────────────────────────────────────────────────────
create or replace function public.auth_sayfa_yetkileri()
returns jsonb
language sql security definer set search_path = public stable
as $$
  select coalesce(sayfa_yetkileri, '[]'::jsonb) from public.profiles where id = auth.uid()
$$;
