-- Agenda a Edge Function "enviar-lembretes" para rodar a cada minuto.
-- Rode no SQL Editor DEPOIS de publicar a função e cadastrar os segredos.
-- Troque SEU_CRON_SECRET pelo mesmo valor do segredo CRON_SECRET da função
-- (o arquivo supabase/agendar-lembretes.local.sql, gerado no seu computador, já vem preenchido).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://dvgensoijpugtaxrurzj.supabase.co', 'colinho_project_url');
select vault.create_secret('SEU_CRON_SECRET', 'colinho_cron_secret');

select cron.schedule(
  'colinho-enviar-lembretes',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'colinho_project_url') || '/functions/v1/enviar-lembretes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'colinho_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
