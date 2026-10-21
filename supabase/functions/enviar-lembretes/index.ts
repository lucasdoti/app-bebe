// Edge Function "enviar-lembretes": roda a cada minuto (pg_cron) e manda Web Push para pai e mãe.
// Também atende o botão "Enviar notificação de teste" do app (com o login do usuário).
//
// Segredos (Supabase > Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.
// Publicar com a verificação de JWT desligada: a função confere o CRON_SECRET ou o login por conta própria.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CHAVE_SECRETA = (() => {
  try {
    return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  } catch {
    return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  }
})() as string;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const db = createClient(URL_SUPABASE, CHAVE_SECRETA, { auth: { persistSession: false } });

type Aviso = { titulo: string; corpo: string; tag: string; url: string };

const MIN = 60_000;
const HORA = 60 * MIN;
const fusoBR = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const diaBR = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const hora = (d: Date) => fusoBR.format(d);

async function enviarPara(userIds: string[], aviso: Aviso) {
  if (!userIds.length) return 0;
  const { data: inscricoes } = await db.from('push_inscricoes').select('endpoint, p256dh, auth').in('user_id', userIds);
  let enviados = 0;
  for (const i of inscricoes ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        JSON.stringify(aviso),
        { TTL: 60 * 60, urgency: 'high' },
      );
      enviados++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Inscrição vencida ou removida pelo aparelho.
      if (status === 404 || status === 410) await db.from('push_inscricoes').delete().eq('endpoint', i.endpoint);
      else console.error('Falha no push', status, (e as Error).message);
    }
  }
  return enviados;
}

// Membros da família de cada bebê, para avisar pai e mãe.
async function membrosPorBebe(bebeIds: string[]) {
  const mapa = new Map<string, { nome: string; membros: string[] }>();
  if (!bebeIds.length) return mapa;
  const { data: bebes } = await db.from('bebes').select('id, nome, familia_id').in('id', bebeIds);
  const familias = [...new Set((bebes ?? []).map((b) => b.familia_id))];
  const { data: membros } = await db.from('membros').select('familia_id, user_id').in('familia_id', familias);
  for (const b of bebes ?? []) {
    mapa.set(b.id, {
      nome: b.nome,
      membros: (membros ?? []).filter((m) => m.familia_id === b.familia_id).map((m) => m.user_id),
    });
  }
  return mapa;
}

