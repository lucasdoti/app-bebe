// Números do resumo para o pediatra: médias por dia nos últimos dias completos.
import type { Registro } from './registros';
import { temposPorLado } from './registros';
import { inicioDoDia } from './tempo';

const DIA = 86_400_000;
const ms = (iso: string) => new Date(iso).getTime();

export type ResumoSemana = {
  dias: number;
  mamadasPorDia: number;
  peitoMinPorMamada: number | null;
  mamadeiraMlPorDia: number | null;
  refeicoesPorDia: number;
  sonoHorasPorDia: number;
  sonosPorDia: number;
  fraldasPorDia: number;
  xixiPorDia: number;
  cocoPorDia: number;
  febreMaxima: number | null;
};

// Considera os `dias` dias completos antes de hoje (hoje ainda não acabou).
export function resumoDaSemana(registros: Registro[], dias = 7, agora = Date.now()): ResumoSemana {
  const fim = inicioDoDia(new Date(agora)).getTime();
  const inicio = fim - dias * DIA;
  const no = registros.filter((r) => ms(r.inicio) >= inicio && ms(r.inicio) < fim);
  const por = (n: number) => Math.round((n / dias) * 10) / 10;

  const peito = no.filter((r): r is Extract<Registro, { tipo: 'mamada' }> => r.tipo === 'mamada' && r.fim !== null);
  const mamadeiras = no.filter((r): r is Extract<Registro, { tipo: 'mamadeira' }> => r.tipo === 'mamadeira');
  const fraldas = no.filter((r): r is Extract<Registro, { tipo: 'fralda' }> => r.tipo === 'fralda');
  const febres = no.filter((r): r is Extract<Registro, { tipo: 'febre' }> => r.tipo === 'febre');

  // Sono: soma o pedaço de cada sono que cai dentro do período.
  let sonoMs = 0;
  let sonos = 0;
  for (const s of registros.filter((r) => r.tipo === 'sono' && r.fim !== null)) {
    const a = Math.max(ms(s.inicio), inicio);
    const b = Math.min(ms(s.fim!), fim);
    if (b > a) sonoMs += b - a;
    if (ms(s.inicio) >= inicio && ms(s.inicio) < fim) sonos++;
  }

  const minutosPeito = peito.map((r) => {
    const t = temposPorLado(r.detalhes);
    return (t.E + t.D) / 60_000;
  });

  return {
    dias,
    mamadasPorDia: por(peito.length + mamadeiras.length),
    peitoMinPorMamada: minutosPeito.length ? Math.round(minutosPeito.reduce((a, b) => a + b, 0) / minutosPeito.length) : null,
    mamadeiraMlPorDia: mamadeiras.length ? Math.round(mamadeiras.reduce((s, r) => s + r.detalhes.ml, 0) / dias) : null,
    refeicoesPorDia: por(no.filter((r) => r.tipo === 'refeicao').length),
    sonoHorasPorDia: Math.round((sonoMs / dias / 3_600_000) * 10) / 10,
    sonosPorDia: por(sonos),
    fraldasPorDia: por(fraldas.length),
    xixiPorDia: por(fraldas.filter((f) => f.detalhes.xixi).length),
    cocoPorDia: por(fraldas.filter((f) => f.detalhes.coco).length),
    febreMaxima: febres.length ? Math.max(...febres.map((f) => f.detalhes.temperatura)) : null,
  };
}

export const numeroBR = (n: number) => String(n).replace('.', ',');
