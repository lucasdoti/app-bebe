# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Projeto

App para pai e mãe acompanharem a rotina de bebês de 0 a 3 anos (mamada, sono, fralda, medidas com curvas da OMS, sugestão de roupa pelo clima, remédios e lembretes).

- **PRD:** [docs/PRD.md](docs/PRD.md). Leia antes de implementar qualquer funcionalidade e siga o escopo da V1. Se uma decisão mudar, atualize o PRD no mesmo commit.
- **Stack:** Expo SDK 57 exportado como web/PWA e hospedado na Vercel; Supabase (Auth, Postgres com RLS, Realtime, Edge Functions); Open-Meteo para clima.
- **Construção por etapas** (seção "Plano de construção" do PRD): uma etapa por vez, testada no celular antes da próxima.
- **Idioma:** interface, textos e commits em português do Brasil.
- **UX:** registro em até 2 toques, alvos de toque ≥ 56 px, modo noturno escuro, visual pastel.
- **Segurança:** nunca commitar chaves do Supabase além da anon key pública; dados ficam isolados por família via RLS.
