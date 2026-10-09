import { dataLocal, hojeISO } from './idade';

// Gestação contada em 280 dias (40 semanas) a partir da data da última menstruação (DUM).
const DIA = 86_400_000;
export const DURACAO_DIAS = 280;

function somarDias(iso: string, dias: number) {
  const d = dataLocal(iso);
  d.setDate(d.getDate() + dias);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

const diasEntre = (de: string, ate: string) => Math.round((dataLocal(ate).getTime() - dataLocal(de).getTime()) / DIA);

export const partoPelaDum = (dum: string) => somarDias(dum, DURACAO_DIAS);

// Pelo ultrassom: na data do exame a gestação tinha `semanas` + `dias`.
export const partoPeloUltrassom = (dataExame: string, semanas: number, dias: number) =>
  somarDias(dataExame, DURACAO_DIAS - (semanas * 7 + dias));

export function idadeGestacional(partoPrevisto: string, hoje = hojeISO()) {
  const total = DURACAO_DIAS - diasEntre(hoje, partoPrevisto);
  return {
    totalDias: total,
    semanas: Math.floor(total / 7),
    dias: ((total % 7) + 7) % 7,
    faltam: diasEntre(hoje, partoPrevisto),
  };
}

export function idadeGestacionalNaData(partoPrevisto: string, data: string) {
  return idadeGestacional(partoPrevisto, data);
}

export function trimestre(semanas: number) {
  return semanas < 14 ? 1 : semanas < 28 ? 2 : 3;
}

export function semanasTexto(semanas: number, dias: number) {
  return dias ? `${semanas} semanas e ${dias} ${dias === 1 ? 'dia' : 'dias'}` : `${semanas} semanas`;
}

export function faltamTexto(faltam: number) {
  if (faltam > 1) return `faltam ${faltam} dias`;
  if (faltam === 1) return 'falta 1 dia';
  if (faltam === 0) return 'é hoje a data prevista';
  return `${-faltam} ${faltam === -1 ? 'dia' : 'dias'} depois da data prevista`;
}

// Tamanho médio aproximado por semana, comparado com frutas e legumes.
// Até a 19ª semana, comprimento da cabeça ao bumbum; depois, da cabeça aos pés.
const TAMANHOS: Record<number, [string, number | null, number | null]> = {
  4: ['uma semente de papoula', 0.1, null],
  5: ['uma semente de gergelim', 0.2, null],
  6: ['uma lentilha', 0.6, null],
  7: ['um mirtilo', 1, null],
  8: ['um feijão', 1.6, 1],
  9: ['uma uva', 2.3, 2],
  10: ['um morango', 3.1, 4],
  11: ['um figo', 4.1, 7],
  12: ['um limão', 5.4, 14],
  13: ['uma vagem de ervilha', 7.4, 23],
  14: ['um limão-siciliano', 8.7, 43],
  15: ['uma maçã', 10.1, 70],
  16: ['um abacate', 11.6, 100],
  17: ['uma beterraba', 13, 140],
  18: ['um pimentão', 14.2, 190],
  19: ['um tomate grande', 15.3, 240],
  20: ['uma banana', 25.6, 300],
  21: ['uma cenoura', 26.7, 360],
  22: ['uma abobrinha', 27.8, 430],
  23: ['uma manga', 28.9, 500],
  24: ['uma espiga de milho', 30, 600],
  25: ['uma couve-flor pequena', 34.6, 660],
  26: ['um pé de alface', 35.6, 760],
  27: ['uma couve-flor', 36.6, 875],
  28: ['uma berinjela', 37.6, 1000],
  29: ['uma abóbora-menina', 38.6, 1150],
  30: ['um repolho', 39.9, 1300],
  31: ['um coco', 41.1, 1500],
  32: ['uma jaca pequena', 42.4, 1700],
  33: ['um abacaxi', 43.7, 1900],
  34: ['um melão', 45, 2150],
  35: ['um melão grande', 46.2, 2400],
  36: ['uma alface-romana', 47.4, 2600],
  37: ['um maço de acelga', 48.6, 2850],
  38: ['um alho-poró', 49.8, 3100],
  39: ['uma melancia pequena', 50.7, 3300],
  40: ['uma abóbora', 51.2, 3450],
};

export function tamanhoNaSemana(semanas: number) {
  const s = Math.min(Math.max(semanas, 4), 40);
  const [comparacao, cm, gramas] = TAMANHOS[s];
  return { comparacao, cm, gramas };
}

// Peso médio aproximado (g) para a linha de referência do gráfico de ultrassons.
export function pesoMedioNaSemana(semanas: number) {
  return TAMANHOS[Math.min(Math.max(Math.round(semanas), 8), 40)][2];
}

export function pesoTexto(gramas: number) {
  return gramas >= 1000 ? `${(gramas / 1000).toFixed(2).replace('.', ',')} kg` : `${Math.round(gramas)} g`;
}
