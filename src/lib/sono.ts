import { idade } from './idade';
import type { Registro } from './registros';
import { HORA, inicioDoDia, MINUTO } from './tempo';

// Relógio do sono: o dia de 00:00 a 23:59, com os sonos em arcos e as mamadas em pontos.

const DIA = 24 * HORA;
const ms = (iso: string) => new Date(iso).getTime();

export type Trecho = { id: string; ini: number; fim: number; emAndamento: boolean };
export type Faixa = { ini: number; fim: number };

type Sono = Extract<Registro, { tipo: 'sono' }>;

const sonosDe = (registros: Registro[]) =>
  (registros.filter((r) => r.tipo === 'sono') as Sono[])
    .map((r) => ({ id: r.id, ini: ms(r.inicio), fim: r.fim ? ms(r.fim) : null }))
    .sort((a, b) => a.ini - b.ini);

// Noite x soneca: o meio do sono entre 19h e 6h conta como sono da noite.
export function ehNoite(ini: number, fim: number) {
  const meio = new Date((ini + fim) / 2);
  const h = meio.getHours() + meio.getMinutes() / 60;
  return h >= 19 || h < 6;
}

// Sonos e mamadas de um dia (0 = hoje), cortados na meia-noite e no "agora".
export function doDia(registros: Registro[], diasAtras: number, agora = Date.now()) {
  const hoje = inicioDoDia(new Date(agora));
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diasAtras).getTime();
  const fim = Math.min(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diasAtras + 1).getTime(), agora);

  const sonos: (Trecho & { noite: boolean })[] = [];
  for (const s of sonosDe(registros)) {
    const sFim = s.fim ?? agora;
    if (sFim <= ini || s.ini >= fim) continue;
    sonos.push({
      id: s.id,
      ini: Math.max(s.ini, ini),
      fim: Math.min(sFim, fim),
      emAndamento: s.fim === null,
      // Classifica pelo sono inteiro, não pelo pedaço que cai neste dia.
      noite: ehNoite(s.ini, sFim),
    });
  }

  const mamadas = registros
    .filter((r) => (r.tipo === 'mamada' || r.tipo === 'mamadeira' || r.tipo === 'refeicao') && ms(r.inicio) >= ini && ms(r.inicio) < fim)
    .map((r) => ({ id: r.id, em: ms(r.inicio) }));

  const soma = (lista: Trecho[]) => lista.reduce((t, s) => t + s.fim - s.ini, 0);
  const sonecas = sonos.filter((s) => !s.noite);
  const total = soma(sonos);
  return {
    inicio: ini,
    sonos,
    mamadas,
    total,
    noite: soma(sonos.filter((s) => s.noite)),
    sonecas: soma(sonecas),
    nSonecas: sonecas.length,
    // Acordado até agora (hoje) ou no dia inteiro (dias passados).
    acordado: Math.max(0, fim - ini - total),
  };
}

// Minuto do dia (0..1439) para relógio e médias.
export const minutoDoDia = (t: number) => {
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
};

// Média de horários que passam da meia-noite (ex.: dormir 23:30 e 00:30 → 00:00).
function mediaHorario(minutos: number[], viraDia: number) {
  if (!minutos.length) return null;
  const m = minutos.map((x) => (x < viraDia ? x + 1440 : x));
  return Math.round(m.reduce((a, b) => a + b, 0) / m.length) % 1440;
}

