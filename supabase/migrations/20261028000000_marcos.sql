-- Marcos do bebê: "primeiras vezes" (lembranças, sem fotos) e marcos do desenvolvimento da Caderneta da Criança.
-- codigo identifica os marcos sugeridos pelo app (pv-*, dv-*); marcos criados pela família ficam sem código.

create table public.marcos (
  id uuid primary key default gen_random_uuid(),
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  tipo text not null check (tipo in ('primeira', 'desenvolvimento')),
  codigo text check (codigo ~ '^(pv|dv)-[a-z0-9-]+$'),
  titulo text not null check (char_length(trim(titulo)) between 1 and 120),
  data date not null,
  detalhe text check (char_length(detalhe) <= 300),
  criado_em timestamptz not null default now()
);

create unique index marcos_codigo_unico on public.marcos (bebe_id, codigo) where codigo is not null;

alter table public.marcos enable row level security;

create policy "membros veem os marcos" on public.marcos for select to authenticated
  using (bebe_id in (select public.meus_bebes()));
create policy "membros anotam marcos" on public.marcos for insert to authenticated
  with check (bebe_id in (select public.meus_bebes()) and autor_id = (select auth.uid()));
create policy "membros editam marcos" on public.marcos for update to authenticated
  using (bebe_id in (select public.meus_bebes())) with check (bebe_id in (select public.meus_bebes()));
create policy "membros apagam marcos" on public.marcos for delete to authenticated
  using (bebe_id in (select public.meus_bebes()));

revoke all on public.marcos from anon;
revoke update on public.marcos from authenticated;
grant update (titulo, data, detalhe) on public.marcos to authenticated;

alter publication supabase_realtime add table public.marcos;
