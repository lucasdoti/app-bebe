-- Ficha de saúde do bebê: teste do pezinho, condições, remédios e alimentos a evitar, alergias.
-- As listas são digitadas pela família a partir do que o médico ou o serviço de triagem entregou;
-- o app não traz listas prontas (as listas que circulam divergem entre si).

create table public.saude_itens (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  tipo text not null check (tipo in ('pezinho', 'condicao', 'evitar_remedio', 'evitar_alimento', 'alergia', 'fonte')),
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  -- pezinho: pendente | normal | alterado. condicao: investigacao | confirmado | descartado.
  status text check (status in ('pendente', 'normal', 'alterado', 'investigacao', 'confirmado', 'descartado')),
  data date,
  detalhe text check (char_length(detalhe) <= 500),
  criado_em timestamptz not null default now()
);

create index saude_itens_bebe_idx on public.saude_itens (bebe_id, tipo);

alter table public.saude_itens enable row level security;

create policy "membros veem a ficha de saúde" on public.saude_itens for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros preenchem a ficha de saúde" on public.saude_itens for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros editam a ficha de saúde" on public.saude_itens for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros apagam itens da ficha de saúde" on public.saude_itens for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.saude_itens from anon;
revoke update on public.saude_itens from authenticated;
grant update (nome, status, data, detalhe) on public.saude_itens to authenticated;

alter publication supabase_realtime add table public.saude_itens;
