-- Vacinas aplicadas no bebê e na mãe (durante a gestação).
-- O calendário recomendado fica no app (Calendário Nacional de Vacinação 2026); aqui só o que foi tomado.

create table public.vacinas_aplicadas (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  para text not null check (para in ('bebe', 'mae')),
  -- Código da dose no calendário do app (ex.: 'penta-1'); null para vacinas fora do calendário.
  codigo text check (char_length(codigo) <= 40),
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  data date not null,
  local text check (char_length(local) <= 120),
  lote text check (char_length(lote) <= 40),
  observacao text check (char_length(observacao) <= 500),
  criado_em timestamptz not null default now()
);

create index vacinas_aplicadas_bebe_idx on public.vacinas_aplicadas (bebe_id, para);
create unique index vacinas_aplicadas_dose_unica on public.vacinas_aplicadas (bebe_id, para, codigo) where codigo is not null;

alter table public.vacinas_aplicadas enable row level security;

create policy "membros veem as vacinas" on public.vacinas_aplicadas for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros registram vacinas" on public.vacinas_aplicadas for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros editam vacinas" on public.vacinas_aplicadas for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros apagam vacinas" on public.vacinas_aplicadas for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.vacinas_aplicadas from anon;
revoke update on public.vacinas_aplicadas from authenticated;
grant update (nome, data, local, lote, observacao) on public.vacinas_aplicadas to authenticated;

alter publication supabase_realtime add table public.vacinas_aplicadas;
