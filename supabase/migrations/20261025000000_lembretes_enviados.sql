-- Controle dos avisos que a função enviar-lembretes já mandou (vacinas), para não repetir.
-- Só a função (chave secreta) usa esta tabela: RLS ligado e nenhuma política para o app.

create table public.lembretes_enviados (
  chave text primary key,
  enviado_em timestamptz not null default now()
);

alter table public.lembretes_enviados enable row level security;
revoke all on public.lembretes_enviados from anon, authenticated;
