-- Enxoval: o que a família já tem para o bebê (roupas por tamanho, higiene, quarto, passeio...).

create table public.enxoval_itens (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  categoria text not null check (categoria in ('roupa', 'higiene', 'quarto', 'passeio', 'alimentacao', 'outros')),
  nome text not null check (char_length(trim(nome)) between 1 and 60),
  -- Só para roupas: RN, P, M, G, GG, 1, 2, 3.
  tamanho text check (tamanho in ('RN', 'P', 'M', 'G', 'GG', '1', '2', '3')),
  quantidade integer not null default 1 check (quantidade between 0 and 999),
  criado_em timestamptz not null default now()
);

create index enxoval_itens_bebe_idx on public.enxoval_itens (bebe_id);

alter table public.enxoval_itens enable row level security;

create policy "membros veem o enxoval" on public.enxoval_itens for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros adicionam ao enxoval" on public.enxoval_itens for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros editam o enxoval" on public.enxoval_itens for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros tiram itens do enxoval" on public.enxoval_itens for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.enxoval_itens from anon;
revoke update on public.enxoval_itens from authenticated;
grant update (categoria, nome, tamanho, quantidade) on public.enxoval_itens to authenticated;

alter publication supabase_realtime add table public.enxoval_itens;