async function lembretesDevidos(agora: Date) {
  const avisos: { bebeId: string; montar: (nome: string) => Aviso }[] = [];

  // 1. Remédios: próxima dose = última dose + intervalo (ou o início, se nenhuma foi dada).
  const { data: remedios } = await db
    .from('remedios')
    .select('id, bebe_id, nome, dose, intervalo_h, inicio, duracao_dias, ultimo_aviso')
    .eq('ativo', true);
  for (const r of remedios ?? []) {
    const inicio = new Date(r.inicio);
    if (r.duracao_dias && agora.getTime() > inicio.getTime() + r.duracao_dias * 24 * HORA) continue;
    const { data: ultima } = await db
      .from('registros')
      .select('inicio')
      .eq('tipo', 'dose')
      .eq('detalhes->>remedio_id', r.id)
      .order('inicio', { ascending: false })
      .limit(1)
      .maybeSingle();
    const devido = ultima ? new Date(new Date(ultima.inicio).getTime() + Number(r.intervalo_h) * HORA) : inicio;
    const jaAvisado = r.ultimo_aviso && new Date(r.ultimo_aviso) >= devido;
    // Não insiste em doses atrasadas há mais de 6 h.
    if (devido > agora || jaAvisado || agora.getTime() - devido.getTime() > 6 * HORA) continue;
    await db.from('remedios').update({ ultimo_aviso: agora.toISOString() }).eq('id', r.id);
    avisos.push({
      bebeId: r.bebe_id,
      montar: (nome) => ({
        titulo: `Hora do remédio de ${nome}`,
        corpo: `${r.nome}: ${r.dose}. Toque em "Dei a dose" quando der.`,
        tag: `remedio-${r.id}`,
        url: '/remedios',
      }),
    });
  }

  // 2. Mamada: "faz 3h desde a última", uma vez por mamada.
  const { data: deMamada } = await db
    .from('lembretes')
    .select('id, bebe_id, intervalo_min, ultimo_ref')
    .eq('tipo', 'mamada')
    .eq('ativo', true);
  for (const l of deMamada ?? []) {
    const { data: ultima } = await db
      .from('registros')
      .select('id, inicio, fim, tipo')
      .eq('bebe_id', l.bebe_id)
      .in('tipo', ['mamada', 'mamadeira', 'refeicao'])
      .order('inicio', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ultima || ultima.fim === null || ultima.id === l.ultimo_ref) continue;
    const passou = agora.getTime() - new Date(ultima.inicio).getTime();
    if (passou < l.intervalo_min * MIN || passou > l.intervalo_min * MIN + 3 * HORA) continue;
    await db.from('lembretes').update({ ultimo_ref: ultima.id }).eq('id', l.id);
    const h = Math.floor(passou / HORA);
    const m = Math.round((passou % HORA) / MIN);
    avisos.push({
      bebeId: l.bebe_id,
      montar: (nome) => ({
        titulo: `${nome}: hora de mamar?`,
        corpo: `Faz ${h}h${m ? String(m).padStart(2, '0') : ''} desde a última mamada (${hora(new Date(ultima.inicio))}).`,
        tag: `mamada-${l.bebe_id}`,
        url: '/',
      }),
    });
  }

  // 3. Personalizados: na hora marcada; os recorrentes avançam para a próxima vez.
  const { data: pessoais } = await db
    .from('lembretes')
    .select('id, bebe_id, titulo, proximo_em, recorrencia')
    .eq('tipo', 'personalizado')
    .eq('ativo', true)
    .lte('proximo_em', agora.toISOString());
  for (const l of pessoais ?? []) {
    let proximo = new Date(l.proximo_em);
    const passo = l.recorrencia === 'diaria' ? 24 * HORA : l.recorrencia === 'semanal' ? 7 * 24 * HORA : 0;
    if (passo) while (proximo <= agora) proximo = new Date(proximo.getTime() + passo);
    await db
      .from('lembretes')
      .update(passo ? { proximo_em: proximo.toISOString() } : { ativo: false })
      .eq('id', l.id);
    if (agora.getTime() - new Date(l.proximo_em).getTime() > 2 * HORA) continue;
    avisos.push({
      bebeId: l.bebe_id,
      montar: (nome) => ({ titulo: l.titulo, corpo: `Lembrete de ${nome}`, tag: `lembrete-${l.id}`, url: '/lembretes' }),
    });
  }

  // 4. Pré-natal: aviso com até 24 h de antecedência para consultas e exames.
  const { data: consultas } = await db
    .from('pre_natal')
    .select('id, bebe_id, titulo, data, local, perguntas')
    .in('tipo', ['consulta', 'exame'])
    .eq('lembrete_enviado', false)
    .gt('data', agora.toISOString())
    .lte('data', new Date(agora.getTime() + 24 * HORA).toISOString());
  for (const c of consultas ?? []) {
    await db.from('pre_natal').update({ lembrete_enviado: true }).eq('id', c.id);
    const quando = new Date(c.data);
    const mesmoDia = diaBR.format(quando) === diaBR.format(agora);
    // Lembra das perguntas anotadas para a consulta (a primeira aparece no aviso).
    const perguntas = (c.perguntas ?? '')
      .split('\n')
      .map((l: string) => l.trim())
      .filter(Boolean);
    const corpoPerguntas = perguntas.length
      ? `${perguntas.length === 1 ? '1 pergunta anotada' : `${perguntas.length} perguntas anotadas`}: “${perguntas[0].slice(0, 80)}”${perguntas.length > 1 ? '…' : ''}`
      : null;
    avisos.push({
      bebeId: c.bebe_id,
      montar: () => ({
        titulo: `${mesmoDia ? 'Hoje' : 'Amanhã'} às ${hora(quando)}: ${c.titulo}`,
        corpo: [corpoPerguntas, c.local && `Local: ${c.local}`].filter(Boolean).join(' · ') || 'Toque para anotar perguntas para a consulta.',
        tag: `prenatal-${c.id}`,
        url: `/pre-natal/${c.id}`,
      }),
    });
  }

  // 5. Vacinas: véspera e dia de cada dose do bebê; na gestação, quando a dTpa e a VSR ficam liberadas.
  // Só a partir das 9h (horário de Brasília), uma vez por dose (tabela lembretes_enviados).
  if (Number(horaBR.format(agora)) >= 9) avisos.push(...(await avisosDeVacina(agora)));

  return avisos;
}