const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Janelas de vigília: tempo acordado entre um sono e o próximo (só as de até 8h,
// para não contar dias sem registro como "acordado o dia todo").
function janelas(sonos: { ini: number; fim: number | null }[], desde: number) {
  const out: number[] = [];
  for (let i = 1; i < sonos.length; i++) {
    const antes = sonos[i - 1].fim;
    if (antes === null || antes < desde) continue;
    const gap = sonos[i].ini - antes;
    if (gap >= 10 * MINUTO && gap <= 8 * HORA) out.push(gap);
  }
  return out;
}

// Médias dos últimos `dias` dias completos (sem hoje), contando só os dias com sono registrado.
export function mediaSono(registros: Registro[], dias = 7, agora = Date.now()) {
  const porDia = Array.from({ length: dias }, (_, i) => doDia(registros, i + 1, agora)).filter((d) => d.sonos.length);
  const desde = doDia(registros, dias, agora).inicio;
  const sonos = sonosDe(registros).filter((s) => s.fim !== null && s.ini >= desde - 12 * HORA && s.ini < inicioDoDia(new Date(agora)).getTime());
  const noites = sonos.filter((s) => s.fim !== null && s.fim - s.ini >= 2 * HORA && ehNoite(s.ini, s.fim));
  const n = porDia.length;
  const media = (f: (d: (typeof porDia)[number]) => number) => (n ? porDia.reduce((t, d) => t + f(d), 0) / n : 0);
  const js = janelas(sonos, desde);
  return {
    dias: n,
    total: media((d) => d.total),
    noite: media((d) => d.noite),
    sonecas: media((d) => d.sonecas),
    nSonecas: media((d) => d.nSonecas),
    janela: js.length >= 5 ? mediana(js) : null,
    // Hora de dormir à noite e de acordar de manhã (precisa de 3 noites).
    dormir: noites.length >= 3 ? mediaHorario(noites.map((s) => minutoDoDia(s.ini)), 12 * 60) : null,
    acordar: noites.length >= 3 ? mediaHorario(noites.map((s) => minutoDoDia(s.fim!)), 0) : null,
  };
}

export type Media = ReturnType<typeof mediaSono>;

// Janela de vigília de referência por idade, em minutos (valores gerais, não regra médica).
const JANELAS: { ateMeses: number; min: number; max: number }[] = [
  { ateMeses: 1, min: 35, max: 60 },
  { ateMeses: 3, min: 60, max: 90 },
  { ateMeses: 5, min: 75, max: 120 },
  { ateMeses: 7, min: 120, max: 180 },
  { ateMeses: 10, min: 150, max: 210 },
  { ateMeses: 14, min: 180, max: 240 },
  { ateMeses: 24, min: 240, max: 360 },
  { ateMeses: Infinity, min: 300, max: 360 },
];

export function janelaPorIdade(meses: number) {
  const j = JANELAS.find((x) => meses < x.ateMeses)!;
  return { min: j.min * MINUTO, max: j.max * MINUTO };
}

export type Previsao =
  | { tipo: 'janela'; min: number; max: number } // recém-nascido: só a janela típica, sem horário
  | { tipo: 'soneca' | 'noite'; faixa: Faixa; previsto: number; passou: boolean; pelaMedia: boolean };

// Próximo sono sugerido. Usa a janela do próprio bebê (últimos 7 dias) quando há dados;
// senão, a referência da idade. Só existe com o bebê acordado e um sono recente registrado.
export function preverSono(
  registros: Registro[],
  nascimento: string,
  media: Media,
  agora = Date.now(),
): Previsao | null {
  const sonos = sonosDe(registros);
  if (sonos.some((s) => s.fim === null)) return null;
  const meses = idade(nascimento, new Date(agora)).meses;
  const ref = janelaPorIdade(meses);
  if (meses < 3) return { tipo: 'janela', min: ref.min, max: ref.max };

  const ultimo = sonos.filter((s) => s.fim !== null).at(-1);
  if (!ultimo || agora - ultimo.fim! > 12 * HORA) return null;
  const acordou = ultimo.fim!;

  const pelaMedia = media.janela !== null;
  const faixa = pelaMedia
    ? { ini: acordou + media.janela! - 15 * MINUTO, fim: acordou + media.janela! + 15 * MINUTO }
    : { ini: acordou + ref.min, fim: acordou + ref.max };
  let previsto = (faixa.ini + faixa.fim) / 2;

  // Perto da hora de dormir de costume (ou depois das 19h sem histórico), vira o sono da noite.
  let tipo: 'soneca' | 'noite' = 'soneca';
  if (media.dormir !== null) {
    const d = new Date(acordou);
    let dormir = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, media.dormir).getTime();
    if (media.dormir < 12 * 60) dormir += DIA;
    if (previsto >= dormir - 45 * MINUTO && acordou < dormir) {
      tipo = 'noite';
      previsto = dormir;
      faixa.ini = dormir - 15 * MINUTO;
      faixa.fim = dormir + 15 * MINUTO;
    }
  } else if (minutoDoDia(previsto) >= 19 * 60 || minutoDoDia(previsto) < 3 * 60) {
    tipo = 'noite';
  }

  return { tipo, faixa, previsto, passou: agora > faixa.fim, pelaMedia };
}
