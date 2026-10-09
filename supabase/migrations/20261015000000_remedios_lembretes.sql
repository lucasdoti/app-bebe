-- Etapa 6: remédios, febre e lembretes por Web Push.

-- Doses dadas e medições de febre entram na tabela de registros (offline e em tempo real).
alter table public.registros drop constraint registros_tipo_check;
alter table public.registros
  add constraint registros_tipo_check
  check (tipo in ('mamada', 'mamadeira', 'refeicao', 'sono', 'fralda', 'contracao', 'movimentos', 'dose', 'febre'));

create index registros_dose_idx on public.registros ((detalhes ->> 'remedio_id')) where tipo = 'dose';

-- Remédios prescritos. O app não calcula dose: os pais informam o que o pediatra receitou.
create table public.remedios (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  nome text not null check (char_length(trim(nome)) between 1 and 60),
  dose text not null check (char_length(trim(dose)) between 1 and 60),
  intervalo_h numeric(4, 1) not null check (intervalo_h between 0.5 and 72),
  inicio timestamptz not null default now(),
  -- null = sem data para acabar.
  duracao_dias integer check (duracao_dias between 1 and 365),
  ativo boolean not null default true,
  -- Controle do servidor para não repetir o mesmo aviso.
  ultimo_aviso timestamptz,
  criado_em timestamptz not null default now()
);

create index remedios_bebe_idx on public.remedios (bebe_id) where ativo;

-- Lembretes: de mamada ("faz 3h desde a última") e personalizados (consulta, banho de sol...).
create table public.lembretes (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  tipo text not null check (tipo in ('mamada', 'personalizado')),
  titulo text not null check (char_length(trim(titulo)) between 1 and 80),
  proximo_em timestamptz,
  recorrencia text not null default 'nenhuma' check (recorrencia in ('nenhuma', 'diaria', 'semanal')),
  intervalo_min integer check (intervalo_min between 30 and 720),
  ativo boolean not null default true,
  -- Controle do servidor: último registro que já gerou aviso de mamada.
  ultimo_ref uuid,
  criado_em timestamptz not null default now(),
  check (tipo <> 'mamada' or intervalo_min is not null),
  check (tipo <> 'personalizado' or proximo_em is not null)
);

create unique index lembretes_mamada_unico on public.lembretes (bebe_id) where tipo = 'mamada';

-- Aviso da véspera das consultas e exames do pré-natal.
alter table public.pre_natal add column lembrete_enviado boolean not null default false;

-- Inscrições de Web Push de cada aparelho.
create table public.push_inscricoes (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  dispositivo text,
  criado_em timestamptz not null default now()
);

create index push_inscricoes_user_idx on public.push_inscricoes (user_id);

alter table public.remedios enable row level security;
alter table public.lembretes enable row level security;
alter table public.push_inscricoes enable row level security;

create policy "membros veem os remédios" on public.remedios for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros cadastram remédios" on public.remedios for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros editam remédios" on public.remedios for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros apagam remédios" on public.remedios for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

create policy "membros veem os lembretes" on public.lembretes for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros criam lembretes" on public.lembretes for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros editam lembretes" on public.lembretes for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros apagam lembretes" on public.lembretes for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

create policy "cada um vê as próprias inscrições" on public.push_inscricoes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "cada um apaga as próprias inscrições" on public.push_inscricoes for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.remedios, public.lembretes, public.push_inscricoes from anon;
revoke update on public.remedios, public.lembretes from authenticated;
revoke insert, update on public.push_inscricoes from authenticated;
grant update (nome, dose, intervalo_h, inicio, duracao_dias, ativo) on public.remedios to authenticated;
grant update (titulo, proximo_em, recorrencia, intervalo_min, ativo) on public.lembretes to authenticated;

-- Salva a inscrição deste aparelho para o usuário logado (o mesmo navegador pode trocar de conta).
create function public.salvar_inscricao_push(p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Faça login para ativar as notificações.';
  end if;
  insert into public.push_inscricoes (endpoint, user_id, p256dh, auth, dispositivo)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_dispositivo, 200))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        dispositivo = excluded.dispositivo, criado_em = now();
end;
$$;

revoke execute on function public.salvar_inscricao_push(text, text, text, text) from public, anon;
grant execute on function public.salvar_inscricao_push(text, text, text, text) to authenticated;

alter publication supabase_realtime add table public.remedios;
alter publication supabase_realtime add table public.lembretes;
