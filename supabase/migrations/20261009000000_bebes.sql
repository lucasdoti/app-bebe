-- Etapa 2: bebês da família.
-- Qualquer membro da família cadastra, edita e remove os bebês dela.

create table public.bebes (
    id uuid primary key default gen_random_uuid (),
    familia_id uuid not null references public.familias (id) on delete cascade,
    nome text not null check (
        char_length(trim(nome)) between 1 and 40
    ),
    nascimento date not null check (
        nascimento >= date '2020-01-01'
    ),
    -- Sexo biológico, usado só para escolher a curva de crescimento da OMS.
    sexo text not null check (sexo in ('F', 'M')),
    peso_nascer_kg numeric(4, 2) check (
        peso_nascer_kg between 0.3 and 7
    ),
    altura_nascer_cm numeric(4, 1) check (
        altura_nascer_cm between 20 and 65
    ),
    criado_por uuid not null default auth.uid () references auth.users (id),
    criado_em timestamptz not null default now()
);

create index bebes_familia_idx on public.bebes (familia_id);

alter table public.bebes enable row level security;

create policy "membros veem os bebês da família" on public.bebes for
select to authenticated using (
        familia_id in (
            select public.minhas_familias ()
        )
    );

create policy "membros cadastram bebês na própria família" on public.bebes for
insert
    to authenticated
with
    check (
        familia_id in (
            select public.minhas_familias ()
        )
        and criado_por = (
            select auth.uid ()
        )
    );

create policy "membros editam os bebês da família" on public.bebes for
update to authenticated using (
    familia_id in (
        select public.minhas_familias ()
    )
)
with
    check (
        familia_id in (
            select public.minhas_familias ()
        )
    );

create policy "membros removem bebês da família" on public.bebes for delete to authenticated using (
    familia_id in (
        select public.minhas_familias ()
    )
);

revoke all on public.bebes from anon;

revoke update on public.bebes from authenticated;

grant
update (
    nome,
    nascimento,
    sexo,
    peso_nascer_kg,
    altura_nascer_cm
) on public.bebes to authenticated;

-- Realtime: o bebê cadastrado por um aparece na hora para o outro.
alter publication supabase_realtime add table public.bebes;
