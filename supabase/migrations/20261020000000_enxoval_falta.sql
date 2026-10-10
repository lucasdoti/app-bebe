-- Enxoval: lista do que ainda falta. Quando a família consegue o item, ele passa para "já temos".

alter table public.enxoval_itens
  add column falta boolean not null default false,
  add column prioridade text check (prioridade in ('essencial', 'bom'));

create index enxoval_itens_falta_idx on public.enxoval_itens (bebe_id, falta);

grant update (falta, prioridade) on public.enxoval_itens to authenticated;
