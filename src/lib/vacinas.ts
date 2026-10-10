// Calendário Nacional de Vacinação 2026 (Instrução Normativa do PNI/Ministério da Saúde),
// recortado para a gestação e para crianças até 4 anos. Os pais confirmam sempre na unidade de saúde.

import { dataLocal, hojeISO, idade } from './idade';

export type Para = 'bebe' | 'mae';

export type DoseCalendario = {
  codigo: string;
  vacina: string;
  dose: string;
  protege: string;
  /** Bebê: idade recomendada em meses (0 = ao nascer). */
  idadeMeses?: number;
  /** Bebê: depois desta idade (meses) a dose não é mais aplicada. */
  limiteMeses?: number;
  /** Mãe: a partir de qual semana de gestação. */
  semanaMin?: number;
  /** Mãe: depende do cartão de vacinas (só se o esquema estiver incompleto). */
  conformeCartao?: boolean;
  nota?: string;
};

export const CALENDARIO_BEBE: DoseCalendario[] = [
  { codigo: 'bcg', vacina: 'BCG', dose: 'Dose única', idadeMeses: 0, protege: 'Formas graves de tuberculose', nota: 'Ainda na maternidade.' },
  { codigo: 'hepb-rn', vacina: 'Hepatite B', dose: 'Dose ao nascer', idadeMeses: 0, limiteMeses: 1, protege: 'Hepatite B', nota: 'Nas primeiras 12 horas; só até 1 mês de vida.' },
  { codigo: 'penta-1', vacina: 'Penta (DTP+HB+Hib)', dose: '1ª dose', idadeMeses: 2, protege: 'Difteria, tétano, coqueluche, hepatite B e Haemophilus influenzae b' },
  { codigo: 'vip-1', vacina: 'Poliomielite inativada (VIP)', dose: '1ª dose', idadeMeses: 2, protege: 'Paralisia infantil' },
  { codigo: 'vpc20-1', vacina: 'Pneumocócica 20-valente', dose: '1ª dose', idadeMeses: 2, protege: 'Pneumonia, meningite e otite por pneumococo' },
  { codigo: 'rota-1', vacina: 'Rotavírus', dose: '1ª dose', idadeMeses: 2, limiteMeses: 12, protege: 'Diarreia por rotavírus', nota: 'Até 11 meses e 29 dias.' },
  { codigo: 'menc-1', vacina: 'Meningocócica C', dose: '1ª dose', idadeMeses: 3, protege: 'Meningite meningocócica C' },
  { codigo: 'penta-2', vacina: 'Penta (DTP+HB+Hib)', dose: '2ª dose', idadeMeses: 4, protege: 'Difteria, tétano, coqueluche, hepatite B e Haemophilus influenzae b' },
  { codigo: 'vip-2', vacina: 'Poliomielite inativada (VIP)', dose: '2ª dose', idadeMeses: 4, protege: 'Paralisia infantil' },
  { codigo: 'vpc10-2', vacina: 'Pneumocócica 10-valente', dose: '2ª dose', idadeMeses: 4, protege: 'Pneumonia, meningite e otite por pneumococo', nota: 'Na transição para a VPC20, a 2ª dose é com a VPC10.' },
  { codigo: 'rota-2', vacina: 'Rotavírus', dose: '2ª dose', idadeMeses: 4, limiteMeses: 24, protege: 'Diarreia por rotavírus', nota: 'Até 23 meses e 29 dias.' },
  { codigo: 'menc-2', vacina: 'Meningocócica C', dose: '2ª dose', idadeMeses: 5, protege: 'Meningite meningocócica C' },
  { codigo: 'penta-3', vacina: 'Penta (DTP+HB+Hib)', dose: '3ª dose', idadeMeses: 6, protege: 'Difteria, tétano, coqueluche, hepatite B e Haemophilus influenzae b' },
  { codigo: 'vip-3', vacina: 'Poliomielite inativada (VIP)', dose: '3ª dose', idadeMeses: 6, protege: 'Paralisia infantil' },
  { codigo: 'covid-1', vacina: 'Covid-19', dose: '1ª dose', idadeMeses: 6, protege: 'Formas graves de covid-19' },
  { codigo: 'influenza-1', vacina: 'Influenza (gripe)', dose: '1ª dose', idadeMeses: 6, protege: 'Gripe', nota: 'Na primeira vez são 2 doses com 30 dias; depois, 1 dose por ano até 5 anos.' },
  { codigo: 'covid-2', vacina: 'Covid-19', dose: '2ª dose', idadeMeses: 7, protege: 'Formas graves de covid-19' },
  { codigo: 'influenza-2', vacina: 'Influenza (gripe)', dose: '2ª dose', idadeMeses: 7, protege: 'Gripe' },
  { codigo: 'covid-3', vacina: 'Covid-19', dose: '3ª dose', idadeMeses: 9, protege: 'Formas graves de covid-19' },
  { codigo: 'vfa-1', vacina: 'Febre amarela', dose: '1ª dose', idadeMeses: 9, protege: 'Febre amarela' },
  { codigo: 'vpc20-r', vacina: 'Pneumocócica 20-valente', dose: 'Reforço', idadeMeses: 12, protege: 'Pneumonia, meningite e otite por pneumococo' },
  { codigo: 'acwy-r', vacina: 'Meningocócica ACWY', dose: 'Reforço', idadeMeses: 12, protege: 'Meningites meningocócicas A, C, W e Y' },
  { codigo: 'scr-1', vacina: 'Tríplice viral (SCR)', dose: '1ª dose', idadeMeses: 12, protege: 'Sarampo, caxumba e rubéola' },
  { codigo: 'dtp-r1', vacina: 'DTP (tríplice bacteriana)', dose: '1º reforço', idadeMeses: 15, protege: 'Difteria, tétano e coqueluche' },
  { codigo: 'vip-r1', vacina: 'Poliomielite inativada (VIP)', dose: '1º reforço', idadeMeses: 15, protege: 'Paralisia infantil' },
  { codigo: 'scr-2', vacina: 'Tríplice viral (SCR)', dose: '2ª dose', idadeMeses: 15, protege: 'Sarampo, caxumba e rubéola' },
  { codigo: 'varicela-1', vacina: 'Varicela (catapora)', dose: '1ª dose', idadeMeses: 15, protege: 'Catapora' },
  { codigo: 'hepa', vacina: 'Hepatite A', dose: 'Dose única', idadeMeses: 15, protege: 'Hepatite A' },
  { codigo: 'dtp-r2', vacina: 'DTP (tríplice bacteriana)', dose: '2º reforço', idadeMeses: 48, protege: 'Difteria, tétano e coqueluche' },
  { codigo: 'vip-r2', vacina: 'Poliomielite inativada (VIP)', dose: '2º reforço', idadeMeses: 48, protege: 'Paralisia infantil' },
  { codigo: 'vfa-r', vacina: 'Febre amarela', dose: 'Reforço', idadeMeses: 48, protege: 'Febre amarela' },
  { codigo: 'varicela-2', vacina: 'Varicela (catapora)', dose: '2ª dose', idadeMeses: 48, protege: 'Catapora' },
];