// Cópia compacta do calendário do app (src/lib/vacinas.ts — Calendário Nacional de Vacinação 2026).
// Ao mudar o calendário do app, mude aqui também.
const VACINAS_BEBE: [string, string, number][] = [
  ['penta-1', 'Penta, 1ª dose', 2], ['vip-1', 'VIP (pólio), 1ª dose', 2], ['vpc20-1', 'Pneumocócica, 1ª dose', 2],
  ['rota-1', 'Rotavírus, 1ª dose', 2], ['menc-1', 'Meningocócica C, 1ª dose', 3], ['penta-2', 'Penta, 2ª dose', 4],
  ['vip-2', 'VIP (pólio), 2ª dose', 4], ['vpc10-2', 'Pneumocócica, 2ª dose', 4], ['rota-2', 'Rotavírus, 2ª dose', 4],
  ['menc-2', 'Meningocócica C, 2ª dose', 5], ['penta-3', 'Penta, 3ª dose', 6], ['vip-3', 'VIP (pólio), 3ª dose', 6],
  ['covid-1', 'Covid-19, 1ª dose', 6], ['influenza-1', 'Gripe, 1ª dose', 6], ['covid-2', 'Covid-19, 2ª dose', 7],
  ['influenza-2', 'Gripe, 2ª dose', 7], ['covid-3', 'Covid-19, 3ª dose', 9], ['vfa-1', 'Febre amarela', 9],
  ['vpc20-r', 'Pneumocócica, reforço', 12], ['acwy-r', 'Meningocócica ACWY', 12], ['scr-1', 'Tríplice viral, 1ª dose', 12],
  ['dtp-r1', 'DTP, 1º reforço', 15], ['vip-r1', 'VIP, 1º reforço', 15], ['scr-2', 'Tríplice viral, 2ª dose', 15],
  ['varicela-1', 'Varicela, 1ª dose', 15], ['hepa', 'Hepatite A', 15], ['dtp-r2', 'DTP, 2º reforço', 48],
  ['vip-r2', 'VIP, 2º reforço', 48], ['vfa-r', 'Febre amarela, reforço', 48], ['varicela-2', 'Varicela, 2ª dose', 48],
];
const VACINAS_MAE: [string, string, number][] = [
  ['dtpa-g', 'dTpa (protege o bebê da coqueluche)', 20],
  ['vsr-g', 'VSR (protege o bebê da bronquiolite)', 28],
];

// hourCycle h23: meia-noite vira "00" (com hour12:false alguns ambientes escrevem "24").
const horaBR = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' });
const isoBR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD

function somarMeses(iso: string, meses: number) {
  const [a, m, d] = iso.split('-').map(Number);
  const r = new Date(Date.UTC(a, m - 1 + meses, d));
  return r.toISOString().slice(0, 10);
}
const somarDias = (iso: string, dias: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 24 * HORA).toISOString().slice(0, 10);

