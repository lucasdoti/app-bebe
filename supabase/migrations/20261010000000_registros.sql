-- Etapa 3: registros de rotina (mamada, mamadeira, refeição, sono, fralda).
-- Uma tabela só, com os detalhes de cada tipo em json (PRD: "Modelo de dados").
-- O id é gerado no aparelho, para o registro poder ser criado sem internet e sincronizado depois.

create table public.registros (
  id uuid primary key,
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  tipo text not null check (tipo in ('mamada', 'mamadeira', 'refeicao', 'sono', 'fralda')),
  inicio timestamptz not null,
  -- null = em andamento (sono ou peito). Registros instantâneos usam fim = inicio.
  fim timestamptz check (fim is null or fim >= inicio),
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index registros_bebe_inicio_idx on public.registros (bebe_id, inicio desc);

-- Bebês das famílias do usuário logado.
create function public.meus_bebes()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id from public.bebes b
  where b.familia_id in (select familia_id from public.membros where user_id = (select auth.uid()));
$$;

alter table public.registros enable row level security;

create policy "membros veem os registros dos bebês da família"
  on public.registros for select to authenticated
  using (bebe_id in (select public.meus_bebes()));

create policy "membros registram para os bebês da família"
  on public.registros for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));

create policy "membros editam os registros dos bebês da família"
  on public.registros for update to authenticated
  using (bebe_id in (select public.meus_bebes()))
  with check (bebe_id in (select public.meus_bebes()));

create policy "membros apagam os registros dos bebês da família"
  on public.registros for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.registros from anon;
revoke update on public.registros from authenticated;
grant update (inicio, fim, detalhes) on public.registros to authenticated;

create function public.marcar_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger registros_atualizado_em
  before update on public.registros
  for each row execute function public.marcar_atualizacao();

-- Realtime: o registro feito por um aparece no celular do outro em segundos.
alter publication supabase_realtime add table public.registros;
