# PRD — App para Pais de Bebês

> Fonte viva deste PRD: https://claude.ai/code/artifact/f1ebe344-fd0d-402f-8d3a-832b70993523 (exportado em 2026-10-05). Ao mudar uma decisão, atualize este arquivo.

## Visão geral

Um app para pai e mãe registrarem a rotina do bebê em segundos e receberem uma sugestão de roupa que aprende com o próprio bebê. O diferencial é a sugestão de roupa pelo clima, que os apps concorrentes (Huckleberry, Baby Tracker, Glow Baby) não oferecem bem.

**Problema.** Nos primeiros anos, os pais vivem cansados e anotam mamadas, sonos e fraldas em papel, no WhatsApp ou de memória. O pediatra pede esses dados e ninguém lembra. Todo dia surge a mesma dúvida: "ele está com frio ou com calor?".

**Proposta de valor.**

- Registro com uma mão, em até 2 toques, inclusive de madrugada.
- Pai e mãe veem os mesmos dados em tempo real.
- Sugestão de roupa que considera o clima, a idade, o contexto e o histórico daquele bebê.
- Crescimento comparado com as curvas da OMS.

**Público.** Na V1, o próprio autor e pais conhecidos (uso fechado). Se der certo, publicar nas lojas depois. Cobre a gestação e bebês de 0 a 3 anos, com mais de um bebê por família.

**Nome:** Colinho. Lembra o colo de quem cuida e combina com o ajuste de roupa do sling/colo. Antes de publicar nas lojas, conferir se o nome está livre na App Store, na Play Store e no INPI.

## Objetivos e métricas de sucesso

A V1 dá certo se pai e mãe trocarem o papel e o WhatsApp pelo app e usarem a sugestão de roupa no dia a dia.

| Objetivo | Métrica | Meta V1 |
| --- | --- | --- |
| Registro rápido | Tempo para registrar uma mamada ou fralda | ≤ 5 s, ≤ 2 toques |
| Uso contínuo | Dias com ao menos 1 registro, nas primeiras 4 semanas | ≥ 80% dos dias |
| Uso a dois | Famílias com pai e mãe registrando | 100% das famílias de teste |
| Roupa útil | Feedbacks "ok" sobre o total de feedbacks de roupa | ≥ 70% após 2 semanas de uso |
| Consulta pediátrica | Famílias que usaram o resumo numa consulta | ≥ 1 por família |
| Sinal para publicar | Famílias conhecidas usando após 2 meses | ≥ 3 |

## Personas e cenários de uso

Duas personas dividem o mesmo bebê; o app precisa servir quem está com o bebê no colo, no escuro e sem paciência.

| Persona | Contexto | O que precisa |
| --- | --- | --- |
| Mãe | Amamenta, faz mais registros de madrugada | Saber qual peito foi o último e há quanto tempo mamou |
| Pai | Divide turnos, cuida de saídas e banho | Ver o que aconteceu enquanto estava fora e saber o que vestir no bebê |

**Cenários principais**

1. **3h da manhã.** A mãe abre o app em modo escuro, toca em "Mamada" e o app já sugere o peito direito. Ela toca de novo para encerrar.
2. **Volta do trabalho.** O pai abre a home e vê: última mamada há 1h20, acordado há 50 min, 4 fraldas hoje.
3. **Passeio no parque.** Antes de sair, o app sugere body manga longa, calça e casaco leve, e avisa que esfria às 17h. Na volta, pergunta como o bebê ficou.
4. **Consulta no pediatra.** Os pais abrem o resumo da última semana e a curva de peso no percentil.
5. **Dois filhos.** A família troca entre os bebês no topo da tela; cada um tem sua rotina e sua calibração de roupa.

## Escopo V1 (MVP)

A V1 cobre conta da família, registro de rotina, medidas com curva da OMS, sugestão de roupa, remédios e lembretes. Fotos ficam no backlog.

**RF1. Conta e família**

- Login com Google ou e-mail.
- Quem cria a conta cria a família e cadastra o(s) bebê(s): nome, data de nascimento, sexo (para a curva da OMS) e peso e altura ao nascer.
- Código de convite (ex.: BEBE-7K2X9P, 6 caracteres para não dar para adivinhar) ou link (`/convite/BEBE-7K2X9P`) para o outro responsável entrar na família.
- Na V1 cada pessoa participa de uma família só; quem sai da família pode entrar em outra com um código.
- Mais de um bebê por família, com seletor no topo da tela.
- Cada registro guarda quem o fez ("registrado pela mãe").

