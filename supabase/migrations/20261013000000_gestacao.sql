-- Gestação: o bebê pode ser cadastrado antes de nascer ("a caminho").
-- No parto, o mesmo cadastro passa a "nascido" e mantém o histórico da gestação.

alter table public.bebes
  add column status text not null default 'nascido' check (status in ('gestacao', 'nascido')),
  add column parto_previsto date;

alter table public.bebes alter column nascimento drop not null;
alter table public.bebes alter column sexo drop not null;

alter table public.bebes
  add constraint bebes_nascido_completo check (status = 'gestacao' or (nascimento is not null and sexo is not null)),
  add constraint bebes_gestacao_com_parto check (status = 'nascido' or parto_previsto is not null);

grant update (status, parto_previsto) on public.bebes to authenticated;

-- Contrações entram na tabela de registros (cronômetro compartilhado e offline).
alter table public.registros drop constraint registros_tipo_check;
alter table public.registros
  add constraint registros_tipo_check
  check (tipo in ('mamada', 'mamadeira', 'refeicao', 'sono', 'fralda', 'contracao'));

-- Pré-natal: consultas, exames e ultrassons (com as medidas do laudo).
create table public.pre_natal (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  tipo text not null check (tipo in ('consulta', 'exame', 'ultrassom')),
  data timestamptz not null,
  titulo text not null check (char_length(trim(titulo)) between 1 and 80),
  local text check (char_length(local) <= 120),
  anotacoes text check (char_length(anotacoes) <= 4000),
  perguntas text check (char_length(perguntas) <= 2000),
  peso_fetal_g integer check (peso_fetal_g between 1 and 6000),
  comprimento_cm numeric(4, 1) check (comprimento_cm between 0.1 and 65),
  batimentos_bpm integer check (batimentos_bpm between 50 and 250),
  percentil_laudo numeric(4, 1) check (percentil_laudo between 0 and 100),
  criado_em timestamptz not null default now()
);

create index pre_natal_bebe_data_idx on public.pre_natal (bebe_id, data);

-- Mala da maternidade: checklist compartilhado.
create table public.mala_itens (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  grupo text not null check (grupo in ('mae', 'bebe', 'documentos', 'acompanhante')),
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  feito boolean not null default false,
  criado_em timestamptz not null default now()
);

create index mala_itens_bebe_idx on public.mala_itens (bebe_id);

alter table public.pre_natal enable row level security;
alter table public.mala_itens enable row level security;

create policy "membros veem o pré-natal" on public.pre_natal for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros registram o pré-natal" on public.pre_natal for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros editam o pré-natal" on public.pre_natal for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros apagam o pré-natal" on public.pre_natal for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

create policy "membros veem a mala" on public.mala_itens for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros montam a mala" on public.mala_itens for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()));
create policy "membros marcam a mala" on public.mala_itens for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros tiram itens da mala" on public.mala_itens for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.pre_natal, public.mala_itens from anon;
revoke update on public.pre_natal, public.mala_itens from authenticated;
grant update (tipo, data, titulo, local, anotacoes, perguntas, peso_fetal_g, comprimento_cm, batimentos_bpm, percentil_laudo)
  on public.pre_natal to authenticated;
grant update (nome, feito, grupo) on public.mala_itens to authenticated;

alter publication supabase_realtime add table public.pre_natal;
alter publication supabase_realtime add table public.mala_itens;
