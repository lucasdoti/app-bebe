# Colinho

App para pai e mãe acompanharem a rotina do bebê: mamadas, sono, fraldas, medidas com curvas da OMS, sugestão de roupa pelo clima, remédios e lembretes.

Veja o [PRD](docs/PRD.md).

**Stack:** Expo SDK 57 (web/PWA na Vercel) + Supabase + Open-Meteo.

## Rodar localmente

```bash
npm install
npm run web
```

As chaves públicas do Supabase ficam em `.env` (só a publishable key; nunca a secret).

## Banco de dados

As migrações ficam em `supabase/migrations/`. Para aplicar, cole o arquivo no **SQL Editor** do Supabase e rode, na ordem dos nomes.

## Lembretes (Web Push)

1. Rode a migração `20261015000000_remedios_lembretes.sql`.
2. Em **Edge Functions → Secrets**, cadastre `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e `CRON_SECRET`. Para gerar chaves novas: `npx web-push generate-vapid-keys`. A chave pública também vai no `.env` (`EXPO_PUBLIC_VAPID_PUBLIC_KEY`).
3. Publique a função `supabase/functions/enviar-lembretes` com a verificação de JWT **desligada** (ela confere o `CRON_SECRET` ou o login por conta própria).
4. Rode `supabase/agendar-lembretes.sql` trocando `SEU_CRON_SECRET` pelo mesmo valor do segredo.

## Deploy

A Vercel usa o `vercel.json`: `expo export --platform web` gera o PWA em `dist/`.
