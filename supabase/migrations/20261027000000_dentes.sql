-- Dentinhos: data em que cada dente de leite nasceu (sem fotos, por privacidade).
-- codigo identifica o dente no mapa da boca (ex.: 'inf-esq-1' = incisivo central de baixo, lado esquerdo do bebê).

create table public.dentes (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  codigo text not null check (codigo ~ '^(sup|inf)-(dir|esq)-[1-5]$'),
  nasceu_em date not null,
  observacao text check (char_length(observacao) <= 300),
  criado_em timestamptz not null default now(),
  unique (bebe_id, codigo)
);

alter table public.dentes enable row level security;

create policy "membros veem os dentes" on public.dentes for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros marcam dentes" on public.dentes for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros editam dentes" on public.dentes for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros desmarcam dentes" on public.dentes for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.dentes from anon;
revoke update on public.dentes from authenticated;
grant update (nasceu_em, observacao) on public.dentes to authenticated;

alter publication supabase_realtime add table public.dentes;