**RF2. Home (resumo do dia)**

- Cartões: última mamada/refeição (há quanto tempo), sono atual ou janela de vigília, fraldas do dia, clima e roupa sugerida, próxima dose de remédio.
- Botões grandes de registro rápido no rodapé.
- Linha do tempo das últimas 24h.

**RF3. Alimentação**

- Peito: cronômetro esquerdo/direito, troca de lado e sugestão do lado seguinte.
- Mamadeira: volume em ml e tipo (leite materno ou fórmula).
- Refeição sólida (a partir de 6 meses): alimento, quantidade aproximada e aceitação.
- Registro retroativo ("mamou às 14h por 15 min").

**RF4. Sono**

- Iniciar e parar o sono com um toque, mais registro retroativo.
- Total em 24h, número de cochilos e janela de vigília atual.

**RF5. Fraldas**

- Xixi, cocô ou ambos, com cor e consistência opcionais.
- Contagem do dia.

**RF6. Medidas**

- Peso, altura e perímetro cefálico com data.
- Gráfico sobre as curvas da OMS por sexo e idade (faixas dos percentis 3–97 e 15–85 e linha do 50), mostrando o percentil.
- Na V1, salvar uma medida precisa de internet; os registros de rotina funcionam offline.

**RF7. Clima e roupa**

- Clima atual e das próximas horas pela localização do celular.
- Sugestão de camadas e feedback após o uso (detalhes na seção seguinte).

**RF8. Histórico e resumo**

- Histórico filtrável por tipo e dia.
- Resumo de 7 dias para o pediatra: médias de mamadas, sono e fraldas e última medida.

**RF9. Remédios e febre**

- Cadastro do remédio: nome, dose, intervalo em horas e duração do tratamento em dias.
- Registrar dose dada com um toque, guardando quem deu e a hora.
- Cartão na home: "próxima dose liberada às 20h", visível para pai e mãe, evitando dose dobrada.
- Registro de febre: temperatura e hora, com gráfico do dia.
- O app não calcula dose: os pais informam o que o pediatra prescreveu.

**RF10. Lembretes**

- Lembrete automático no horário da próxima dose de remédio.
- Lembrete opcional de mamada ("faz 3h desde a última"), com intervalo configurável.
- Lembretes personalizados: consulta, banho de sol, troca de fralda noturna.
- A notificação vai para pai e mãe; quando um registra, o lembrete some para os dois.
- Entrega por Web Push. No iPhone, só com o app instalado na tela inicial e iOS 16.4+.
- Na gestação, aviso automático até 24 h antes de cada consulta ou exame do pré-natal.
- Como funciona (V1): uma Edge Function (`enviar-lembretes`) roda a cada minuto pelo pg_cron. A dose registrada antes da hora cancela o aviso para os dois; um aviso que já apareceu some do celular de quem registrou, mas no outro celular fica até ser tocado (o Web Push não permite apagar sem mostrar outra notificação).
- Lembrete de mamada: um aviso por mamada, ao passar o intervalo escolhido (2h a 4h); não avisa durante uma mamada em andamento.
- Remédio: tocar em "Dei a dose" antes da hora liberada pede confirmação, para evitar dose dobrada.

**Requisitos não funcionais**

- Funciona offline e sincroniza quando a internet volta.
- Modo escuro com brilho baixo para uso noturno.
- Alvos de toque de pelo menos 56 px, pensados para uma mão só.
- Sincronização entre pai e mãe em até 5 s quando online.
- Dados de saúde do bebê acessíveis só aos membros da família (LGPD).

## Sugestão de roupa inteligente

A sugestão parte de uma regra fixa por temperatura e é calibrada por bebê com o feedback dos pais, sem precisar de IA pesada na V1.

**1. Entradas**

- Clima: sensação térmica, vento, chuva, umidade e previsão para as próximas 6h.
- Bebê: idade (recém-nascido regula mal a temperatura e ganha uma camada a mais).
- Contexto escolhido pelos pais: em casa, passeio (carrinho, sling ou carro) ou dormindo.

**2. Regra base** (faixas iniciais, a validar com pediatra)

| Sensação térmica | Camadas | Exemplo |
| --- | --- | --- |
| ≥ 27 °C | 1 leve | Body manga curta |
| 22 a 26 °C | 1 | Body manga longa ou macacão leve |
| 18 a 21 °C | 2 | Body + macacão |
| 13 a 17 °C | 3 | Body + macacão + casaco, meia |
| ≤ 12 °C | 4 | Body + macacão + casaco grosso, gorro, manta |

