-- Etapa 4: medidas de crescimento (peso, altura e perímetro cefálico).

create table public.medidas (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  data date not null,
  peso_kg numeric(5, 3) check (peso_kg between 0.3 and 30),
  altura_cm numeric(4, 1) check (altura_cm between 20 and 130),
  perimetro_cefalico_cm numeric(4, 1) check (perimetro_cefalico_cm between 20 and 60),
  criado_em timestamptz not null default now(),
  check (coalesce(peso_kg, altura_cm, perimetro_cefalico_cm) is not null)
);

create index medidas_bebe_data_idx on public.medidas (bebe_id, data);

alter table public.medidas enable row level security;

create policy "membros veem as medidas dos bebês da família"
  on public.medidas for select to authenticated
  using (bebe_id in (select public.meus_bebes()));

create policy "membros registram medidas dos bebês da família"
  on public.medidas for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));

create policy "membros editam as medidas dos bebês da família"
  on public.medidas for update to authenticated
  using (bebe_id in (select public.meus_bebes()))
  with check (bebe_id in (select public.meus_bebes()));

create policy "membros apagam as medidas dos bebês da família"
  on public.medidas for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.medidas from anon;
revoke update on public.medidas from authenticated;
grant update (data, peso_kg, altura_cm, perimetro_cefalico_cm) on public.medidas to authenticated;

alter publication supabase_realtime add table public.medidas;
