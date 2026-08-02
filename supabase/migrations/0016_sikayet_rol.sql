-- 0016_sikayet_rol.sql
-- Şikayet modülünün kendi rolleri.
--
-- Talep (KONULAR2, Şikayet md.9): Admin, Çağrı Merkezi, Franchise,
-- Bölge Müdürü, Operasyon, Kalite, Yönetim — "her rol yalnızca yetkili
-- olduğu kayıtları görüntüleyebilmeli ve işlem yapabilmelidir".
--
-- Neden yeni bir GENEL rol eklenmedi: profiles.rol satış, prim, şube ve
-- sayfa yetkilerini de belirliyor. Oraya "kalite" gibi bir değer eklemek
-- o yetkileri de karıştırırdı. Şikayet rolü ayrı bir sütunda duruyor.
--
-- Sütun BOŞ bırakılabilir: o zaman kişinin genel rolünden makul bir
-- karşılık türetilir (admin→admin, genel_mudur→yönetim,
-- bolge_muduru→bölge, diğer→operasyon). Böylece bu SQL çalıştıktan sonra
-- kimse yetkisiz kalmıyor ve kişiler tek tek ayarlanana kadar sistem
-- bugünküyle aynı davranıyor.

alter table public.profiles
  add column if not exists sikayet_rolu text;

alter table public.profiles
  drop constraint if exists profiles_sikayet_rolu_check;

alter table public.profiles
  add constraint profiles_sikayet_rolu_check
  check (
    sikayet_rolu is null
    or sikayet_rolu in ('admin', 'yonetim', 'cagri_merkezi', 'kalite',
                        'operasyon', 'bolge', 'franchise')
  );

comment on column public.profiles.sikayet_rolu is
  'Şikayet modülü rolü. NULL ise profiles.rol''den türetilir. Genel rolden bağımsızdır.';

-- ─── Görünürlük ──────────────────────────────────────────────────────────
-- Kapsam üç kademe:
--   hepsi → admin, yonetim, cagri_merkezi, kalite
--   sube  → operasyon, bolge  (şube erişim kuralları geçerli)
--   kendi → franchise         (yalnızca açtığı ve kendisine atanan)
--
-- Şikayet rolü atanmamışsa eski davranış korunuyor.
create or replace function public.sikayet_gorunur(hedef_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  with p as (
    select rol, coalesce(nullif(trim(sikayet_rolu), ''), null) as srol
    from public.profiles where id = auth.uid()
  ),
  etkin as (
    select coalesce(
      (select srol from p),
      case (select rol from p)
        when 'admin' then 'admin'
        when 'genel_mudur' then 'yonetim'
        when 'bolge_muduru' then 'bolge'
        else 'operasyon'
      end
    ) as rol
  )
  select case
    -- Her hâlükârda: kendi açtığı ve kendisine atanan kayıtlar görünür.
    when exists (select 1 from public.sikayetler s
                  where s.id = hedef_id and s.olusturan_id = auth.uid()) then true
    when exists (select 1 from public.sikayet_atamalari a
                  where a.sikayet_id = hedef_id and a.profil_id = auth.uid()) then true

    when (select rol from etkin) in ('admin', 'yonetim', 'cagri_merkezi', 'kalite') then true

    when (select rol from etkin) in ('operasyon', 'bolge') then exists (
      select 1 from public.sikayetler s
      join public.subeler b on b.id = s.sube_id
      where s.id = hedef_id
        and public.sube_erisilebilir(b.id, b.bolge)
    )

    -- franchise: yukarıdaki "kendi" kuralları dışında bir şey görmez.
    else false
  end
$$;

-- ─── Silme ───────────────────────────────────────────────────────────────
-- Silme yalnızca admin ve yönetimde. Genel rolü admin olan biri şikayet
-- rolü farklı olsa bile silebilir (panelin sahibi odur).
drop policy if exists "sikayet_delete" on public.sikayetler;
create policy "sikayet_delete" on public.sikayetler
  for delete using (
    public.auth_rol() in ('admin', 'genel_mudur')
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and sikayet_rolu in ('admin', 'yonetim')
    )
  );
