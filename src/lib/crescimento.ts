import { OMS, PASSO_DIAS, type Indicador } from '@/data/oms';
import type { Bebe, Sexo } from '@/context/bebes';
import type { Medida } from '@/context/medidas';
import { dataLocal } from './idade';

export type { Indicador };

// Linhas de referência mostradas no gráfico (percentis 3, 15, 50, 85 e 97 da OMS).
export const PERCENTIS = [
  { p: 3, z: -1.8808 },
  { p: 15, z: -1.0364 },
  { p: 50, z: 0 },
  { p: 85, z: 1.0364 },
  { p: 97, z: 1.8808 },
] as const;

export const DIA_MAXIMO = (OMS.peso.M.L.length - 1) * PASSO_DIAS;

export function idadeEmDias(nascimento: string, data: string) {
  return Math.round((dataLocal(data).getTime() - dataLocal(nascimento).getTime()) / 86_400_000);
}

// Parâmetros L, M e S na idade em dias, interpolando entre os pontos da tabela.
export function lms(indicador: Indicador, sexo: Sexo, dias: number) {
  const t = OMS[indicador][sexo];
  const pos = Math.min(Math.max(dias, 0), DIA_MAXIMO) / PASSO_DIAS;
  const i = Math.min(Math.floor(pos), t.L.length - 2);
  const f = pos - i;
  const mistura = (v: number[]) => v[i] + (v[i + 1] - v[i]) * f;
  return { L: mistura(t.L), M: mistura(t.M), S: mistura(t.S) };
}

function valorNoZ({ L, M, S }: { L: number; M: number; S: number }, z: number) {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

export function valorNoPercentil(indicador: Indicador, sexo: Sexo, dias: number, z: number) {
  return valorNoZ(lms(indicador, sexo, dias), z);
}

// Escore z pelo método LMS. Para peso e perímetro cefálico, a OMS ajusta os valores além de ±3.
export function escoreZ(indicador: Indicador, sexo: Sexo, dias: number, valor: number) {
  const p = lms(indicador, sexo, dias);
  const z = p.L === 0 ? Math.log(valor / p.M) / p.S : (Math.pow(valor / p.M, p.L) - 1) / (p.L * p.S);
  if (indicador === 'altura' || Math.abs(z) <= 3) return z;
  const sd3 = valorNoZ(p, Math.sign(z) * 3);
  const sd2 = valorNoZ(p, Math.sign(z) * 2);
  return Math.sign(z) * 3 + (valor - sd3) / Math.abs(sd3 - sd2);
}

// Distribuição normal acumulada (Abramowitz e Stegun 7.1.26).
function normal(z: number) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export function percentil(indicador: Indicador, sexo: Sexo, dias: number, valor: number) {
  return normal(escoreZ(indicador, sexo, dias, valor)) * 100;
}

// "percentil 62"; nos extremos, "abaixo do percentil 1" / "acima do percentil 99".
export function percentilTexto(p: number) {
  if (p < 1) return 'abaixo do percentil 1';
  if (p > 99) return 'acima do percentil 99';
  return `percentil ${Math.round(p)}`;
}

export type Ponto = { dias: number; valor: number; data: string };

function valorDe(m: Medida, i: Indicador) {
  return i === 'peso' ? m.peso_kg : i === 'altura' ? m.altura_cm : m.perimetro_cefalico_cm;
}

// Pontos do gráfico: medidas registradas + peso e altura ao nascer do cadastro.
export function pontosDe(bebe: Bebe, medidas: Medida[], i: Indicador): Ponto[] {
  const pontos: Ponto[] = [];
  const aoNascer = i === 'peso' ? bebe.peso_nascer_kg : i === 'altura' ? bebe.altura_nascer_cm : null;
  if (aoNascer && !medidas.some((m) => m.data === bebe.nascimento && valorDe(m, i) !== null))
    pontos.push({ dias: 0, valor: Number(aoNascer), data: bebe.nascimento });
  for (const m of medidas) {
    const v = valorDe(m, i);
    if (v !== null) pontos.push({ dias: idadeEmDias(bebe.nascimento, m.data), valor: Number(v), data: m.data });
  }
  return pontos.sort((a, b) => a.dias - b.dias);
}

