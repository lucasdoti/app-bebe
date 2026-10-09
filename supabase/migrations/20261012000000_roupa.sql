-- Etapa 5: calibração da sugestão de roupa por bebê.
-- Cada feedback (frio, ok, calor) ajusta o "ajuste pessoal" do bebê naquele contexto,
-- entre -1,5 e +1,5 camadas: frio soma 0,25 e calor subtrai 0,25 (PRD: "Aprendizado com feedback").
-- O contexto "passeio" vale para o dia (em casa e passeio); "sono" para quando dorme.

create table public.roupa_feedback (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  data timestamptz not null default now(),
  contexto text not null check (contexto in ('passeio', 'sono')),
  sensacao_c numeric(4, 1),
  sugestao text,
  resultado text not null check (resultado in ('frio', 'ok', 'calor'))
);

create index roupa_feedback_bebe_idx on public.roupa_feedback (bebe_id, data desc);

create table public.roupa_ajuste (
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  contexto text not null check (contexto in ('passeio', 'sono')),
  ajuste_camadas numeric(3, 2) not null default 0 check (ajuste_camadas between -1.5 and 1.5),
  atualizado_em timestamptz not null default now(),
  primary key (bebe_id, contexto)
);

alter table public.roupa_feedback enable row level security;
alter table public.roupa_ajuste enable row level security;

create policy "membros veem o feedback de roupa dos bebês da família"
  on public.roupa_feedback for select to authenticated
  using (bebe_id in (select public.meus_bebes()));

create policy "membros veem o ajuste de roupa dos bebês da família"
  on public.roupa_ajuste for select to authenticated
  using (bebe_id in (select public.meus_bebes()));

-- Gravação só pela função abaixo, que mantém feedback e ajuste coerentes.
revoke all on public.roupa_feedback, public.roupa_ajuste from anon;
revoke insert, update, delete on public.roupa_feedback, public.roupa_ajuste from authenticated;

create function public.registrar_feedback_roupa(
  p_bebe uuid,
  p_contexto text,
  p_sensacao numeric,
  p_sugestao text,
  p_resultado text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta numeric := case p_resultado when 'frio' then 0.25 when 'calor' then -0.25 else 0 end;
  novo numeric;
begin
  if p_bebe not in (select public.meus_bebes()) then
    raise exception 'Bebê não encontrado na sua família.';
  end if;

  insert into public.roupa_feedback (bebe_id, autor_id, contexto, sensacao_c, sugestao, resultado)
  values (p_bebe, auth.uid(), p_contexto, p_sensacao, p_sugestao, p_resultado);

  insert into public.roupa_ajuste (bebe_id, contexto, ajuste_camadas)
  values (p_bebe, p_contexto, greatest(-1.5, least(1.5, delta)))
  on conflict (bebe_id, contexto) do update
    set ajuste_camadas = greatest(-1.5, least(1.5, public.roupa_ajuste.ajuste_camadas + delta)),
        atualizado_em = now()
  returning ajuste_camadas into novo;

  return novo;
end;
$$;

revoke execute on function public.registrar_feedback_roupa(uuid, text, numeric, text, text) from public, anon;
grant execute on function public.registrar_feedback_roupa(uuid, text, numeric, text, text) to authenticated;

-- Realtime: a calibração feita por um vale na hora para o outro.
alter publication supabase_realtime add table public.roupa_ajuste;
