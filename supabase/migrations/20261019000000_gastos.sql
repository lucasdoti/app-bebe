-- Gastos do enxoval: compras (com forma de pagamento e parcelas) e presentes (com quem deu).

create table public.enxoval_gastos (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  tipo text not null check (tipo in ('compra', 'presente')),
  descricao text not null check (char_length(trim(descricao)) between 1 and 100),
  -- Compra: valor total pago. Presente: opcional (valor estimado), não entra no total gasto.
  valor numeric(10, 2) check (valor >= 0 and valor <= 1000000),
  data date not null,
  categoria text check (categoria in ('roupa', 'higiene', 'quarto', 'passeio', 'alimentacao', 'outros')),
  forma_pagamento text check (forma_pagamento in ('pix', 'debito', 'credito', 'dinheiro', 'boleto')),
  parcelas integer check (parcelas between 1 and 24),
  quem_deu text check (char_length(quem_deu) <= 80),
  agradecido boolean not null default false,
  criado_em timestamptz not null default now(),
  check (tipo <> 'compra' or (valor is not null and valor > 0)),
  check (tipo <> 'presente' or quem_deu is not null),
  check (forma_pagamento = 'credito' or parcelas is null or parcelas = 1)
);

create index enxoval_gastos_bebe_idx on public.enxoval_gastos (bebe_id, data);

-- Orçamento opcional do enxoval, um por bebê.
create table public.enxoval_orcamento (
  bebe_id uuid primary key references public.bebes (id) on delete cascade,
  valor numeric(10, 2) not null check (valor > 0 and valor <= 1000000),
  atualizado_em timestamptz not null default now()
);

alter table public.enxoval_gastos enable row level security;
alter table public.enxoval_orcamento enable row level security;

create policy "membros veem os gastos" on public.enxoval_gastos for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros lançam gastos" on public.enxoval_gastos for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros editam gastos" on public.enxoval_gastos for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros apagam gastos" on public.enxoval_gastos for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

create policy "membros veem o orçamento" on public.enxoval_orcamento for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros definem o orçamento" on public.enxoval_orcamento for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()));
create policy "membros mudam o orçamento" on public.enxoval_orcamento for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros tiram o orçamento" on public.enxoval_orcamento for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.enxoval_gastos, public.enxoval_orcamento from anon;
revoke update on public.enxoval_gastos, public.enxoval_orcamento from authenticated;
grant update (tipo, descricao, valor, data, categoria, forma_pagamento, parcelas, quem_deu, agradecido)
  on public.enxoval_gastos to authenticated;
grant update (valor, atualizado_em) on public.enxoval_orcamento to authenticated;

alter publication supabase_realtime add table public.enxoval_gastos;
alter publication supabase_realtime add table public.enxoval_orcamento;