**3. Ajustes de contexto**

- Sling ou colo: uma camada a menos (o corpo do adulto aquece).
- Vento forte ou chuva: casaco corta-vento ou capa no carrinho.
- Queda de 5 °C ou mais na previsão do passeio: aviso "leve um casaco extra".
- Dormindo: sugestão de saco de dormir pelo TOG, a partir da temperatura do quarto informada pelos pais. Por segurança, o sono não ganha a camada extra do recém-nascido e sempre lembra do berço livre (sem gorro, manta solta ou travesseiro).
- Carro: com casaco grosso, aviso para tirar o casaco na cadeirinha e cobrir com a manta por cima do cinto.
- Sem localização permitida, os pais escolhem a cidade pelo nome (geocodificação da Open-Meteo).

**4. Aprendizado com feedback**

- Depois do passeio, ou na manhã seguinte para o sono, o app pergunta como o bebê ficou: frio, ok ou calor. A pergunta aparece quando os pais tocam em "Vou vestir assim": 1 h depois no passeio, às 7h do dia seguinte no sono da noite e 2 h depois num cochilo.
- Cada bebê tem um ajuste pessoal em camadas, entre −1,5 e +1,5. Frio soma 0,25 e calor subtrai 0,25.
- Com o ajuste em ±0,5 ou mais, a sugestão muda de faixa e o app explica: "o Theo costuma sentir calor, sugeri uma camada a menos".
- O ajuste fica separado por contexto (passeio e sono), porque um bebê pode ser calorento só dormindo. "Em casa" usa o mesmo ajuste do passeio (o bebê acordado).

**5. API de clima.** Open-Meteo: gratuita, sem chave, com previsão horária. Alternativa: OpenWeatherMap.

Uma LLM para explicar a sugestão em linguagem natural fica para depois.

## Fases por idade (0 a 3 anos)

A home muda de destaque conforme a idade do bebê, calculada pela data de nascimento; nada some, só muda de posição.

| Fase | Destaques da home | Novidades da fase |
| --- | --- | --- |
| 0 a 6 meses | Mamada (peito/mamadeira), sono, fraldas | Curva de peso semanal, lado do peito |
| 6 a 12 meses | Refeições e mamadas, sono, fraldas | Introdução alimentar: alimentos já oferecidos e reações ou alergias |
| 1 a 3 anos | Refeições, cochilos, desfralde | Registro de penico/banheiro, cochilos diminuindo |

Medidas e clima/roupa aparecem em todas as fases. Os pais podem fixar um cartão na home para não depender da fase.

## Gestação (antes do nascimento)

Os próprios autores estão grávidos e querem usar o app desde já, então a gestação entrou na V1 (decidido em 2026-10-13).

- **Bebê a caminho:** o bebê é cadastrado com nome ou apelido e a data provável do parto, informada direto, calculada pela última menstruação (+280 dias) ou pelo ultrassom (data do exame e idade gestacional do laudo). O sexo é opcional.
- **Home da gestação:** semanas e dias, trimestre, barra de progresso, quanto falta para o parto e o tamanho médio aproximado do bebê comparado a uma fruta ou legume.
- **Pré-natal:** consultas, exames e ultrassons com data, horário, local, perguntas para levar e anotações. A próxima consulta aparece na home.
- **Ultrassons:** peso fetal estimado, comprimento, batimentos e o percentil informado no laudo; gráfico do peso por semana sobre uma linha de peso médio aproximado (só referência — o app não calcula percentil fetal).
- **Contrações:** cronômetro compartilhado (começou/acabou) com duração, intervalo e médias da última hora; avisa quando aparece o padrão 5-1-1 e lembra sempre dos sinais para ir à maternidade.
- **Mala da maternidade:** checklist compartilhado com lista sugerida editável, por grupo (bebê, mãe, documentos, acompanhante).
- **Saúde da mãe:** peso e pressão anotados nas consultas, com gráfico do peso por semana e um alerta para conferir com a obstetra quando a pressão chega a 14 por 9 ou mais.
- **Movimentos do bebê (a partir da 28ª semana):** contagem até 10 movimentos com o tempo que levou, histórico compartilhado e o lembrete de procurar atendimento se o bebê mexer menos.
- **Nomes:** lista compartilhada em que cada responsável sugere nomes e vota (amo, gosto, não); a lista se ordena pelos pontos.
- **Enxoval:** lista compartilhada do que a família já tem, por categoria (roupas, higiene, quarto, passeio, alimentação) e, nas roupas, por tamanho (RN a 3), com quantidade ajustável e envio pelo WhatsApp. Também fica acessível depois do nascimento, em Ajustes. É o primeiro passo do "guarda-roupa do bebê" do backlog.
- **Chegou a hora:** contatos do parto (obstetra, maternidade, doula, pediatra) com ligar, WhatsApp e rota até a maternidade com um toque, guardados no aparelho para funcionar sem internet; sinais de quando ir para a maternidade; plano de parto com preferências (quero / não quero / a decidir) compartilhável. Os botões de ligar e ir aparecem também no cronômetro de contrações, e o cartão sobe para o topo da home a partir da 34ª semana.
- **Nascimento:** o botão "Nasceu!" pede data, sexo, peso e altura e transforma o mesmo cadastro no bebê nascido; o histórico da gestação fica guardado.