async function jaEnviado(chave: string) {
  const { error } = await db.from('lembretes_enviados').insert({ chave });
  // Chave repetida = esse aviso já saiu antes.
  return !!error;
}

async function avisosDeVacina(agora: Date) {
  const avisos: { bebeId: string; montar: (nome: string) => Aviso }[] = [];
  const hoje = isoBR.format(agora);
  const amanha = somarDias(hoje, 1);
  const { data: bebes } = await db.from('bebes').select('id, status, nascimento, parto_previsto');
  const { data: aplicadas } = await db.from('vacinas_aplicadas').select('bebe_id, para, codigo').not('codigo', 'is', null);
  const tomou = (bebe: string, para: string, codigo: string) =>
    (aplicadas ?? []).some((v) => v.bebe_id === bebe && v.para === para && v.codigo === codigo);

  for (const b of bebes ?? []) {
    if (b.status === 'nascido' && b.nascimento) {
      for (const [codigo, nome, meses] of VACINAS_BEBE) {
        const data = somarMeses(b.nascimento, meses);
        if ((data !== hoje && data !== amanha) || tomou(b.id, 'bebe', codigo)) continue;
        if (await jaEnviado(`vacina:${b.id}:${codigo}:${data === hoje ? 'dia' : 'vespera'}`)) continue;
        avisos.push({
          bebeId: b.id,
          montar: (n) => ({
            titulo: `${data === hoje ? 'Hoje' : 'Amanhã'}: vacina de ${n}`,
            corpo: `${nome}. Leve a caderneta de vacinação.`,
            tag: `vacina-${b.id}-${codigo}`,
            url: '/vacinas',
          }),
        });
      }
    }
    if (b.status === 'gestacao' && b.parto_previsto) {
      // Idade gestacional: 280 dias até o parto previsto.
      const totalDias = 280 - Math.round((Date.parse(`${b.parto_previsto}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / (24 * HORA));
      for (const [codigo, nome, semana] of VACINAS_MAE) {
        if (totalDias < semana * 7 || tomou(b.id, 'mae', codigo)) continue;
        if (await jaEnviado(`vacina:${b.id}:${codigo}:liberada`)) continue;
        avisos.push({
          bebeId: b.id,
          montar: () => ({
            titulo: `Vacina da gestação liberada: ${nome.split(' (')[0]}`,
            corpo: `A partir da ${semana}ª semana: ${nome}. Converse com a obstetra e marque no app quando tomar.`,
            tag: `vacina-${b.id}-${codigo}`,
            url: '/vacinas?para=mae',
          }),
        });
      }
    }
  }
  return avisos;
}

// O app chama pelo navegador: libera os cabeçalhos que o supabase-js envia (inclusive x-client-info).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const corpo = await req.json().catch(() => ({}));

  // Teste a partir do app: manda só para o próprio usuário.
  if (corpo?.teste) {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data } = await db.auth.getUser(token);
    if (!data.user) return Response.json({ erro: 'Faça login' }, { status: 401, headers: CORS });
    const enviados = await enviarPara([data.user.id], {
      titulo: 'Notificações do Colinho ativadas',
      corpo: 'É assim que os lembretes vão chegar.',
      tag: 'teste',
      url: '/ajustes',
    });
    return Response.json({ enviados }, { headers: CORS });
  }

  if (req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('Não autorizado', { status: 401 });

  const agora = new Date();
  const avisos = await lembretesDevidos(agora);
  const familias = await membrosPorBebe([...new Set(avisos.map((a) => a.bebeId))]);
  let enviados = 0;
  for (const a of avisos) {
    const f = familias.get(a.bebeId);
    if (f) enviados += await enviarPara(f.membros, a.montar(f.nome));
  }
  return Response.json({ avisos: avisos.length, enviados });
});
