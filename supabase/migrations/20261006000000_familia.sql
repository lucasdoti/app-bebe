-- Etapa 1: família, membros e convite.
-- Regra de acesso: o usuário só enxerga a família da qual é membro.
-- Criar, entrar e sair da família só acontece pelas funções abaixo (nada de insert direto).

create table public.familias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 1 and 60),
  codigo_convite text not null unique,
  criado_por uuid not null references auth.users (id),
  criado_em timestamptz not null default now()
);

create table public.membros (
  familia_id uuid not null references public.familias (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 40),
  papel text not null check (papel in ('mae', 'pai', 'outro')),
  entrou_em timestamptz not null default now(),
  primary key (familia_id, user_id)
);

-- Na V1 cada pessoa participa de uma família só.
create unique index membros_um_por_usuario on public.membros (user_id);

-- Famílias do usuário logado. security definer evita recursão nas políticas de membros.
create function public.minhas_familias()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select familia_id from public.membros where user_id = (select auth.uid());
$$;

alter table public.familias enable row level security;
alter table public.membros enable row level security;

create policy "membros veem a própria família"
  on public.familias for select to authenticated
  using (id in (select public.minhas_familias()));

create policy "membros renomeiam a própria família"
  on public.familias for update to authenticated
  using (id in (select public.minhas_familias()))
  with check (id in (select public.minhas_familias()));

create policy "membros veem quem está na família"
  on public.membros for select to authenticated
  using (familia_id in (select public.minhas_familias()));

create policy "cada um edita o próprio nome e papel"
  on public.membros for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Só as colunas editáveis podem mudar (código de convite e vínculo com a família, não).
revoke insert, update, delete on public.familias from anon, authenticated;
revoke insert, update, delete on public.membros from anon, authenticated;
revoke select on public.familias, public.membros from anon;
grant update (nome) on public.familias to authenticated;
grant update (nome, papel) on public.membros to authenticated;

-- Código no formato BEBE-XXXXXX, sem letras ambíguas (0/O, 1/I).
create function public.gerar_codigo_convite()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea;
  codigo text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    codigo := 'BEBE-';
    for i in 0..5 loop
      codigo := codigo || substr(alfabeto, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.familias where codigo_convite = codigo);
  end loop;
  return codigo;
end;
$$;

revoke execute on function public.gerar_codigo_convite() from public, anon, authenticated;

create function public.criar_familia(p_nome_familia text, p_meu_nome text, p_papel text)
returns public.familias
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  nova public.familias;
begin
  if uid is null then
    raise exception 'Faça login para criar a família.';
  end if;
  if exists (select 1 from public.membros where user_id = uid) then
    raise exception 'Você já faz parte de uma família.';
  end if;

  insert into public.familias (nome, codigo_convite, criado_por)
  values (trim(p_nome_familia), public.gerar_codigo_convite(), uid)
  returning * into nova;

  insert into public.membros (familia_id, user_id, nome, papel)
  values (nova.id, uid, trim(p_meu_nome), p_papel);

  return nova;
end;
$$;

create function public.entrar_familia(p_codigo text, p_meu_nome text, p_papel text)
returns public.familias
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  alvo public.familias;
begin
  if uid is null then
    raise exception 'Faça login para entrar na família.';
  end if;
  if exists (select 1 from public.membros where user_id = uid) then
    raise exception 'Você já faz parte de uma família.';
  end if;

  -- Aceita "BEBE-7K2X9P", "bebe 7k2x9p" ou só "7K2X9P".
  if codigo not like 'BEBE%' then
    codigo := 'BEBE' || codigo;
  end if;
  codigo := 'BEBE-' || substr(codigo, 5);

  select * into alvo from public.familias where codigo_convite = codigo;
  if alvo.id is null then
    raise exception 'Código de convite não encontrado.';
  end if;

  insert into public.membros (familia_id, user_id, nome, papel)
  values (alvo.id, uid, trim(p_meu_nome), p_papel);

  return alvo;
end;
$$;

-- Sai da família; se ninguém mais ficar, a família é apagada.
create function public.sair_familia()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  delete from public.membros where user_id = uid returning familia_id into fid;
  if fid is not null and not exists (select 1 from public.membros where familia_id = fid) then
    delete from public.familias where id = fid;
  end if;
end;
$$;

revoke execute on function public.criar_familia(text, text, text) from public, anon;
revoke execute on function public.entrar_familia(text, text, text) from public, anon;
revoke execute on function public.sair_familia() from public, anon;
grant execute on function public.criar_familia(text, text, text) to authenticated;
grant execute on function public.entrar_familia(text, text, text) to authenticated;
grant execute on function public.sair_familia() to authenticated;

-- Realtime: quem criou a família vê na hora quando o outro responsável entra.
alter publication supabase_realtime add table public.membros;