## Vacinas

Carteirinha de vacinas com dois calendários, a pedido dos pais (antecipado da V2 em 2026-10-10):

- **Bebê (0 a 4 anos):** doses do Calendário Nacional de Vacinação 2026 (Instrução Normativa do PNI), com a data recomendada de cada uma pela data de nascimento e a situação: tomada, pode tomar, em breve, atrasada (mais de 30 dias) ou fora do prazo (rotavírus e hepatite B ao nascer têm idade limite).
- **Mãe (gestação):** influenza e covid-19 em qualquer fase, dTpa a partir da 20ª semana, VSR a partir da 28ª semana; hepatite B e dT só se o cartão estiver incompleto ("conferir cartão").
- Marcar como tomada com data, local, lote e observação; vacinas fora do calendário (rede particular) também podem ser anotadas.
- Cartão na home do bebê (próxima vacina ou pendências) e na home da gestação.
- O calendário fica no app (`src/lib/vacinas.ts`) e precisa ser revisto quando o Ministério da Saúde atualizar a Instrução Normativa. O app sempre orienta conferir com a unidade de saúde.

## V2 e backlog

A V2 traz fotos e marcos; o resto fica no backlog até a V1 provar uso.

| Item | Versão | Observação |
| --- | --- | --- |
| Vacinas com calendário do SUS | ~~V2~~ V1 | Antecipado em 2026-10-10: veja "Vacinas" |
| Lembrete de vacina por notificação | Backlog | O calendário já calcula as datas |
| Fotos e álbum de marcos | V2 | Custo de armazenamento (Supabase Storage) |
| Marcos do desenvolvimento (sorriu, sentou, andou) | V2 | Combina com o álbum |
| Guarda-roupa do bebê (sugestão com as peças reais) | Backlog | Precisa de cadastro de peças |
| Previsão da próxima mamada ou sono | Backlog | Exige histórico de algumas semanas |
| Exportar resumo em PDF | Backlog | Na V1 o resumo é só uma tela |
| Explicação da roupa por LLM | Backlog | Opcional |
| Outros cuidadores (avós, babá) | Backlog | O modelo de família já suporta |
| Publicação nas lojas (iOS/Android) | Backlog | Mesmo código Expo, build nativo |

## Arquitetura técnica e modelo de dados

Mesmo caminho do treino-e-dieta: Expo exportado como web/PWA na Vercel, agora com Supabase para login, banco e sincronização em tempo real.

```
Celular do pai ─┐                          ┌─ Supabase: Auth (Google, e-mail)
                ├─ App Expo (PWA) ◄──────► ├─ Postgres + RLS
Celular da mãe ─┘   cache local/offline    └─ Realtime (sync pai/mãe)
                    regra de roupa
        Vercel ───► (hospeda o PWA)        App ──► Open-Meteo (clima)
```

O app grava primeiro no cache local e sincroniza com o Supabase quando há internet; o Realtime avisa o outro celular na hora.

**Stack**

- Front: Expo SDK 57 (React Native + web), export estático na Vercel, instalável como PWA.
- Backend: Supabase (Auth, Postgres com Row Level Security, Realtime). O plano gratuito atende o uso pessoal.
- Clima: Open-Meteo, chamada direto do app.
- Curvas da OMS: tabelas de percentis embutidas no app (dados públicos da OMS).

Lembretes usam Web Push, disparado por uma Edge Function do Supabase agendada com pg_cron.

**Modelo de dados**

