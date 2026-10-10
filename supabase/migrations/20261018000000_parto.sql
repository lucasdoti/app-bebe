-- "Chegou a hora": contatos do parto e plano de parto.

create table public.contatos_parto (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  papel text not null check (papel in ('obstetra', 'maternidade', 'doula', 'pediatra', 'outro')),
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  telefone text check (char_length(telefone) <= 30),
  endereco text check (char_length(endereco) <= 200),
  observacao text check (char_length(observacao) <= 300),
  criado_em timestamptz not null default now()
);

create index contatos_parto_bebe_idx on public.contatos_parto (bebe_id);

-- Preferências do plano de parto: sim, não ou "a decidir" (null).
create table public.plano_parto_itens (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  grupo text not null check (grupo in ('trabalho', 'parto', 'bebe', 'pos')),
  texto text not null check (char_length(trim(texto)) between 1 and 160),
  preferencia text check (preferencia in ('sim', 'nao')),
  criado_em timestamptz not null default now()
);

create index plano_parto_itens_bebe_idx on public.plano_parto_itens (bebe_id);

alter table public.contatos_parto enable row level security;
alter table public.plano_parto_itens enable row level security;

create policy "membros veem os contatos do parto" on public.contatos_parto for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros cadastram contatos do parto" on public.contatos_parto for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros editam contatos do parto" on public.contatos_parto for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros apagam contatos do parto" on public.contatos_parto for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

create policy "membros veem o plano de parto" on public.plano_parto_itens for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros montam o plano de parto" on public.plano_parto_itens for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()));
create policy "membros editam o plano de parto" on public.plano_parto_itens for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros apagam itens do plano de parto" on public.plano_parto_itens for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.contatos_parto, public.plano_parto_itens from anon;
revoke update on public.contatos_parto, public.plano_parto_itens from authenticated;
grant update (papel, nome, telefone, endereco, observacao) on public.contatos_parto to authenticated;
grant update (grupo, texto, preferencia) on public.plano_parto_itens to authenticated;

alter publication supabase_realtime add table public.contatos_parto;
alter publication supabase_realtime add table public.plano_parto_itens;
