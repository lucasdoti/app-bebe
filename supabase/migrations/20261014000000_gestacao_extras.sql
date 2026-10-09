-- Gestação, parte 2: peso e pressão da mãe, contagem de movimentos e lista de nomes.

-- Peso e pressão da mãe anotados nas consultas.
alter table public.pre_natal
  add column peso_mae_kg numeric(5, 2) check (peso_mae_kg between 30 and 200),
  add column pressao_sistolica integer check (pressao_sistolica between 60 and 250),
  add column pressao_diastolica integer check (pressao_diastolica between 30 and 160);

grant update (peso_mae_kg, pressao_sistolica, pressao_diastolica) on public.pre_natal to authenticated;

-- Contagem de movimentos do bebê vira um tipo de registro (funciona offline e é compartilhada).
alter table public.registros drop constraint registros_tipo_check;
alter table public.registros
  add constraint registros_tipo_check
  check (tipo in ('mamada', 'mamadeira', 'refeicao', 'sono', 'fralda', 'contracao', 'movimentos'));

-- Lista de nomes com votos de cada responsável.
create table public.nomes (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  nome text not null check (char_length(trim(nome)) between 1 and 40),
  sexo text check (sexo in ('F', 'M')),
  criado_em timestamptz not null default now(),
  unique (bebe_id, nome)
);

-- valor: 2 = amo, 1 = gosto, -1 = não gosto. Cada pessoa vota uma vez por nome.
create table public.nomes_votos (
  nome_id uuid not null references public.nomes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  valor smallint not null check (valor in (-1, 1, 2)),
  atualizado_em timestamptz not null default now(),
  primary key (nome_id, user_id)
);

alter table public.nomes enable row level security;
alter table public.nomes_votos enable row level security;

create policy "membros veem os nomes" on public.nomes for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros sugerem nomes" on public.nomes for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros tiram nomes da lista" on public.nomes for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

create policy "membros veem os votos" on public.nomes_votos for select to authenticated
  using (nome_id in (select id from public.nomes where bebe_id in (select public.meus_bebes())));
create policy "cada um vota por si" on public.nomes_votos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and nome_id in (select id from public.nomes where bebe_id in (select public.meus_bebes()))
  );
create policy "cada um muda o próprio voto" on public.nomes_votos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cada um tira o próprio voto" on public.nomes_votos for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.nomes, public.nomes_votos from anon;
revoke update on public.nomes, public.nomes_votos from authenticated;
grant update (valor, atualizado_em) on public.nomes_votos to authenticated;

alter publication supabase_realtime add table public.nomes;
alter publication supabase_realtime add table public.nomes_votos;