| Tabela | Campos principais |
| --- | --- |
| familias | id, nome, codigo_convite |
| membros | familia_id, user_id, papel (pai, mãe) |
| bebes | id, familia_id, nome, status (gestacao, nascido), parto_previsto, nascimento, sexo, peso_nascer, altura_nascer |
| registros | id, bebe_id, autor_id, tipo (mamada, mamadeira, refeicao, sono, fralda, contracao, movimentos), inicio, fim, detalhes (json) |
| medidas | id, bebe_id, data, peso_kg, altura_cm, perimetro_cefalico_cm |
| roupa_feedback | id, bebe_id, data, contexto (passeio, sono), sensacao_c, sugestao, resultado (frio, ok, calor) |
| roupa_ajuste | bebe_id, contexto, ajuste_camadas |
| remedios | id, bebe_id, nome, dose, intervalo_h, inicio, fim, ativo |
| lembretes | id, bebe_id, tipo (remedio, mamada, personalizado), proximo_em, recorrencia, remedio_id |
| push_inscricoes | user_id, endpoint, chaves, dispositivo |
| pre_natal | id, bebe_id, tipo (consulta, exame, ultrassom), data, titulo, local, anotacoes, perguntas, peso_fetal_g, comprimento_cm, batimentos_bpm, percentil_laudo, peso_mae_kg, pressao_sistolica, pressao_diastolica |
| mala_itens | id, bebe_id, grupo, nome, feito |
| enxoval_itens | id, bebe_id, categoria, nome, tamanho, quantidade |
| contatos_parto / plano_parto_itens | id, bebe_id, papel, nome, telefone, endereco / id, bebe_id, grupo, texto, preferencia |
| vacinas_aplicadas | id, bebe_id, para (bebe, mae), codigo, nome, data, local, lote, observacao |
| nomes / nomes_votos | id, bebe_id, nome, sexo / nome_id, user_id, valor (2 amo, 1 gosto, −1 não) |

Uma tabela única de registros com campo json mantém o app simples e facilita a linha do tempo. A regra de acesso (RLS) é uma só: o usuário vê tudo cujo bebe_id pertence a uma família da qual ele é membro.

## Design e identidade visual

Visual fofinho em tons pastéis, com um modo noturno escuro e de baixo brilho que não acorda ninguém.

- **Paleta:** uma cor por tipo de registro, sempre a mesma em botões, linha do tempo e gráficos. Sugestão: mamada em rosa, sono em lilás, fralda em amarelo, medidas em verde-menta e clima em azul-céu.
- **Fundo:** creme claro no modo dia; azul-marinho bem escuro no modo noite, com pastéis dessaturados.
- **Formas:** cantos bem arredondados, cartões macios, ícones com traço grosso e ilustrações simples (nuvem, lua, mamadeira).
- **Tipografia:** arredondada e legível, como Nunito ou Quicksand, com números grandes para "há 1h20".
- **Roupa sugerida:** ilustração de um bonequinho vestido com as camadas, no lugar de uma lista de texto.
- **Logo:** bebê dormindo no colo de uma lua lilás, com estrelinhas amarelas, sobre fundo creme (escolhido em 2026-10-14). Fonte em `assets/logo/`; os ícones são gerados por `scripts/gerar-icones.mjs`.
- **Modo noite automático** entre 20h e 6h, com opção manual.

## Riscos, questões em aberto e próximos passos

O maior risco é o registro ser lento demais para a madrugada; o segundo é a sugestão de roupa errar e perder a confiança dos pais.

| Risco | Mitigação |
| --- | --- |
| Registro lento faz os pais desistirem | Testar o fluxo de 2 toques com a família antes de tudo |
| Sugestão de roupa erra no começo | Faixas conservadoras, aviso "sugestão, não regra" e calibração por feedback |
| Conflito de registro entre pai e mãe offline | Cada registro tem id próprio; o histórico mostra os dois |
| Dados de saúde expostos | RLS no Supabase por família; nada sensível em URL |
| Conselho médico indevido | O app mostra dados e percentis, não diagnósticos |
| Lembrete de remédio não chega no iPhone | Testar push no PWA logo no início; cartão "próxima dose" sempre visível na home como garantia; se falhar, avaliar build nativo |

**Questões em aberto**

- Faixas de temperatura: validar com o pediatra.
- Push no iPhone: testar cedo se o PWA instalado entrega os lembretes de remédio com confiança.

**Plano de construção (etapas)**

1. Estrutura Expo + Supabase + login e família com convite
2. Cadastro de bebês e a home
3. Registros de mamada, sono e fralda
4. Medidas com curvas da OMS
5. Clima e roupa
5b. Gestação (pré-natal, ultrassons, contrações, mala e nascimento)
6. Remédios e lembretes (push)

Cada etapa é testada no celular antes de seguir para a próxima.
