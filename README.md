# app-bebe

App para pai e mãe acompanharem a rotina do bebê: mamadas, sono, fraldas, medidas com curvas da OMS, sugestão de roupa pelo clima, remédios e lembretes.

Nome definitivo a decidir. Veja o [PRD](docs/PRD.md).

**Stack:** Expo SDK 57 (web/PWA na Vercel) + Supabase + Open-Meteo.

## Rodar localmente

```bash
npm install
npm run web
```

As chaves públicas do Supabase ficam em `.env` (só a publishable key; nunca a secret).

## Banco de dados

As migrações ficam em `supabase/migrations/`. Para aplicar, cole o arquivo no **SQL Editor** do Supabase e rode, na ordem dos nomes.

## Deploy

A Vercel usa o `vercel.json`: `expo export --platform web` gera o PWA em `dist/`.
