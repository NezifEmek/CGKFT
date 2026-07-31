-- 0007_kapsam_yetkili.sql
-- Yetkilendirmeye "bölge sorumlusu" kapsamı ekler.
--
-- Eksiklik: şubelerin sorumluları zaten subeler.merkez_yetkilisi alanında
-- tanımlı (İZZET ALTUĞ 26, METİN BAŞOK 111, UMUT CAN DOĞAN 102 şube) ama
-- yetkilendirme ekranında bunu doğrudan seçmenin yolu yoktu; kişiyi ya
-- bölgeye ya da 100+ şubeyi tek tek işaretlemeye zorluyordu.
--
-- Artık kapsam_turu = 'yetkili' seçilip kapsam_yetkilisi'ne o kişinin adı
-- yazıldığında, kullanıcı yalnızca merkez yetkilisi kendisi olan şubeleri
-- görür. Şube listesindeki sorumlu değiştikçe kapsam kendiliğinden güncellenir.

alter table public.profiles
  drop constraint if exists profiles_kapsam_turu_check;

alter table public.profiles
  add constraint profiles_kapsam_turu_check
  check (kapsam_turu in ('rol', 'tum', 'bolge', 'tip', 'secili', 'yetkili'));

alter table public.profiles
  add column if not exists kapsam_yetkilisi text;

comment on column public.profiles.kapsam_yetkilisi is
  'kapsam_turu = ''yetkili'' iken: subeler.merkez_yetkilisi bu değere eşit olan şubeler görünür.';

-- ─── Görünürlük ──────────────────────────────────────────────────────────
create or replace function public.sube_erisilebilir(hedef_sube_id uuid, hedef_bolge text)
returns boolean
language sql security definer set search_path = public stable
as $$
  with p as (
    select rol, bolge, kapsam_turu, kapsam_tipi, kapsam_yetkilisi
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
    when (select kapsam_turu from p) = 'yetkili' then exists (
      select 1 from public.subeler s
      where s.id = hedef_sube_id
        and upper(coalesce(s.merkez_yetkilisi, '')) = upper(coalesce((select kapsam_yetkilisi from p), ''))
        and coalesce((select kapsam_yetkilisi from p), '') <> ''
    )
    when (select kapsam_turu from p) = 'secili'
      then hedef_sube_id in (select public.auth_sube_ids())
    when (select rol from p) = 'bolge_muduru' then hedef_bolge = (select bolge from p)
    when (select rol from p) = 'denetmen'
      then hedef_sube_id in (select public.auth_sube_ids())
    else false
  end
$$;

-- ─── Yazma ───────────────────────────────────────────────────────────────
create or replace function public.sube_duzenlenebilir(hedef_bolge text)
returns boolean
language sql security definer set search_path = public stable
as $$
  with p as (
    select rol, bolge, kapsam_turu, kapsam_tipi, kapsam_yetkilisi, yazabilir
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
    when (select kapsam_turu from p) = 'yetkili' then exists (
      select 1 from public.subeler s
      where s.bolge = hedef_bolge
        and upper(coalesce(s.merkez_yetkilisi, '')) = upper(coalesce((select kapsam_yetkilisi from p), ''))
        and coalesce((select kapsam_yetkilisi from p), '') <> ''
    )
    when (select kapsam_turu from p) = 'secili' then exists (
      select 1 from public.subeler s
      where s.id in (select public.auth_sube_ids()) and s.bolge = hedef_bolge
    )
    when (select rol from p) = 'bolge_muduru' then hedef_bolge = (select bolge from p)
    else false
  end
$$;