export const CALENDARIO_MAE: DoseCalendario[] = [
  { codigo: 'influenza-g', vacina: 'Influenza (gripe)', dose: '1 dose na temporada', semanaMin: 0, protege: 'Gripe na mãe e no bebê nos primeiros meses', nota: 'Em qualquer fase da gestação.' },
  { codigo: 'covid-g', vacina: 'Covid-19', dose: '1 dose na gestação', semanaMin: 0, protege: 'Formas graves de covid-19', nota: 'Em qualquer fase, com 6 meses desde a última dose.' },
  { codigo: 'dtpa-g', vacina: 'dTpa (tríplice bacteriana acelular)', dose: '1 dose em cada gestação', semanaMin: 20, protege: 'Coqueluche no recém-nascido, difteria e tétano', nota: 'A partir da 20ª semana. Se não der, até 45 dias depois do parto.' },
  { codigo: 'vsr-g', vacina: 'Vírus sincicial respiratório (VSR)', dose: 'Dose única em cada gestação', semanaMin: 28, protege: 'Bronquiolite grave no bebê nos primeiros 6 meses', nota: 'A partir da 28ª semana.' },
  { codigo: 'hepb-g', vacina: 'Hepatite B', dose: 'Completar 3 doses', semanaMin: 0, conformeCartao: true, protege: 'Hepatite B (e a transmissão para o bebê)', nota: 'Só se o cartão não tiver as 3 doses. Não reinicia o esquema.' },
  { codigo: 'dt-g', vacina: 'dT (dupla adulto)', dose: 'Completar o esquema', semanaMin: 0, conformeCartao: true, protege: 'Difteria e tétano', nota: 'Só se o cartão tiver menos de 3 doses de vacinas com difteria e tétano.' },
];

export const FONTE_CALENDARIO = 'Calendário Nacional de Vacinação 2026 (Ministério da Saúde/PNI)';

export type Situacao = 'aplicada' | 'atrasada' | 'agora' | 'proxima' | 'futura' | 'fora-do-prazo' | 'verificar';

const MS_DIA = 86_400_000;

// Data recomendada para a dose do bebê: nascimento + meses.
export function dataRecomendada(nascimento: string, meses: number) {
  const d = dataLocal(nascimento);
  return new Date(d.getFullYear(), d.getMonth() + meses, d.getDate());
}

export function situacaoBebe(dose: DoseCalendario, nascimento: string, aplicada: boolean, hoje = hojeISO()): Situacao {
  if (aplicada) return 'aplicada';
  const { meses } = idade(nascimento, dataLocal(hoje));
  if (dose.limiteMeses !== undefined && meses >= dose.limiteMeses) return 'fora-do-prazo';
  const quando = dataRecomendada(nascimento, dose.idadeMeses!).getTime();
  const dias = (quando - dataLocal(hoje).getTime()) / MS_DIA;
  if (dias < -30) return 'atrasada';
  if (dias <= 0) return 'agora';
  if (dias <= 30) return 'proxima';
  return 'futura';
}

export function situacaoMae(dose: DoseCalendario, semanas: number | null, aplicada: boolean): Situacao {
  if (aplicada) return 'aplicada';
  if (dose.conformeCartao) return 'verificar';
  if (semanas === null) return 'futura';
  return semanas >= (dose.semanaMin ?? 0) ? 'agora' : 'futura';
}

export const rotuloSituacao: Record<Situacao, string> = {
  aplicada: 'Tomada',
  atrasada: 'Atrasada',
  agora: 'Pode tomar',
  proxima: 'Em breve',
  futura: 'Mais adiante',
  'fora-do-prazo': 'Fora do prazo',
  verificar: 'Conferir cartão',
};

export function rotuloIdade(meses: number) {
  if (meses === 0) return 'Ao nascer';
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  if (meses % 12 === 0) return `${meses / 12} ${meses === 12 ? 'ano' : 'anos'}`;
  return `${meses} meses`;
}
