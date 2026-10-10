-- Chá de bebê: página pública (por link secreto, sem login) com a lista do que falta e reservas de presente.
-- Convidados nunca leem tabelas: só as funções cha_publico, cha_reservar e cha_desfazer, que exigem o token do link.

-- Os pais escolhem quais itens do "Falta" aparecem no chá.
alter table public.enxoval_itens add column no_cha boolean not null default true;
grant update (no_cha) on public.enxoval_itens to authenticated;

create table public.cha_bebe (
  bebe_id uuid primary key references public.bebes (id) on delete cascade,
  -- Segredo do link (gerado no app, 32 caracteres aleatórios).
  token text not null unique check (char_length(token) >= 24),
  ativo boolean not null default true,
  data_evento timestamptz,
  local text check (char_length(local) <= 160),
  mensagem text check (char_length(mensagem) <= 500),
  pix text check (char_length(pix) <= 100),
  criado_em timestamptz not null default now()
);

create table public.cha_reservas (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.enxoval_itens (id) on delete cascade,
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 60),
  quantidade integer not null check (quantidade between 1 and 99),
  mensagem text check (char_length(mensagem) <= 300),
  -- Para o próprio convidado desfazer a reserva (fica no aparelho dele).
  codigo text not null,
  criado_em timestamptz not null default now()
);

create index cha_reservas_item_idx on public.cha_reservas (item_id);
create index cha_reservas_bebe_idx on public.cha_reservas (bebe_id);

alter table public.cha_bebe enable row level security;
alter table public.cha_reservas enable row level security;

create policy "membros veem o chá" on public.cha_bebe for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros criam o chá" on public.cha_bebe for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()));
create policy "membros editam o chá" on public.cha_bebe for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros apagam o chá" on public.cha_bebe for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

create policy "membros veem as reservas" on public.cha_reservas for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros cancelam reservas" on public.cha_reservas for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.cha_bebe, public.cha_reservas from anon;
revoke update on public.cha_bebe from authenticated;
revoke insert, update on public.cha_reservas from authenticated;
grant update (token, ativo, data_evento, local, mensagem, pix) on public.cha_bebe to authenticated;

-- Página do convidado: nome do bebê, dados do chá e os itens com quanto ainda falta reservar.
create function public.cha_publico(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.cha_bebe;
  resultado jsonb;
begin
  select * into c from public.cha_bebe where token = p_token and ativo;
  if c.bebe_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'nome', b.nome,
    'data_evento', c.data_evento,
    'local', c.local,
    'mensagem', c.mensagem,
    'pix', c.pix,
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'categoria', i.categoria,
        'nome', i.nome,
        'tamanho', i.tamanho,
        'prioridade', i.prioridade,
        'quantidade', i.quantidade,
        'reservados', coalesce((select sum(r.quantidade) from public.cha_reservas r where r.item_id = i.id), 0)
      ) order by (i.prioridade = 'essencial') desc nulls last, i.criado_em)
      from public.enxoval_itens i
      where i.bebe_id = c.bebe_id and i.falta and i.no_cha and i.quantidade > 0
    ), '[]'::jsonb)
  ) into resultado
  from public.bebes b
  where b.id = c.bebe_id;

  return resultado;
end;
$$;

-- Reserva de um presente. Confere o link, o item e se ainda há quantidade livre.
create function public.cha_reservar(p_token text, p_item uuid, p_nome text, p_quantidade integer, p_mensagem text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cha_bebe;
  item public.enxoval_itens;
  reservados integer;
  nova public.cha_reservas;
begin
  select * into c from public.cha_bebe where token = p_token and ativo;
  if c.bebe_id is null then
    raise exception 'Este link de chá de bebê não está mais ativo.';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Escreva seu nome para os pais saberem quem vai dar.';
  end if;

  -- Trava o item para duas pessoas não reservarem a última unidade ao mesmo tempo.
  select * into item from public.enxoval_itens
  where id = p_item and bebe_id = c.bebe_id and falta and no_cha
  for update;
  if item.id is null then
    raise exception 'Este item não está mais na lista.';
  end if;

  select coalesce(sum(quantidade), 0) into reservados from public.cha_reservas where item_id = item.id;
  if p_quantidade is null or p_quantidade < 1 or reservados + p_quantidade > item.quantidade then
    raise exception 'Alguém já reservou este presente. Escolha outro da lista.';
  end if;

  insert into public.cha_reservas (item_id, bebe_id, nome, quantidade, mensagem, codigo)
  values (item.id, c.bebe_id, left(trim(p_nome), 60), p_quantidade, nullif(left(trim(coalesce(p_mensagem, '')), 300), ''),
          encode(extensions.gen_random_bytes(12), 'hex'))
  returning * into nova;

  return jsonb_build_object('id', nova.id, 'codigo', nova.codigo);
end;
$$;

-- O convidado desfaz a própria reserva com o código que ficou no aparelho dele.
create function public.cha_desfazer(p_token text, p_reserva uuid, p_codigo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cha_bebe;
begin
  select * into c from public.cha_bebe where token = p_token and ativo;
  if c.bebe_id is null then
    return false;
  end if;
  delete from public.cha_reservas where id = p_reserva and codigo = p_codigo and bebe_id = c.bebe_id;
  return found;
end;
$$;

revoke execute on function public.cha_publico(text) from public;
revoke execute on function public.cha_reservar(text, uuid, text, integer, text) from public;
revoke execute on function public.cha_desfazer(text, uuid, text) from public;
grant execute on function public.cha_publico(text) to anon, authenticated;
grant execute on function public.cha_reservar(text, uuid, text, integer, text) to anon, authenticated;
grant execute on function public.cha_desfazer(text, uuid, text) to anon, authenticated;

alter publication supabase_realtime add table public.cha_reservas;
alter publication supabase_realtime add table public.cha_bebe;
