-- Link do produto nos itens do enxoval (principalmente no "Falta"), também mostrado na página do chá.
-- Só http/https: evita links que executam código ao serem abertos.

alter table public.enxoval_itens
  add column link text check (link is null or (char_length(link) <= 500 and link ~* '^https?://'));

grant update (link) on public.enxoval_itens to authenticated;

-- A página do chá passa a mandar o link de cada item.
create or replace function public.cha_publico(p_token text)
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
        'link', i.link,
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
