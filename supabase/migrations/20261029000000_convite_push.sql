-- Correções da auditoria de 2026-11-05 (SEG-001 e SEG-002).
-- Convite: limite de tentativas erradas, troca do código e remoção de membro.
-- Push: só aceita endereços dos serviços de push conhecidos, com no máximo 5 aparelhos por pessoa.

-- Tentativas erradas de código de convite. Só as funções abaixo usam esta tabela.
create table public.convite_tentativas (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  em timestamptz not null default now()
);

create index convite_tentativas_user_idx on public.convite_tentativas (user_id, em);

alter table public.convite_tentativas enable row level security;
revoke all on public.convite_tentativas from anon, authenticated;

-- Código errado devolve vazio em vez de erro: um "raise" desfaria o registro da tentativa.
-- O app mostra "Código de convite não encontrado" quando a resposta vem sem família.
create or replace function public.entrar_familia(p_codigo text, p_meu_nome text, p_papel text)
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

  -- Uma chamada por vez para cada pessoa: tentativas em paralelo não furam o limite.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  delete from public.convite_tentativas where user_id = uid and em < now() - interval '1 hour';
  if (select count(*) from public.convite_tentativas where user_id = uid) >= 10 then
    raise exception 'Muitas tentativas com código errado. Espere uma hora e tente de novo.';
  end if;

  -- Aceita "BEBE-7K2X9P", "bebe 7k2x9p" ou só "7K2X9P".
  if codigo not like 'BEBE%' then
    codigo := 'BEBE' || codigo;
  end if;
  codigo := 'BEBE-' || substr(codigo, 5);

  select * into alvo from public.familias where codigo_convite = codigo;
  if alvo.id is null then
    insert into public.convite_tentativas (user_id) values (uid);
    return null;
  end if;

  insert into public.membros (familia_id, user_id, nome, papel)
  values (alvo.id, uid, trim(p_meu_nome), p_papel);

  return alvo;
end;
$$;

-- Gera um código novo; o antigo para de funcionar na hora.
create function public.novo_codigo_convite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
  novo text;
begin
  select familia_id into fid from public.membros where user_id = auth.uid();
  if fid is null then
    raise exception 'Você não faz parte de uma família.';
  end if;
  novo := public.gerar_codigo_convite();
  update public.familias set codigo_convite = novo where id = fid;
  return novo;
end;
$$;

-- Remove outro membro e troca o código: quem saiu não pode voltar com o código que já conhecia.
-- Quem criou a família não pode ser removido, para um invasor não expulsar os pais.
create function public.remover_membro(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
  novo text;
begin
  select familia_id into fid from public.membros where user_id = uid;
  if fid is null then
    raise exception 'Você não faz parte de uma família.';
  end if;
  if p_user_id = uid then
    raise exception 'Para sair da família, use "Sair da família".';
  end if;
  if exists (select 1 from public.familias where id = fid and criado_por = p_user_id) then
    raise exception 'Quem criou a família não pode ser removido.';
  end if;

  delete from public.membros where familia_id = fid and user_id = p_user_id;
  if not found then
    raise exception 'Essa pessoa não faz parte da sua família.';
  end if;

  novo := public.gerar_codigo_convite();
  update public.familias set codigo_convite = novo where id = fid;
  return novo;
end;
$$;

revoke execute on function public.novo_codigo_convite() from public, anon;
revoke execute on function public.remover_membro(uuid) from public, anon;
grant execute on function public.novo_codigo_convite() to authenticated;
grant execute on function public.remover_membro(uuid) to authenticated;

-- Push: a mesma lista de serviços está na Edge Function enviar-lembretes.
create or replace function public.salvar_inscricao_push(p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Faça login para ativar as notificações.';
  end if;
  if char_length(p_endpoint) > 1000
    or p_endpoint !~* '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|notify\.windows\.com)(:[0-9]+)?/'
  then
    raise exception 'Este navegador usa um serviço de notificações que o app não reconhece.';
  end if;
  if char_length(p_p256dh) > 200 or char_length(p_auth) > 100 then
    raise exception 'Inscrição de notificação inválida.';
  end if;

  insert into public.push_inscricoes (endpoint, user_id, p256dh, auth, dispositivo)
  values (p_endpoint, uid, p_p256dh, p_auth, left(p_dispositivo, 200))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        dispositivo = excluded.dispositivo, criado_em = now();

  -- No máximo 5 aparelhos por pessoa: o mais antigo sai.
  delete from public.push_inscricoes
  where user_id = uid
    and endpoint not in (
      select endpoint from public.push_inscricoes where user_id = uid order by criado_em desc, endpoint limit 5
    );
end;
$$;
